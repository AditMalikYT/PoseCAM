import type { PoseLandmark } from '../types/pose';
import type {
  CameraSetupStatus,
  FaultCode,
  FormMetrics,
  FormPhase,
  FormStatus,
  GuidanceExercise,
  JointLevel,
} from '../types/formAnalyzer';
import {
  FAULT_SEVERITY,
  FAULT_TEXT,
  FORM_JOINT_COLORS,
  FORM_THRESHOLDS,
} from '../types/formAnalyzer';
import {
  calculate3PointAngle,
  getAverageElbowAngle,
  getHipShoulderAngle,
} from './angleCalculation';

/* -------------------------------------------------------------------------- */
/* Low-level geometry helpers (all null-safe, mirror angleCalculation style)  */
/* -------------------------------------------------------------------------- */

const MIN_VIS = 0.5;

function vis(lm?: PoseLandmark): number {
  return lm?.visibility ?? 0;
}

function ok(lm?: PoseLandmark): lm is PoseLandmark {
  return !!lm && vis(lm) >= MIN_VIS && Number.isFinite(lm.x) && Number.isFinite(lm.y);
}

function midpoint(
  a?: PoseLandmark,
  b?: PoseLandmark
): { x: number; y: number; z: number } | null {
  if (!ok(a) || !ok(b)) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function dist2D(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null
): number {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Signed offset of the hip midpoint from the shoulder->ankle body line,
 * normalized by torso length. Gravity-referenced (screen-y): positive = hip
 * BELOW the line (sagging), negative = ABOVE the line (piking). Robust to
 * which way the body faces, since it compares y positions, not cross-product
 * orientation. Near-vertical body lines (pull-up hang) fall back to the
 * lateral deviation magnitude.
 */
function hipLineOffset(
  shoulder: { x: number; y: number } | null,
  hip: { x: number; y: number } | null,
  ankle: { x: number; y: number } | null,
  torsoLen: number
): number | null {
  if (!shoulder || !hip || !ankle || torsoLen < 1e-6) return null;
  const dx = ankle.x - shoulder.x;
  const dy = ankle.y - shoulder.y;
  const lineLen = Math.hypot(dx, dy);
  if (lineLen < 1e-6) return null;
  if (Math.abs(dx) > 1e-4) {
    // Y of the body line at the hip's x, then sag = hip below that line
    const lineY = shoulder.y + (hip.x - shoulder.x) * (dy / dx);
    return (hip.y - lineY) / torsoLen;
  }
  // Near-vertical line: use lateral (cross-product) deviation instead
  const cross = dx * (hip.y - shoulder.y) - dy * (hip.x - shoulder.x);
  return cross / lineLen / torsoLen;
}

/** Average knee angle across visible sides (null if neither side tracked). */
function averageKneeAngle(lms: PoseLandmark[]): number | null {
  const left = calculate3PointAngle(lms[23], lms[25], lms[27]);
  const right = calculate3PointAngle(lms[24], lms[26], lms[28]);
  if (left !== null && right !== null) return (left + right) / 2;
  return left ?? right;
}

/** Average hip-line (shoulder-hip-knee) angle across visible sides. */
function averageHipLineAngle(lms: PoseLandmark[]): number | null {
  const left = getHipShoulderAngle(lms, 'left');
  const right = getHipShoulderAngle(lms, 'right');
  if (left !== null && right !== null) return (left + right) / 2;
  return left ?? right;
}


/* -------------------------------------------------------------------------- */
/* Camera Placement Analysis (onboarding + AR bounding zone)                  */
/* -------------------------------------------------------------------------- */

/**
 * Estimate camera placement quality for the selected exercise:
 * side-profile requirement (push-ups, 30-90deg), facing-the-bar framing
 * (pull-ups), distance and centering.
 */
export function analyzeCameraSetup(
  exercise: GuidanceExercise,
  landmarks: PoseLandmark[]
): CameraSetupStatus {
  const empty: CameraSetupStatus = {
    isReady: false,
    warnings: ['Step into the camera frame'],
    viewAngleDeg: null,
    framingRatio: null,
    inZone: false,
  };
  if (!landmarks || landmarks.length < 33) return empty;

  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];
  const lHip = landmarks[23];
  const rHip = landmarks[24];
  const lAnkle = landmarks[27];
  const rAnkle = landmarks[28];
  const nose = landmarks[0];
  const lWrist = landmarks[15];
  const rWrist = landmarks[16];

  const visibleCount = landmarks.filter((lm) => vis(lm) >= MIN_VIS).length;
  if (visibleCount < 8 || !ok(lShoulder) || !ok(rShoulder) || !ok(lHip) || !ok(rHip)) {
    return empty;
  }

  const shoulderMid = midpoint(lShoulder, rShoulder)!;
  const hipMid = midpoint(lHip, rHip)!;
  const ankleMid = midpoint(lAnkle, rAnkle);
  const torsoLen = Math.max(dist2D(shoulderMid, hipMid), 1e-6);

  // Body yaw estimate: 2D shoulder spread shrinks as the user turns to a
  // side profile. ratio ~1 => facing camera (0deg), ratio ~0.15 => profile.
  const shoulderSpread = dist2D(lShoulder, rShoulder);
  const spreadRatio = Math.min(shoulderSpread / torsoLen, 1);
  const viewAngleDeg = Math.round(90 * (1 - spreadRatio));

  const warnings: string[] = [];
  let framingRatio: number | null = null;

  // Bounding box of tracked body (framing / distance)
  const pts = [lShoulder, rShoulder, lHip, rHip, lAnkle, rAnkle, nose].filter(ok) as PoseLandmark[];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const touchesEdge = minX < 0.04 || maxX > 0.96 || minY < 0.04 || maxY > 0.96;

  if (exercise === 'pushups') {
    // Horizontal body: frame width carries the silhouette
    framingRatio = Math.min(maxX - minX, 1);
    if (viewAngleDeg < 30) {
      warnings.push('Turn to your side for push-ups');
    }
    if (framingRatio < 0.45) {
      warnings.push('Move the camera closer - body too small');
    } else if (touchesEdge) {
      warnings.push('Move the camera back - body is cut off');
    }
    if (!ankleMid) {
      warnings.push('Make sure your legs are fully in frame');
    }
  } else {
    // Vertical body: frame height carries the silhouette
    const headY = ok(nose) ? nose.y : minY;
    const feetY = ankleMid ? ankleMid.y : maxY;
    framingRatio = Math.max(feetY - headY, 0);
    if (ok(nose) && nose.y < 0.08) {
      warnings.push('Step back 2 feet - head is cut off');
    } else if (ok(rAnkle) && rAnkle.y > 0.96) {
      warnings.push('Step back 2 feet - feet are cut off');
    } else if (framingRatio < 0.5) {
      warnings.push('Step closer to the camera');
    }
    if (!ok(lWrist) && !ok(rWrist)) {
      warnings.push('Raise your arms - hands must be visible on the bar');
    }
  }

  if (Math.abs(centerX - 0.5) > 0.18) {
    warnings.push('Center yourself in the frame');
  }

  const inZone = warnings.length === 0;
  return { isReady: inZone, warnings, viewAngleDeg, framingRatio, inZone };
}


/* -------------------------------------------------------------------------- */
/* FormAnalyzer Engine                                                        */
/* -------------------------------------------------------------------------- */

/** Runtime debounce tracker for a fault code. */
interface FaultRuntime {
  frames: number;   // consecutive frames the raw condition held
  untilTs: number;  // transient faults (cycle verdicts) stay surfaced until ts
}

const CYCLE_FAULT_TTL_MS = 2500;

const PHASE_CUES: Record<GuidanceExercise, Record<FormPhase, string>> = {
  pushups: {
    SETUP: 'Hold a strong plank - elbows locked',
    ECCENTRIC: 'Lower your chest',
    BOTTOM: 'Chest to floor - hold',
    CONCENTRIC: 'Drive up - push the floor away',
  },
  pullups: {
    SETUP: 'Dead hang - full lockout',
    ECCENTRIC: 'Lower with control',
    BOTTOM: 'Full lockout - reset',
    CONCENTRIC: 'Drive chin above bar',
  },
};

export class FormAnalyzer {
  readonly exercise: GuidanceExercise;

  private phase: FormPhase = 'SETUP';
  private phaseEnteredAt = 0;

  // Rep-cycle bookkeeping
  private cycleActive = false;
  private cycleDepthReached = false;
  private cycleStartedAt = 0;
  private cycleJustClosed = false;
  private cycleJustClosedHadDepth = false;

  // Debounced fault runtime
  private faultRuntime = new Map<FaultCode, FaultRuntime>();

  // Pull-up calibration (bar level + hang baseline)
  private barYSamples: number[] = [];
  private barY: number | null = null;
  private hangAnkleX: number | null = null;
  private shoulderWidth: number | null = null;

  // Setup-warning debounce
  private setupWarningFrames = new Map<string, number>();
  private stableSetupWarnings: string[] = [];

  private lastStatus: FormStatus | null = null;

  constructor(exercise: GuidanceExercise) {
    this.exercise = exercise;
  }

  /** Reset phase/cycle state. `hard` also clears calibration + faults. */
  reset(hard = false): void {
    this.phase = 'SETUP';
    this.phaseEnteredAt = 0;
    this.cycleActive = false;
    this.cycleDepthReached = false;
    this.cycleStartedAt = 0;
    this.cycleJustClosed = false;
    this.cycleJustClosedHadDepth = false;
    this.faultRuntime.clear();
    if (hard) {
      this.barYSamples = [];
      this.barY = null;
      this.hangAnkleX = null;
      this.shoulderWidth = null;
      this.setupWarningFrames.clear();
      this.stableSetupWarnings = [];
      this.lastStatus = null;
    }
  }

  get currentPhase(): FormPhase {
    return this.phase;
  }

  get lastFormStatus(): FormStatus | null {
    return this.lastStatus;
  }

  /* ---------------------------------------------------------------------- */
  /* Main entry: feed MediaPipe landmarks, get a FormStatus                  */
  /* ---------------------------------------------------------------------- */
  update(landmarks: PoseLandmark[], timestamp: number): FormStatus {
    this.cycleJustClosed = false;

    if (!landmarks || landmarks.length < 33) {
      return this.neutralStatus();
    }

    /* ---- 1. Measurements (all null-safe) ---- */
    const elbowAngle = getAverageElbowAngle(landmarks);
    const hipLineAngle = averageHipLineAngle(landmarks);
    const kneeAngle = averageKneeAngle(landmarks);

    const shoulderMid = midpoint(landmarks[11], landmarks[12]);
    const hipMid = midpoint(landmarks[23], landmarks[24]);
    const ankleMid = midpoint(landmarks[27], landmarks[28]);
    const nose = landmarks[0];
    const avgWristY = this.avgWristY(landmarks);
    const avgAnkleX = this.avgX(landmarks[27], landmarks[28]);
    const torsoLen = Math.max(dist2D(shoulderMid, hipMid), 1e-6);
    const offset = hipLineOffset(shoulderMid, hipMid, ankleMid, torsoLen);

    const metrics: FormMetrics = {
      elbowAngle,
      hipLineAngle,
      hipLineOffset: offset,
      kneeAngle,
      chinClearsBar: null,
      kneeSwing: null,
      formScore: 0,
    };

    /* ---- 2. Calibration (pull-ups) ---- */
    this.updateCalibration(landmarks, elbowAngle, avgWristY, avgAnkleX);

    if (this.exercise === 'pullups' && this.barY !== null && ok(nose)) {
      metrics.chinClearsBar = nose.y < this.barY - FORM_THRESHOLDS.PULLUP.CHIN_CLEAR_MARGIN;
    }
    if (this.exercise === 'pullups' && this.hangAnkleX !== null && avgAnkleX !== null && this.shoulderWidth) {
      metrics.kneeSwing = Math.abs(avgAnkleX - this.hangAnkleX) / this.shoulderWidth;
    }

    /* ---- 3. Phase state machine ---- */
    if (this.exercise === 'pushups') {
      this.stepPushup(elbowAngle, hipLineAngle, offset, timestamp);
    } else {
      this.stepPullup(elbowAngle, timestamp);
    }

    /* ---- 4. Fault detection + debounce ---- */
    this.evaluateFaults(metrics, timestamp);
    const activeCodes = this.collectActiveCodes(timestamp);

    /* ---- 5. Keypoint color coding (green/yellow/red) ---- */
    const { jointColors, jointLevels } = this.computeJointColors(metrics, activeCodes);

    /* ---- 6. Score + cue ---- */
    let score = 100;
    for (const code of activeCodes) {
      score -= FAULT_SEVERITY[code] === 'critical' ? 25 : 12;
    }
    metrics.formScore = Math.max(0, Math.min(100, Math.round(score)));

    const cue = this.buildCue(activeCodes);

    /* ---- 7. Camera setup analysis (debounced) ---- */
    const setup = this.debouncedSetup(landmarks, timestamp);

    const status: FormStatus = {
      isValidForm: !activeCodes.some((c) => FAULT_SEVERITY[c] === 'critical'),
      currentPhase: this.phase,
      faults: activeCodes.map((c) => FAULT_TEXT[c]),
      jointColors,
      faultCodes: activeCodes,
      jointLevels,
      metrics,
      setup,
      cue,
      repCycleComplete: this.cycleJustClosed,
      depthReached: this.cycleJustClosed ? this.cycleJustClosedHadDepth : this.cycleDepthReached,
      phaseTimeMs: this.phaseEnteredAt ? timestamp - this.phaseEnteredAt : 0,
    };

    this.lastStatus = status;
    return status;
  }


  /* ---------------------------------------------------------------------- */
  /* Private: neutral frame (no tracking)                                    */
  /* ---------------------------------------------------------------------- */
  private neutralStatus(): FormStatus {
    return {
      isValidForm: false,
      currentPhase: this.phase,
      faults: [],
      jointColors: {},
      faultCodes: [],
      jointLevels: {},
      metrics: {
        elbowAngle: null,
        hipLineAngle: null,
        hipLineOffset: null,
        kneeAngle: null,
        chinClearsBar: null,
        kneeSwing: null,
        formScore: 0,
      },
      setup: {
        isReady: false,
        warnings: ['Step into the camera frame'],
        viewAngleDeg: null,
        framingRatio: null,
        inZone: false,
      },
      cue: 'Step into the camera frame',
      repCycleComplete: false,
      depthReached: false,
      phaseTimeMs: 0,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Private: measurement helpers                                            */
  /* ---------------------------------------------------------------------- */
  private avgWristY(lms: PoseLandmark[]): number | null {
    const l = ok(lms[15]) ? lms[15].y : null;
    const r = ok(lms[16]) ? lms[16].y : null;
    if (l !== null && r !== null) return (l + r) / 2;
    return l ?? r;
  }

  private avgX(a?: PoseLandmark, b?: PoseLandmark): number | null {
    const av = ok(a) ? a.x : null;
    const bv = ok(b) ? b.x : null;
    if (av !== null && bv !== null) return (av + bv) / 2;
    return av ?? bv;
  }

  /**
   * Pull-up calibration: while in a stable dead hang (elbow >= hang
   * threshold) record the wrist height as the bar level and the ankle x as
   * the kipping baseline. Trimmed rolling window keeps it jitter-free.
   */
  private updateCalibration(
    lms: PoseLandmark[],
    elbowAngle: number | null,
    avgWristY: number | null,
    avgAnkleX: number | null
  ): void {
    if (this.exercise !== 'pullups') return;

    if (this.shoulderWidth === null && ok(lms[11]) && ok(lms[12])) {
      this.shoulderWidth = Math.max(Math.abs(lms[11].x - lms[12].x), 0.08);
    }

    const hangOk = elbowAngle !== null && elbowAngle >= FORM_THRESHOLDS.PULLUP.HANG_ELBOW_MIN;
    if (hangOk && avgWristY !== null && avgWristY > 0.02 && avgWristY < 0.98) {
      this.barYSamples.push(avgWristY);
      if (this.barYSamples.length > 30) this.barYSamples.shift();
      const sorted = [...this.barYSamples].sort((a, b) => a - b);
      const trim = Math.floor(sorted.length * 0.2);
      const window = sorted.slice(trim, sorted.length - trim || undefined);
      this.barY = window.reduce((s, v) => s + v, 0) / Math.max(window.length, 1);
    }
    if (hangOk && avgAnkleX !== null) {
      this.hangAnkleX = this.hangAnkleX === null ? avgAnkleX : this.hangAnkleX * 0.9 + avgAnkleX * 0.1;
    }
  }


  /* ---------------------------------------------------------------------- */
  /* Private: phase state machines                                           */
  /* ---------------------------------------------------------------------- */
  private enterPhase(phase: FormPhase, timestamp: number): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.phaseEnteredAt = timestamp;
  }

  /** Push-up FSM: SETUP -> ECCENTRIC -> BOTTOM -> CONCENTRIC -> SETUP */
  private stepPushup(
    elbowAngle: number | null,
    hipLineAngle: number | null,
    offset: number | null,
    timestamp: number
  ): void {
    const T = FORM_THRESHOLDS.PUSHUP;
    if (elbowAngle === null) return;
    // Loose plank gate: the torso must roughly form a line before a rep counts
    const isPlank = (hipLineAngle === null || hipLineAngle >= T.BODY_LINE_MIN - 30) &&
      (offset === null || offset < 0.25);

    switch (this.phase) {
      case 'SETUP':
        if (!this.cycleActive && elbowAngle >= T.TOP_ELBOW_MIN && isPlank) {
          this.cycleActive = true;
          this.cycleDepthReached = false;
          this.cycleStartedAt = timestamp;
        }
        if (elbowAngle < T.TOP_ELBOW_MIN && this.cycleActive) {
          this.enterPhase('ECCENTRIC', timestamp);
        }
        break;

      case 'ECCENTRIC':
        if (elbowAngle <= T.BOTTOM_ELBOW_MAX) {
          this.cycleDepthReached = true;
          this.enterPhase('BOTTOM', timestamp);
        } else if (elbowAngle >= T.TOP_ELBOW_MIN) {
          // Aborted descent back to lockout - cycle closes without depth
          this.closeCycle(timestamp);
        }
        break;

      case 'BOTTOM':
        if (elbowAngle >= T.BOTTOM_ELBOW_MAX + T.BOTTOM_EXIT_HYSTERESIS) {
          this.enterPhase('CONCENTRIC', timestamp);
        }
        break;

      case 'CONCENTRIC':
        if (elbowAngle >= T.TOP_ELBOW_MIN) {
          this.closeCycle(timestamp);
        }
        break;
    }
  }

  /** Pull-up FSM: SETUP(hang) -> CONCENTRIC(pull) -> ECCENTRIC(lower) -> BOTTOM(hang) */
  private stepPullup(elbowAngle: number | null, timestamp: number): void {
    const T = FORM_THRESHOLDS.PULLUP;
    if (elbowAngle === null) return;

    switch (this.phase) {
      case 'SETUP':
        if (!this.cycleActive && elbowAngle >= T.HANG_ELBOW_MIN) {
          this.cycleActive = true;
          this.cycleDepthReached = false;
          this.cycleStartedAt = timestamp;
        }
        if (elbowAngle < T.HANG_ELBOW_MIN && this.cycleActive) {
          this.enterPhase('CONCENTRIC', timestamp);
        }
        break;

      case 'CONCENTRIC':
        if (elbowAngle <= T.TOP_ELBOW_MAX) {
          this.cycleDepthReached = true;
          this.enterPhase('ECCENTRIC', timestamp);
        }
        break;

      case 'ECCENTRIC':
        if (elbowAngle >= T.TOP_ELBOW_MAX + T.TOP_EXIT_HYSTERESIS) {
          this.enterPhase('BOTTOM', timestamp);
        }
        break;

      case 'BOTTOM':
        if (elbowAngle >= T.HANG_ELBOW_MIN) {
          this.closeCycle(timestamp);
        }
        break;
    }
  }

  /** Full cycle closed (returned to the starting pose). */
  private closeCycle(timestamp: number): void {
    if (this.cycleActive && !this.cycleDepthReached) {
      // Cycle-level verdict fault: partial rep
      const code: FaultCode = this.exercise === 'pushups' ? 'PARTIAL_DEPTH' : 'PARTIAL_RANGE';
      this.faultRuntime.set(code, {
        frames: FORM_THRESHOLDS.FAULT_DEBOUNCE_FRAMES,
        untilTs: timestamp + CYCLE_FAULT_TTL_MS,
      });
    }
    if (this.exercise === 'pushups' && this.cycleActive && this.cycleDepthReached) {
      const cycleMs = timestamp - this.cycleStartedAt;
      if (cycleMs > 0 && cycleMs < FORM_THRESHOLDS.PUSHUP.MIN_DESCENT_MS * 3) {
        this.faultRuntime.set('TOO_FAST', {
          frames: FORM_THRESHOLDS.FAULT_DEBOUNCE_FRAMES,
          untilTs: timestamp + CYCLE_FAULT_TTL_MS,
        });
      }
    }
    this.cycleActive = false;
    this.cycleJustClosedHadDepth = this.cycleDepthReached;
    this.cycleDepthReached = false;
    this.cycleStartedAt = 0;
    this.cycleJustClosed = true;
    this.enterPhase('SETUP', timestamp);
  }


  /* ---------------------------------------------------------------------- */
  /* Private: fault evaluation (raw conditions + debounce counters)          */
  /* ---------------------------------------------------------------------- */
  private evaluateFaults(metrics: FormMetrics, timestamp: number): void {
    const T = FORM_THRESHOLDS;
    const bump = (code: FaultCode, condition: boolean): void => {
      const rt = this.faultRuntime.get(code) ?? { frames: 0, untilTs: 0 };
      rt.frames = condition ? rt.frames + 1 : 0;
      if (rt.untilTs < timestamp) rt.untilTs = 0;
      this.faultRuntime.set(code, rt);
    };

    if (this.exercise === 'pushups') {
      const hip = metrics.hipLineAngle;
      const offset = metrics.hipLineOffset;
      bump(
        'HIPS_SAGGING',
        (hip !== null && hip < T.PUSHUP.HIP_SAG_ANGLE) || (offset !== null && offset > 0.14)
      );
      bump(
        'BODY_LINE_BREAK',
        (hip !== null && hip >= T.PUSHUP.HIP_SAG_ANGLE && hip < T.PUSHUP.BODY_LINE_MIN) ||
          (offset !== null && offset > 0.06 && offset <= 0.14)
      );
      bump('HIPS_PIKING', offset !== null && offset < -0.14);
    } else {
      const kipping =
        (metrics.kneeSwing !== null && metrics.kneeSwing > T.PULLUP.KIPPING_SWING_X) ||
        (metrics.kneeAngle !== null &&
          metrics.kneeAngle < T.PULLUP.KNEE_TUCK_ANGLE &&
          this.phase !== 'SETUP');
      bump('KIPPING', kipping);
      bump(
        'CHIN_NOT_CLEAR',
        this.phase === 'CONCENTRIC' &&
          metrics.elbowAngle !== null &&
          metrics.elbowAngle <= T.PULLUP.TOP_ELBOW_MAX &&
          metrics.chinClearsBar === false
      );
    }
  }

  /** Codes currently surfaced: debounced conditions + unexpired cycle verdicts. */
  private collectActiveCodes(timestamp: number): FaultCode[] {
    const active: FaultCode[] = [];
    for (const [code, rt] of this.faultRuntime) {
      const debounced = rt.frames >= FORM_THRESHOLDS.FAULT_DEBOUNCE_FRAMES;
      const transient = rt.untilTs > timestamp && rt.frames >= FORM_THRESHOLDS.FAULT_DEBOUNCE_FRAMES;
      if (debounced || transient) active.push(code);
    }
    return active;
  }


  /* ---------------------------------------------------------------------- */
  /* Private: green/yellow/red keypoint color mapping                        */
  /* ---------------------------------------------------------------------- */
  private computeJointColors(
    metrics: FormMetrics,
    activeCodes: FaultCode[]
  ): { jointColors: Record<string, string>; jointLevels: Record<string, JointLevel> } {
    const T = FORM_THRESHOLDS;
    const jointColors: Record<string, string> = {};
    const jointLevels: Record<string, JointLevel> = {};

    const setGroup = (indices: number[], level: JointLevel): void => {
      const hex =
        level === 'green' ? FORM_JOINT_COLORS.GREEN
        : level === 'yellow' ? FORM_JOINT_COLORS.YELLOW
        : FORM_JOINT_COLORS.RED;
      for (const i of indices) {
        jointLevels[String(i)] = level;
        jointColors[String(i)] = hex;
      }
    };

    const levelFromAngle = (
      angle: number | null,
      greenCheck: (a: number) => boolean,
      yellowCheck: (a: number) => boolean
    ): JointLevel => {
      if (angle === null) return 'green'; // unknown -> neutral, visibility handles rendering
      if (greenCheck(angle)) return 'green';
      if (yellowCheck(angle)) return 'yellow';
      return 'red';
    };

    if (this.exercise === 'pushups') {
      // Elbows follow depth/lockout criteria
      const elbowLevel = levelFromAngle(
        metrics.elbowAngle,
        (a) =>
          (this.phase === 'BOTTOM' && a <= T.PUSHUP.BOTTOM_ELBOW_MAX) ||
          (this.phase !== 'BOTTOM' && a >= T.PUSHUP.TOP_ELBOW_MIN) ||
          (this.phase === 'ECCENTRIC' && a > T.PUSHUP.BOTTOM_ELBOW_MAX),
        (a) =>
          this.phase === 'BOTTOM'
            ? a <= T.PUSHUP.BOTTOM_ELBOW_MAX + T.PUSHUP.WARN_BAND
            : a >= T.PUSHUP.TOP_ELBOW_MIN - T.PUSHUP.WARN_BAND
      );
      // Body line drives hips/shoulders/legs
      const lineLevel = levelFromAngle(
        metrics.hipLineAngle,
        (a) => a >= T.PUSHUP.BODY_LINE_MIN,
        (a) => a >= T.PUSHUP.HIP_SAG_ANGLE
      );
      setGroup([13, 14], elbowLevel);
      setGroup([11, 12, 23, 24, 25, 26, 27, 28], lineLevel);
      setGroup([15, 16, 0], 'green');
    } else {
      const kipping = activeCodes.includes('KIPPING');
      const chinFault = activeCodes.includes('CHIN_NOT_CLEAR');
      const hanging = this.phase === 'SETUP' || this.phase === 'BOTTOM';
      const elbowLevel = levelFromAngle(
        metrics.elbowAngle,
        (a) => (hanging ? a >= T.PULLUP.HANG_ELBOW_MIN : a <= T.PULLUP.TOP_ELBOW_MAX + 15),
        (a) => (hanging ? a >= T.PULLUP.HANG_ELBOW_MIN - 12 : a <= T.PULLUP.TOP_ELBOW_MAX + 30)
      );
      const legLevel: JointLevel = kipping
        ? 'red'
        : metrics.kneeSwing !== null && metrics.kneeSwing > 0.45
          ? 'yellow'
          : 'green';
      // Head: below-bar is normal at hang; only flag while actively pulling
      const pullingNow = this.phase === 'CONCENTRIC' || this.phase === 'ECCENTRIC';
      const headLevel: JointLevel = chinFault
        ? 'red'
        : pullingNow && metrics.chinClearsBar === false
          ? 'yellow'
          : 'green';
      setGroup([13, 14, 15, 16], elbowLevel);
      setGroup([23, 24, 25, 26, 27, 28], legLevel);
      setGroup([0], headLevel);
      setGroup([11, 12], 'green');
    }

    return { jointColors, jointLevels };
  }


  /* ---------------------------------------------------------------------- */
  /* Private: dynamic textual cue                                            */
  /* ---------------------------------------------------------------------- */
  private buildCue(activeCodes: FaultCode[]): string {
    if (activeCodes.includes('KIPPING')) return 'Stop leg swings - strict only';
    if (activeCodes.includes('HIPS_SAGGING')) return 'Keep hips straight';
    if (activeCodes.includes('HIPS_PIKING')) return 'Drop your hips - straight line';
    if (activeCodes.includes('CHIN_NOT_CLEAR')) return 'Drive chin above bar';
    if (activeCodes.includes('PARTIAL_DEPTH')) return 'Go deeper - chest to floor';
    if (activeCodes.includes('PARTIAL_RANGE')) return 'Pull higher - chin over bar';
    if (activeCodes.includes('TOO_FAST')) return 'Slow down - control the tempo';
    if (activeCodes.includes('BODY_LINE_BREAK')) return 'Keep body in a straight line';
    return PHASE_CUES[this.exercise][this.phase];
  }

  /* ---------------------------------------------------------------------- */
  /* Private: debounced camera-setup warnings                                */
  /* ---------------------------------------------------------------------- */
  private debouncedSetup(landmarks: PoseLandmark[], timestamp: number): CameraSetupStatus {
    void timestamp;
    const raw = analyzeCameraSetup(this.exercise, landmarks);

    // Count consecutive frames per warning text; surface stable ones only
    const seen = new Set(raw.warnings);
    for (const [text, frames] of this.setupWarningFrames) {
      if (seen.has(text)) {
        this.setupWarningFrames.set(text, frames + 1);
      } else {
        this.setupWarningFrames.delete(text);
      }
    }
    for (const text of raw.warnings) {
      if (!this.setupWarningFrames.has(text)) this.setupWarningFrames.set(text, 1);
    }

    this.stableSetupWarnings = [...this.setupWarningFrames.entries()]
      .filter(([, frames]) => frames >= FORM_THRESHOLDS.SETUP_DEBOUNCE_FRAMES)
      .map(([text]) => text);

    return {
      ...raw,
      warnings: this.stableSetupWarnings,
      isReady: this.stableSetupWarnings.length === 0 && raw.isReady,
      inZone: this.stableSetupWarnings.length === 0 && raw.isReady,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Module-level convenience API                                               */
/* -------------------------------------------------------------------------- */

const analyzerCache = new Map<GuidanceExercise, FormAnalyzer>();

/** Create (or reuse) a FormAnalyzer for the given exercise. */
export function createFormAnalyzer(exercise: GuidanceExercise): FormAnalyzer {
  let analyzer = analyzerCache.get(exercise);
  if (!analyzer) {
    analyzer = new FormAnalyzer(exercise);
    analyzerCache.set(exercise, analyzer);
  }
  return analyzer;
}

/**
 * Convenience wrapper (spec deliverable signature): accepts MediaPipe
 * landmark arrays and returns a real-time FormStatus. Internally reuses a
 * per-exercise analyzer so phase/debounce state persists across calls.
 */
export function analyzeForm(
  exercise: GuidanceExercise,
  landmarks: PoseLandmark[],
  timestamp: number = performance.now()
): FormStatus {
  return createFormAnalyzer(exercise).update(landmarks, timestamp);
}







