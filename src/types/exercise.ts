// Exercise types supported by the app
export type ExerciseType = 'pushups' | 'pullups' | 'squats' | 'plank' | 'custom';

// Exercise configuration
export interface ExerciseConfig {
  id: ExerciseType;
  name: string;
  description: string;
  primaryJoints: string[];
  detectionStateMachine: string;
  minRepTime: number;
  maxRepTime: number;
  angleThresholds: {
    start: number;
    bottom: number;
    complete: number;
  };
  formCheckpoints: FormCheckpoint[];
}

// Form checkpoint definitions
export interface FormCheckpoint {
  name: string;
  joint: string;
  angleThreshold: number;
  direction: 'above' | 'below' | 'equal';
  weight: number;
}

// Rep detection state
export type RepState =
  | 'idle'
  | 'eccentric'
  | 'bottom'
  | 'concentric';

// Rep detection result
export interface RepDetectionResult {
  isValid: boolean;
  repCounted: boolean;
  currentState: RepState;
  formScore: number;
  formIssues: FormIssue[];
  jointAngles: Record<string, number>;
  repPhaseTime: number;
}

// Form issue detection
export interface FormIssue {
  type: 'sagging_hips' | 'partial_range' | 'too_fast' | 'shoulder_collapse' | 'unstable' | 'other';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  joint: string;
  timestamp: number;
}

export interface FormScoreParams {
  rangeOfMotionScore: number;
  tempoScore: number;
  stabilityScore: number;
  fluidityScore: number;
  weights: {
    rangeOfMotion: number;
    tempo: number;
    stability: number;
    fluidity: number;
  };
}


// Exercise session state
export interface ExerciseSessionState {
  exerciseType: ExerciseType;
  isActive: boolean;
  repCount: number;
  currentRepNumber: number;
  startTime: number | null;
  lastRepTime: number | null;
  totalFormScore: number;
  formScoreSum: number;
  currentFormScore: number;
  consecutiveGoodReps: number;
  consecutiveBadReps: number;
  phaseStartTime: number | null;
  repHistory: RepDetectionResult[];
  sessionReps: number;
  estimatedCalories: number;
  sessionXp: number;
  duration: number;
}

// Boss battle state
export interface BossState {
  isActive: boolean;
  bossId: string | null;
  bossName: string;
  bossHealth: number;
  maxHealth: number;
  damageDealt: number;
  currentPhase: 'idle' | 'battle' | 'victory' | 'defeat';
  phaseStartTime: number | null;
  comboCount: number;
  lastHitTime: number | null;
  specialAttackImminent: boolean;
}

// Exercise-specific states
export interface PullupState {
  hangState: 'hanging' | 'pulling' | 'top' | 'lowering';
  chinAboveBar: boolean;
  armExtension: number;
}

export interface SquatState {
  stance: 'standing' | 'descending' | 'bottom' | 'ascending';
  kneeAngle: number;
  hipAngle: number;
  depth: 'quarter' | 'half' | 'parallel' | 'deep';
}

export interface PlankState {
  active: boolean;
  holdStartTime: number | null;
  currentHoldTime: number;
  hipsSagging: boolean;
  formBreakCount: number;
  totalHoldTime: number;
  bestHoldTime: number;
}

// Exercise state machine interface
export interface ExerciseStateMachine {
  type: ExerciseType;
  currentState: RepState;
  transition(newAngles: Record<string, number>): RepDetectionResult;
  reset(): void;
  getState(): ExerciseState;
}

// Exercise state container
export interface ExerciseState {
  session: ExerciseSessionState;
  repDetection: RepDetectionResult | null;
  boss: BossState;
}
