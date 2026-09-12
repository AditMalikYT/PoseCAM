import {
  getAverageElbowAngle,
  getHipShoulderAngle,
  getPushupPosition,
} from './angleCalculation';
import type { PoseLandmark, RepState, RepDetectionResult, FormIssue, ExerciseType } from '../types';

export type ExercisePhase = 'idle' | 'descent' | 'bottom' | 'ascent' | 'pulling' | 'top' | 'lowering';

export interface ExerciseRepStateMachine {
  phase: ExercisePhase;
  phaseStartTime: number | null;
  lastValidPosition: 'top' | 'bottom' | null;
  repStarted: boolean;
  consecutiveSaggingFrames: number;
  minElbowAchieved: number;
  maxElbowAchieved: number;
}

export const DEFAULT_STATE_MACHINE: ExerciseRepStateMachine = {
  phase: 'idle',
  phaseStartTime: null,
  lastValidPosition: null,
  repStarted: false,
  consecutiveSaggingFrames: 0,
  minElbowAchieved: 180,
  maxElbowAchieved: 0,
};

/** Grace period (ms) a dropped tracking stream is tolerated before the state
 *  machine resets to IDLE so it cannot lock up in descent/bottom/ascent. */
export const TRACKING_LOSS_RESET_MS = 600;

/** Coerce any non-finite value to a safe fallback (NaN/Infinity guard) */
export function finiteOr(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Tracking-loss fallback for the exercise state machine.
 *
 * Call on every frame WITHOUT usable landmarks. While the dropout is shorter
 * than `graceMs` the FSM keeps its phase (brief occlusions are normal); once
 * the dropout persists, the phase resets to IDLE so the machine can never lock
 * up with a stale phaseStartTime. Rep counters/metrics are preserved.
 */
export function handleTrackingLoss(
  state: ExerciseRepStateMachine,
  timestamp: number,
  lastSeenAt: number | null,
  graceMs: number = TRACKING_LOSS_RESET_MS
): { state: ExerciseRepStateMachine; reset: boolean } {
  // Never seen / already reset: nothing to expire
  if (lastSeenAt === null) return { state, reset: false };

  const dropoutMs = finiteOr(timestamp - lastSeenAt, 0);
  if (dropoutMs < graceMs) return { state, reset: false };

  return {
    state: {
      ...DEFAULT_STATE_MACHINE,
      // Preserve session metrics across the reset for telemetry continuity
      minElbowAchieved: finiteOr(state.minElbowAchieved, 180),
      maxElbowAchieved: finiteOr(state.maxElbowAchieved, 0),
    },
    reset: true,
  };
}

const THRESHOLDS = {
  PUSHUP: {
    TOP_ANGLE: 155,
    BOTTOM_ANGLE: 105,
    COMPLETE_ANGLE: 145,
    HIP_SAGGING_ANGLE: 155,
    SAGGING_FRAMES_LIMIT: 8,
    MIN_BOTTOM_TIME: 50,
    MIN_DESCENT_TIME: 250,
  },
  PULLUP: {
    HANG_ANGLE: 155,
    TOP_ANGLE: 85,
    COMPLETE_ANGLE: 150,
  },
};

/**
 * Push-Up Rep Detection State Machine
 */
export function detectPushupRep(
  landmarks: PoseLandmark[],
  currentState: ExerciseRepStateMachine = DEFAULT_STATE_MACHINE,
  timestamp: number = Date.now()
): { state: ExerciseRepStateMachine; result: RepDetectionResult } {
  if (!landmarks || landmarks.length < 33) {
    return { state: currentState, result: createEmptyResult(currentState.phase as RepState) };
  }

  const elbowAngle = getAverageElbowAngle(landmarks);
  const leftHip = getHipShoulderAngle(landmarks, 'left');
  const rightHip = getHipShoulderAngle(landmarks, 'right');
  
  const avgHipAngle = leftHip !== null && rightHip !== null
    ? (leftHip + rightHip) / 2
    : leftHip !== null ? leftHip : rightHip;

  const position = getPushupPosition(elbowAngle);
  
  const isSagging = avgHipAngle !== null && avgHipAngle < THRESHOLDS.PUSHUP.HIP_SAGGING_ANGLE;
  const saggingCount = isSagging ? currentState.consecutiveSaggingFrames + 1 : 0;
  const hasSaggingIssue = saggingCount >= THRESHOLDS.PUSHUP.SAGGING_FRAMES_LIMIT;

  let newState: ExerciseRepStateMachine = {
    ...currentState,
    // NaN-harden counters so one corrupted frame can never poison the FSM
    minElbowAchieved: finiteOr(currentState.minElbowAchieved, 180),
    maxElbowAchieved: finiteOr(currentState.maxElbowAchieved, 0),
    consecutiveSaggingFrames: saggingCount,
  };

  if (elbowAngle !== null) {
    newState.minElbowAchieved = Math.min(newState.minElbowAchieved, elbowAngle);
    newState.maxElbowAchieved = Math.max(newState.maxElbowAchieved, elbowAngle);
  }

  let repCounted = false;
  let formScore = 100;
  const formIssues: FormIssue[] = [];

  switch (currentState.phase) {
    case 'idle':
      if (elbowAngle !== null && elbowAngle < THRESHOLDS.PUSHUP.TOP_ANGLE) {
        newState.phase = 'descent';
        newState.phaseStartTime = timestamp;
        newState.repStarted = true;
        newState.lastValidPosition = 'top';
        newState.minElbowAchieved = elbowAngle;
      }
      break;

    case 'descent':
      if (elbowAngle !== null) {
        const descentTime = timestamp - (currentState.phaseStartTime || timestamp);
        
        if (descentTime < THRESHOLDS.PUSHUP.MIN_DESCENT_TIME && position === 'bottom') {
          formIssues.push({
            type: 'too_fast',
            severity: 'warning',
            message: 'Control your descent - lower smoothly',
            joint: 'elbow',
            timestamp,
          });
          formScore -= 15;
        }

        if (hasSaggingIssue) {
          formIssues.push({
            type: 'sagging_hips',
            severity: 'critical',
            message: 'Keep your body in a straight plank',
            joint: 'hip',
            timestamp,
          });
          formScore -= 20;
        }

        if (position === 'bottom' || elbowAngle <= THRESHOLDS.PUSHUP.BOTTOM_ANGLE) {
          newState.phase = 'bottom';
          newState.phaseStartTime = timestamp;
          newState.lastValidPosition = 'bottom';
        }
      }
      break;

    case 'bottom':
      if (elbowAngle !== null && elbowAngle > THRESHOLDS.PUSHUP.BOTTOM_ANGLE + 15) {
        newState.phase = 'ascent';
        newState.phaseStartTime = timestamp;
      }
      break;

    case 'ascent':
      if (hasSaggingIssue) {
        formIssues.push({
          type: 'sagging_hips',
          severity: 'warning',
          message: 'Keep hips aligned while pushing up',
          joint: 'hip',
          timestamp,
        });
        formScore -= 10;
      }

      if (elbowAngle !== null && elbowAngle >= THRESHOLDS.PUSHUP.COMPLETE_ANGLE) {
        repCounted = true;
        newState = {
          ...DEFAULT_STATE_MACHINE,
          lastValidPosition: 'top',
        };
      }
      break;
  }

  formScore = Math.max(0, Math.min(100, formScore));

  const result: RepDetectionResult = {
    isValid: newState.phase !== 'idle' || newState.repStarted,
    repCounted,
    currentState: (newState.phase === 'descent' ? 'eccentric' : newState.phase === 'ascent' ? 'concentric' : newState.phase) as RepState,
    formScore: Math.round(finiteOr(formScore, 0)),
    formIssues,
    jointAngles: { elbow: finiteOr(elbowAngle, 0), hip: finiteOr(avgHipAngle, 0) },
    repPhaseTime: newState.phaseStartTime ? timestamp - newState.phaseStartTime : 0,
  };

  return { state: newState, result };
}

/**
 * Pull-Up Rep Detection State Machine
 */
export function detectPullupRep(
  landmarks: PoseLandmark[],
  currentState: ExerciseRepStateMachine = DEFAULT_STATE_MACHINE,
  timestamp: number = Date.now()
): { state: ExerciseRepStateMachine; result: RepDetectionResult } {
  if (!landmarks || landmarks.length < 33) {
    return { state: currentState, result: createEmptyResult(currentState.phase as RepState) };
  }

  const elbowAngle = getAverageElbowAngle(landmarks);
  let newState: ExerciseRepStateMachine = { ...currentState };
  let repCounted = false;
  let formScore = 100;
  const formIssues: FormIssue[] = [];

  switch (currentState.phase) {
    case 'idle':
      if (elbowAngle !== null && elbowAngle < THRESHOLDS.PULLUP.HANG_ANGLE) {
        newState.phase = 'pulling';
        newState.phaseStartTime = timestamp;
        newState.repStarted = true;
      }
      break;

    case 'pulling':
      if (elbowAngle !== null && elbowAngle <= THRESHOLDS.PULLUP.TOP_ANGLE) {
        newState.phase = 'top';
        newState.phaseStartTime = timestamp;
      }
      break;

    case 'top':
      if (elbowAngle !== null && elbowAngle > THRESHOLDS.PULLUP.TOP_ANGLE + 15) {
        newState.phase = 'lowering';
        newState.phaseStartTime = timestamp;
      }
      break;

    case 'lowering':
      if (elbowAngle !== null && elbowAngle >= THRESHOLDS.PULLUP.COMPLETE_ANGLE) {
        repCounted = true;
        newState = { ...DEFAULT_STATE_MACHINE };
      }
      break;
  }

  const result: RepDetectionResult = {
    isValid: newState.phase !== 'idle',
    repCounted,
    currentState: (newState.phase === 'pulling' ? 'concentric' : newState.phase === 'lowering' ? 'eccentric' : newState.phase) as RepState,
    formScore,
    formIssues,
    jointAngles: { elbow: finiteOr(elbowAngle, 0) },
    repPhaseTime: newState.phaseStartTime ? timestamp - newState.phaseStartTime : 0,
  };

  return { state: newState, result };
}

/**
 * Unified Exercise State Machine Handler
 */
export function detectExerciseRep(
  exerciseType: ExerciseType,
  landmarks: PoseLandmark[],
  state: ExerciseRepStateMachine = DEFAULT_STATE_MACHINE,
  timestamp: number = Date.now()
): { state: ExerciseRepStateMachine; result: RepDetectionResult } {
  if (exerciseType === 'pullups') {
    return detectPullupRep(landmarks, state, timestamp);
  }
  return detectPushupRep(landmarks, state, timestamp);
}

function createEmptyResult(phase: RepState): RepDetectionResult {
  return {
    isValid: false,
    repCounted: false,
    currentState: phase,
    formScore: 0,
    formIssues: [],
    jointAngles: { elbow: 0, hip: 0 },
    repPhaseTime: 0,
  };
}

export function getFormFeedback(formScore: number): string {
  if (formScore >= 95) return 'Perfect form! 💪';
  if (formScore >= 80) return 'Good form!';
  if (formScore >= 60) return 'Keep practicing your form';
  return 'Focus on your form';
}
