import type { ExerciseType } from './exercise';

/* -------------------------------------------------------------------------- */
/* AR Form & Pose Guidance System - Type Definitions                          */
/* -------------------------------------------------------------------------- */

/** Real-time form phase (mirrors the rep FSM vocabulary). */
export type FormPhase = 'SETUP' | 'ECCENTRIC' | 'BOTTOM' | 'CONCENTRIC';

/** Machine-readable fault identifiers (human text lives in FAULT_TEXT). */
export type FaultCode =
  | 'HIPS_SAGGING'
  | 'HIPS_PIKING'
  | 'BODY_LINE_BREAK'
  | 'PARTIAL_DEPTH'
  | 'PARTIAL_RANGE'
  | 'NO_LOCKOUT'
  | 'KIPPING'
  | 'CHIN_NOT_CLEAR'
  | 'TOO_FAST'
  | 'COLLAPSED_SHOULDERS';

export type FaultSeverity = 'critical' | 'warning';

/** Spec-level biomechanical thresholds (degrees / normalized units). */
export const FORM_THRESHOLDS = {
  PUSHUP: {
    /** Starting pose: arms fully extended (elbow angle >= 160deg) */
    TOP_ELBOW_MIN: 160,
    /** Bottom phase: full depth (elbow angle <= 90deg) */
    BOTTOM_ELBOW_MAX: 90,
    /** Body straight: shoulder-hip-ankle line >= 160deg */
    BODY_LINE_MIN: 160,
    /** Hip sagging/arching fault line (< 150deg) */
    HIP_SAG_ANGLE: 150,
    /** Yellow band around targets (deg) before a deviation turns red */
    WARN_BAND: 12,
    /** Descent shorter than this is flagged as bouncing (ms) */
    MIN_DESCENT_MS: 300,
    /** Hysteresis when leaving BOTTOM (deg) */
    BOTTOM_EXIT_HYSTERESIS: 10,
  },
  PULLUP: {
    /** Dead hang: arms extended overhead (elbow angle >= 150deg) */
    HANG_ELBOW_MIN: 150,
    /** Top phase: elbow angle <= 60deg */
    TOP_ELBOW_MAX: 60,
    /** Exit hysteresis leaving the top position (deg) */
    TOP_EXIT_HYSTERESIS: 15,
    /** Knee bend below this while hanging = tuck/kipping (deg) */
    KNEE_TUCK_ANGLE: 120,
    /** Horizontal ankle swing (x shoulder-widths) flagged as kipping */
    KIPPING_SWING_X: 0.6,
    /** Vertical hip travel (x shoulder-widths) flagged as kipping */
    KIPPING_HIP_Y: 0.35,
    /** Chin clearance margin above calibrated bar level (normalized y) */
    CHIN_CLEAR_MARGIN: 0.02,
  },
  /** Debounce: consecutive frames a fault must persist before surfacing */
  FAULT_DEBOUNCE_FRAMES: 5,
  /** Debounce for camera-setup warnings (frames) */
  SETUP_DEBOUNCE_FRAMES: 8,
} as const;

/** Green / Yellow / Red keypoint palette (hex). */
export const FORM_JOINT_COLORS = {
  GREEN: '#00ff88',
  YELLOW: '#ffd700',
  RED: '#ff2a6d',
} as const;

export type FormJointColor = keyof typeof FORM_JOINT_COLORS;


/** Internal per-frame biomechanical measurements (all null-safe). */
export interface FormMetrics {
  /** Average elbow angle in degrees (both arms, occlusion-tolerant) */
  elbowAngle: number | null;
  /** Shoulder-hip-knee body line angle in degrees */
  hipLineAngle: number | null;
  /**
   * Signed perpendicular offset of the hip midpoint from the shoulder->ankle
   * line, normalized by torso length. Positive = hip BELOW the line (sag),
   * negative = hip ABOVE the line (pike). ~0 = straight body.
   */
  hipLineOffset: number | null;
  /** Knee angle in degrees (used for kipping / leg tuck detection) */
  kneeAngle: number | null;
  /** Pull-ups: true when chin (nose proxy) is above the calibrated bar level */
  chinClearsBar: boolean | null;
  /** Pull-ups: horizontal ankle swing from calibrated hang, in shoulder widths */
  kneeSwing: number | null;
  /** 0-100 heuristic quality score for the current frame */
  formScore: number;
}

/** Camera placement analysis result (onboarding / AR bounding zone). */
export interface CameraSetupStatus {
  /** True when no active placement warnings remain */
  isReady: boolean;
  /** Human-readable placement instructions, e.g. "Step back 2 feet" */
  warnings: string[];
  /** Estimated body yaw relative to the camera in degrees (0 = facing, 90 = side) */
  viewAngleDeg: number | null;
  /** Body size as a fraction of the relevant frame axis (0-1) */
  framingRatio: number | null;
  /** True when the estimated body silhouette fits the AR bounding zone */
  inZone: boolean;
}

/**
 * The real-time form status contract returned by the FormAnalyzer engine.
 * (The first four fields are the required deliverable shape; the remaining
 * fields are additive telemetry for richer UI feedback.)
 */
export interface FormStatus {
  /** No critical (red-level) faults active */
  isValidForm: boolean;
  /** Current rep phase */
  currentPhase: FormPhase;
  /** Active fault strings, e.g. ["Hips sagging", "Incomplete depth"] */
  faults: string[];
  /** MediaPipe keypoint index (as string) -> hex color for skeleton overlay */
  jointColors: Record<string, string>;

  /* ---- additive telemetry (safe to ignore) ---- */
  faultCodes: FaultCode[];
  /** Joint level per keypoint index ('green' | 'yellow' | 'red') */
  jointLevels: Record<string, JointLevel>;
  metrics: FormMetrics;
  setup: CameraSetupStatus;
  /** Primary dynamic textual cue, e.g. "Lower your chest" */
  cue: string;
  /** True only on the frame a full-ROM rep cycle closes */
  repCycleComplete: boolean;
  /** True once the bottom/top criteria were met within the current rep cycle */
  depthReached: boolean;
  /** ms spent in the current phase */
  phaseTimeMs: number;
}

/** Per-joint live status used to derive keypoint colors. */
export type JointLevel = 'green' | 'yellow' | 'red';

/** Human-readable fault text (coach voice). */
export const FAULT_TEXT: Record<FaultCode, string> = {
  HIPS_SAGGING: 'Hips sagging',
  HIPS_PIKING: 'Hips piked too high',
  BODY_LINE_BREAK: 'Body line broken',
  PARTIAL_DEPTH: 'Incomplete depth',
  PARTIAL_RANGE: 'Partial rep - chin below bar',
  NO_LOCKOUT: 'No full lockout',
  KIPPING: 'Kipping detected',
  CHIN_NOT_CLEAR: 'Chin not above bar',
  TOO_FAST: 'Too fast - control the tempo',
  COLLAPSED_SHOULDERS: 'Shoulders collapsing',
};

/** Severity per fault (drives score penalties + color). */
export const FAULT_SEVERITY: Record<FaultCode, FaultSeverity> = {
  HIPS_SAGGING: 'critical',
  HIPS_PIKING: 'warning',
  BODY_LINE_BREAK: 'warning',
  PARTIAL_DEPTH: 'critical',
  PARTIAL_RANGE: 'critical',
  NO_LOCKOUT: 'warning',
  KIPPING: 'critical',
  CHIN_NOT_CLEAR: 'warning',
  TOO_FAST: 'warning',
  COLLAPSED_SHOULDERS: 'warning',
};

/** Keypoint index -> human label (for UI legends). */
export const KEYPOINT_LABELS: Record<number, string> = {
  0: 'Head',
  11: 'L Shoulder',
  12: 'R Shoulder',
  13: 'L Elbow',
  14: 'R Elbow',
  15: 'L Wrist',
  16: 'R Wrist',
  23: 'L Hip',
  24: 'R Hip',
  25: 'L Knee',
  26: 'R Knee',
  27: 'L Ankle',
  28: 'R Ankle',
};

/** Keypoint indices tracked by the color-coding engine. */
export const TRACKED_KEYPOINTS: readonly number[] = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/** Exercises covered by the guidance engine. */
export type GuidanceExercise = Extract<ExerciseType, 'pushups' | 'pullups'>;

