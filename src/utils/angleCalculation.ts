import type { PoseLandmark, JointAngleConfig, PoseLandmarkIndex } from '../types/pose';

// State for Exponential Moving Average (EMA) landmark smoothing
let previousLandmarksState: PoseLandmark[] | null = null;

/**
 * Apply Exponential Moving Average (EMA) smoothing to landmarks to eliminate frame jitter
 * @param currentLandmarks Raw current frame landmarks
 * @param alpha Smoothing factor (0.0 to 1.0, higher = more responsive, lower = smoother)
 */
export function smoothLandmarksEMA(
  currentLandmarks: PoseLandmark[],
  alpha: number = 0.35
): PoseLandmark[] {
  if (!currentLandmarks || currentLandmarks.length === 0) {
    return [];
  }

  if (!previousLandmarksState || previousLandmarksState.length !== currentLandmarks.length) {
    previousLandmarksState = currentLandmarks.map((lm) => ({ ...lm }));
    return currentLandmarks;
  }

  const smoothed = currentLandmarks.map((curr, idx) => {
    const prev = previousLandmarksState![idx];
    return {
      x: alpha * curr.x + (1 - alpha) * prev.x,
      y: alpha * curr.y + (1 - alpha) * prev.y,
      z: alpha * curr.z + (1 - alpha) * prev.z,
      visibility: alpha * curr.visibility + (1 - alpha) * prev.visibility,
      presence: alpha * curr.presence + (1 - alpha) * prev.presence,
    };
  });

  previousLandmarksState = smoothed;
  return smoothed;
}

/**
 * Reset EMA smoothing state (e.g. when exercise resets or tracking lost)
 */
export function resetLandmarkSmoothing(): void {
  previousLandmarksState = null;
}


/* -------------------------------------------------------------------------- */
/* Standardized confidence & keypoint guards (NaN-safe)                       */
/* -------------------------------------------------------------------------- */

/** Structural landmark shape accepted by the 3-point angle helper.
 *  Structurally compatible with MediaPipe PoseLandmark (extra fields are fine). */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Default visibility threshold required before an angle is calculated */
export const ANGLE_MIN_VISIBILITY = 0.5;

/** True only for finite numbers (rejects NaN, Infinity, undefined, objects) */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Round an angle for telemetry; returns null for non-finite values */
export function safeRoundAngle(angle: number | null | undefined): number | null {
  return isFiniteNumber(angle) ? Math.round(angle) : null;
}

/** UI telemetry formatter - renders degrees or "N/A" fallback */
export function displayAngle(angle: number | null | undefined): string {
  const rounded = safeRoundAngle(angle);
  return rounded !== null ? `${rounded}°` : 'N/A';
}

/** Confidence & keypoint guard: keeps only landmarks above the visibility
 *  threshold; missing visibility is treated optimistically as visible (?? 1).
 *  Never returns NaN and never throws on empty/undefined input. */
export function getValidLandmarks(
  landmarks: PoseLandmark[] | null | undefined,
  minVisibility: number = ANGLE_MIN_VISIBILITY
): PoseLandmark[] {
  return landmarks?.filter((lm) => (lm?.visibility ?? 1) > minVisibility) || [];
}

/** Average visibility as a percentage (0-100). NaN-safe; 0 on empty input. */
export function getAverageVisibility(
  landmarks: PoseLandmark[] | null | undefined
): number {
  if (!landmarks || landmarks.length === 0) return 0;
  const sum = landmarks.reduce((acc, lm) => acc + (lm?.visibility || 0), 0);
  const avg = (sum / landmarks.length) * 100;
  return isFiniteNumber(avg) ? avg : 0;
}

/**
 * Null-safe 3-point joint angle (e.g. shoulder-elbow-wrist, shoulder-hip-knee).
 * Returns null unless all three keypoints exist AND exceed `minVisibility`,
 * which guarantees the state machine never receives NaN angles.
 */
export function calculate3PointAngle(
  p1?: Landmark,
  p2?: Landmark,
  p3?: Landmark,
  minVisibility: number = ANGLE_MIN_VISIBILITY
): number | null {
  if (!p1 || !p2 || !p3) return null;

  // Coordinate hygiene - corrupt/partial landmarks must not yield NaN angles
  if (
    !isFiniteNumber(p1.x) || !isFiniteNumber(p1.y) ||
    !isFiniteNumber(p2.x) || !isFiniteNumber(p2.y) ||
    !isFiniteNumber(p3.x) || !isFiniteNumber(p3.y)
  ) {
    return null;
  }

  // Confidence gate - all three keypoints must exceed the visibility threshold
  if (
    (p1.visibility ?? 1) < minVisibility ||
    (p2.visibility ?? 1) < minVisibility ||
    (p3.visibility ?? 1) < minVisibility
  ) {
    return null;
  }

  const radians =
    Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;

  return Math.round(angle);
}

/**
 * Calculate the angle between three 2D points
 */

/**
 * Calculate the angle between three 2D points
 */
export function calculateAngle2D(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): number {
  // Reject non-finite coordinates instead of propagating NaN downstream
  if (
    !isFiniteNumber(p1.x) || !isFiniteNumber(p1.y) ||
    !isFiniteNumber(p2.x) || !isFiniteNumber(p2.y) ||
    !isFiniteNumber(p3.x) || !isFiniteNumber(p3.y)
  ) {
    return 0;
  }

  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  let cosAngle = dotProduct / (magnitude1 * magnitude2);
  cosAngle = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Calculate the angle between three 3D points
 */
export function calculateAngle3D(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  p3: { x: number; y: number; z: number }
): number {
  // Reject non-finite coordinates instead of propagating NaN downstream
  if (
    !isFiniteNumber(p1.x) || !isFiniteNumber(p1.y) || !isFiniteNumber(p1.z) ||
    !isFiniteNumber(p2.x) || !isFiniteNumber(p2.y) || !isFiniteNumber(p2.z) ||
    !isFiniteNumber(p3.x) || !isFiniteNumber(p3.y) || !isFiniteNumber(p3.z)
  ) {
    return 0;
  }

  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };

  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 0;

  let cosAngle = dotProduct / (mag1 * mag2);
  cosAngle = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Calculate the angle between three landmarks with occlusion threshold checks.
 * Routes through the standardized null-safe helper so corrupt, missing, or
 * low-visibility keypoints return null instead of NaN.
 */
export function getLandmarkAngle(
  landmarks: PoseLandmark[],
  config: JointAngleConfig,
  minVisibility: number = ANGLE_MIN_VISIBILITY
): number | null {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  return calculate3PointAngle(
    landmarks[config.start],
    landmarks[config.mid],
    landmarks[config.end],
    minVisibility
  );
}

/**
 * Calculate hip alignment angle (plank / push-up form) with fallback to visible side
 */
export function getHipShoulderAngle(
  landmarks: PoseLandmark[],
  side: 'left' | 'right'
): number | null {
  const shoulderIdx = side === 'left' ? 11 : 12;
  const hipIdx = side === 'left' ? 23 : 24;
  const kneeIdx = side === 'left' ? 25 : 26;

  const angle = getLandmarkAngle(landmarks, {
    start: shoulderIdx as PoseLandmarkIndex,
    mid: hipIdx as PoseLandmarkIndex,
    end: kneeIdx as PoseLandmarkIndex,
  });

  if (angle !== null) return angle;

  // Fallback to opposite side if primary side is occluded
  const altSide = side === 'left' ? 'right' : 'left';
  const altShoulder = altSide === 'left' ? 11 : 12;
  const altHip = altSide === 'left' ? 23 : 24;
  const altKnee = altSide === 'left' ? 25 : 26;

  return getLandmarkAngle(landmarks, {
    start: altShoulder as PoseLandmarkIndex,
    mid: altHip as PoseLandmarkIndex,
    end: altKnee as PoseLandmarkIndex,
  });
}

/**
 * Calculate elbow angle for specified side with occlusion fallback
 */
export function getElbowAngle(
  landmarks: PoseLandmark[],
  side: 'left' | 'right'
): number | null {
  const shoulderIdx = side === 'left' ? 11 : 12;
  const elbowIdx = side === 'left' ? 13 : 14;
  const wristIdx = side === 'left' ? 15 : 16;

  const angle = getLandmarkAngle(landmarks, {
    start: shoulderIdx as PoseLandmarkIndex,
    mid: elbowIdx as PoseLandmarkIndex,
    end: wristIdx as PoseLandmarkIndex,
  });

  if (angle !== null) return angle;

  // Fallback to opposite side if primary arm is occluded
  const altShoulder = side === 'left' ? 12 : 11;
  const altElbow = side === 'left' ? 14 : 13;
  const altWrist = side === 'left' ? 16 : 15;

  return getLandmarkAngle(landmarks, {
    start: altShoulder as PoseLandmarkIndex,
    mid: altElbow as PoseLandmarkIndex,
    end: altWrist as PoseLandmarkIndex,
  });
}

/**
 * Get average elbow angle from both sides with occlusion tolerance
 */
export function getAverageElbowAngle(landmarks: PoseLandmark[]): number | null {
  const leftAngle = getElbowAngle(landmarks, 'left');
  const rightAngle = getElbowAngle(landmarks, 'right');

  if (leftAngle === null && rightAngle === null) return null;
  if (leftAngle === null) return rightAngle;
  if (rightAngle === null) return leftAngle;

  return (leftAngle + rightAngle) / 2;
}

/**
 * Get midpoint between two landmarks
 */
export function getLandmarkMidpoint(
  landmarks: PoseLandmark[],
  idx1: PoseLandmarkIndex,
  idx2: PoseLandmarkIndex
): { x: number; y: number; z: number } | null {
  const p1 = landmarks[idx1];
  const p2 = landmarks[idx2];

  if (!p1 || !p2 || (p1.visibility ?? 0) < 0.4 || (p2.visibility ?? 0) < 0.4) {
    return null;
  }

  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  };
}

/**
 * Calculate Euclidean distance between two landmarks
 */
export function getLandmarkDistance(
  landmarks: PoseLandmark[],
  idx1: PoseLandmarkIndex,
  idx2: PoseLandmarkIndex
): number | null {
  const p1 = landmarks[idx1];
  const p2 = landmarks[idx2];

  if (!p1 || !p2 || (p1.visibility ?? 0) < 0.4 || (p2.visibility ?? 0) < 0.4) {
    return null;
  }

  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Determine push-up position based on elbow angle
 */
export function getPushupPosition(angle: number | null): 'top' | 'mid' | 'bottom' | 'unknown' {
  if (angle === null || angle === undefined) return 'unknown';
  if (angle >= 155) return 'top';
  if (angle <= 105) return 'bottom';
  return 'mid';
}
