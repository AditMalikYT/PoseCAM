import type { PoseLandmark, EstimatedPose } from '../types/pose';

const MODEL_CONFIG = {
  delegate: 'GPU' as const,
  runningMode: 'VIDEO' as const,
  minPoseDetectionConfidence: 0.6,
  minPosePresenceConfidence: 0.6,
  minTrackingConfidence: 0.5,
  refineLandmarks: true,
  outputSegmentationMasks: false,
};

/** tasks-vision often reports per-keypoint visibility as 0 while gating on
 *  person-level detection confidence. When no landmark reports any visibility
 *  we fall back to this "present" value so guards don't reject valid frames. */
const PRESENCE_FALLBACK_VISIBILITY = 0.9;

const CRITICAL_LANDMARKS: Record<number, { name: string; weight: number }> = {
  11: { name: 'left_shoulder', weight: 1.0 },
  12: { name: 'right_shoulder', weight: 1.0 },
  13: { name: 'left_elbow', weight: 0.9 },
  14: { name: 'right_elbow', weight: 0.9 },
  23: { name: 'left_hip', weight: 1.0 },
  24: { name: 'right_hip', weight: 1.0 },
};

class LandmarkSmoother {
  private prev = new Map<number, PoseLandmark>();
  private factor: number;
  constructor(f: number = 0.7) { this.factor = f; }
  smooth(landmarks: PoseLandmark[]): PoseLandmark[] {
    return landmarks.map((lm, i) => {
      const p = this.prev.get(i);
      if (p && lm.visibility >= 0.5) {
        return { ...lm, x: p.x + this.factor * (lm.x - p.x), y: p.y + this.factor * (lm.y - p.y), z: p.z + this.factor * (lm.z - p.z) };
      }
      this.prev.set(i, lm);
      return lm;
    });
  }
  reset() { this.prev.clear(); }
}

class PoseValidator {
  private history: { valid: boolean; ts: number }[] = [];
  private req: number; private maxAge: number;
  constructor(r: number = 3, m: number = 500) { this.req = r; this.maxAge = m; }
  validate(v: boolean): boolean {
    const now = performance.now();
    this.history.push({ valid: v, ts: now });
    this.history = this.history.filter(f => now - f.ts < this.maxAge);
    const recent = this.history.slice(-this.req);
    return recent.filter(f => f.valid).length >= Math.ceil(this.req * 0.67);
  }
  reset() { this.history = []; }
}

let landmarker: unknown = null;
let smoother: LandmarkSmoother | null = null;
let validator: PoseValidator | null = null;
let initialized = false;

export async function initPoseLandmarker(modelPath?: string): Promise<boolean> {
  if (initialized) return true;
  const targetModel = modelPath || 'https://cdn.jsdelivr.net/gh/AditMalikYT/PoseCAM@main/asset/pose_landmarker_lite.task';
  try {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const resolver = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm');

    // Try GPU delegate first, fallback to CPU
    let delegate: 'GPU' | 'CPU' = MODEL_CONFIG.delegate;
    try {
      landmarker = await PoseLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: targetModel, delegate: 'GPU' },
        runningMode: MODEL_CONFIG.runningMode, numPoses: 1,
        minPoseDetectionConfidence: MODEL_CONFIG.minPoseDetectionConfidence,
        minPosePresenceConfidence: MODEL_CONFIG.minPosePresenceConfidence,
        minTrackingConfidence: MODEL_CONFIG.minTrackingConfidence,
        outputSegmentationMasks: MODEL_CONFIG.outputSegmentationMasks,
      });
    } catch (gpuErr) {
      console.warn('GPU delegate failed, falling back to CPU:', gpuErr);
      delegate = 'CPU';
      landmarker = await PoseLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: targetModel, delegate: 'CPU' },
        runningMode: MODEL_CONFIG.runningMode, numPoses: 1,
        minPoseDetectionConfidence: MODEL_CONFIG.minPoseDetectionConfidence,
        minPosePresenceConfidence: MODEL_CONFIG.minPosePresenceConfidence,
        minTrackingConfidence: MODEL_CONFIG.minTrackingConfidence,
        outputSegmentationMasks: MODEL_CONFIG.outputSegmentationMasks,
      });
    }

    smoother = new LandmarkSmoother(0.7);
    validator = new PoseValidator(3, 500);
    initialized = true;
    return true;
  } catch (e) { console.error('Init failed:', e); return false; }
}

export async function detectPose(video: HTMLVideoElement, ts: number = performance.now()): Promise<EstimatedPose | null> {
  if (!landmarker || !initialized || !video || video.readyState < 2) return null;
  try {
    const r = await (landmarker as any).detectForVideo(video, ts);
    const raw = normalizeLandmarks(r?.landmarks?.[0]);
    try { r?.close?.(); } catch { /* release MediaPipe mask resources */ }

    // No person in frame: feed the validator (so its history decays) and
    // report null. The caller keeps the render loop alive and shows telemetry.
    if (!raw.length) {
      validator?.validate(false);
      return null;
    }

    const smooth = smoother?.smooth(raw) ?? raw;
    const conf = computeConfidencePct(smooth) / 100;

    // The validator needs consecutive detections; a single dropped frame must
    // NOT discard landmarks (that froze telemetry at "0 Keypoints").
    const trackingStable = validator?.validate(true) ?? true;

    return {
      landmarks: smooth,
      worldLandmarks: smooth,
      timestamp: ts,
      confidence: Number.isFinite(conf) ? conf : 0,
      isPersonPresent: trackingStable && conf >= 0.5,
    };
  } catch (e) { console.error(e); return null; }
}

/* -------------------------------------------------------------------------- */
/* Raw result parsing - root cause of "0 Keypoints / Confidence: NaN%"        */
/* -------------------------------------------------------------------------- */

interface RawLandmark {
  x?: number;
  y?: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

/** Coerce unknown values to finite numbers; falls back instead of propagating NaN */
function toFinite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Normalize MediaPipe pose output into validated PoseLandmark[].
 *
 * @mediapipe/tasks-vision PoseLandmarker returns NormalizedLandmark OBJECTS
 * ({x, y, z, visibility}); legacy solutions / some wasm builds deliver a flat
 * Float32Array of [x, y, z, visibility] quadruplets. Handle BOTH layouts,
 * sanitize every field, and never emit NaN/undefined telemetry values.
 */
export function normalizeLandmarks(source: unknown): PoseLandmark[] {
  if (!source) return [];

  let out: PoseLandmark[];

  if (typeof Float32Array !== 'undefined' && source instanceof Float32Array) {
    // Flat buffer layout: [x0, y0, z0, vis0, x1, y1, z1, vis1, ...]
    out = [];
    for (let i = 0; i + 3 < source.length; i += 4) {
      const visibility = toFinite(source[i + 3], 0);
      out.push({
        x: toFinite(source[i], 0),
        y: toFinite(source[i + 1], 0),
        z: toFinite(source[i + 2], 0),
        visibility,
        presence: visibility,
      });
    }
  } else if (Array.isArray(source)) {
    // tasks-vision layout: NormalizedLandmark[] objects
    out = source.map((lm) => {
      const raw = (lm ?? {}) as RawLandmark;
      const visibility = toFinite(raw.visibility, 0);
      return {
        x: toFinite(raw.x, 0),
        y: toFinite(raw.y, 0),
        z: toFinite(raw.z, 0),
        visibility,
        presence: toFinite(raw.presence ?? visibility, visibility),
      };
    });
  } else {
    return [];
  }

  // Person-level gate already passed (minPoseDetectionConfidence: 0.6), so an
  // all-zero visibility payload means the model simply doesn't emit per-keypoint
  // confidence - not that the person is invisible. Fall back to a present-state
  // value instead of rejecting every keypoint ("0 Keypoints / N/A" freeze).
  if (out.length > 0 && !out.some((lm) => lm.visibility > 0)) {
    out = out.map((lm) => ({
      ...lm,
      visibility: PRESENCE_FALLBACK_VISIBILITY,
      presence: PRESENCE_FALLBACK_VISIBILITY,
    }));
  }

  return out;
}

/** onResults-equivalent processor for raw MediaPipe results. Always finite,
 *  always null-safe: the render loop can consume it without NaN guards. */
export interface ProcessedPoseFrame {
  landmarks: PoseLandmark[];
  confidencePct: number;   // 0-100, never NaN
  validKeypoints: number;  // keypoints above the visibility threshold
  totalKeypoints: number;  // raw landmark count from the model
  isPersonPresent: boolean;
  timestamp: number;
}

export function processPoseResults(
  rawResults: unknown,
  timestamp: number = performance.now()
): ProcessedPoseFrame {
  const results = (rawResults ?? {}) as { landmarks?: unknown[] };
  const landmarks = normalizeLandmarks(results.landmarks?.[0]);
  const smooth = smoother?.smooth(landmarks) ?? landmarks;
  const confidencePct = computeConfidencePct(smooth);

  return {
    landmarks: smooth,
    confidencePct,
    validKeypoints: countValidKeypoints(smooth),
    totalKeypoints: smooth.length,
    isPersonPresent: smooth.length > 0 && (validator?.validate(true) ?? true),
    timestamp,
  };
}

/* -------------------------------------------------------------------------- */
/* Confidence metrics (always finite - the UI must never print "NaN%")        */
/* -------------------------------------------------------------------------- */

/** Keypoint visibility threshold for "detected" (missing visibility = present) */
export const KEYPOINT_VISIBILITY_THRESHOLD = 0.5;

/** Count of keypoints above the visibility threshold; NaN-safe, 0 on empty */
export function countValidKeypoints(
  lms: PoseLandmark[],
  minVisibility: number = KEYPOINT_VISIBILITY_THRESHOLD
): number {
  if (!lms || lms.length === 0) return 0;
  return lms.reduce((n, lm) => n + ((lm?.visibility ?? 1) > minVisibility ? 1 : 0), 0);
}

/** Weighted person-level confidence as 0-100 (critical landmarks weigh more);
 *  NaN-safe: returns 0 on empty input or corrupt values. */
export function computeConfidencePct(lms: PoseLandmark[]): number {
  if (!lms || lms.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < lms.length; i++) {
    const w = CRITICAL_LANDMARKS[i]?.weight ?? 0.5;
    totalWeight += w;
    weightedSum += toFinite(lms[i]?.visibility, 0) * w;
  }
  const pct = totalWeight ? (weightedSum / totalWeight) * 100 : 0;
  return Number.isFinite(pct) ? pct : 0;
}

export function resetPose() { smoother?.reset(); validator?.reset(); }
export function disposePose() { if (landmarker && typeof landmarker === 'object' && 'close' in landmarker) (landmarker as any).close(); landmarker = null; smoother = null; validator = null; initialized = false; }
export function isReady(): boolean { return initialized && landmarker !== null; }
