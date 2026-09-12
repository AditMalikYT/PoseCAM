import type { FormIssue, FormScoreParams } from '../types';
import type { PoseLandmark } from '../types/pose';
import { getHipShoulderAngle, getAverageElbowAngle } from './angleCalculation';

const FORM_THRESHOLDS = {
  HIP_SAGGING_ANGLE: 155,
  MIN_ELBOW_BOTTOM: 100,
  MAX_DESCENT_SPEED: 150,
  SAGGING_FRAMES: 8,
};

export function validatePushupForm(
  landmarks: PoseLandmark[],
  previousAngles: { elbow: number | null; hip: number | null } | null,
  timestamp: number,
  frameRate: number = 30
): FormIssue[] {
  const issues: FormIssue[] = [];

  if (!landmarks || landmarks.length < 33) return issues;

  const elbowAngle = getAverageElbowAngle(landmarks);
  const leftHipAngle = getHipShoulderAngle(landmarks, 'left');
  const rightHipAngle = getHipShoulderAngle(landmarks, 'right');
  
  const avgHipAngle = leftHipAngle !== null && rightHipAngle !== null
    ? (leftHipAngle + rightHipAngle) / 2
    : leftHipAngle !== null ? leftHipAngle : rightHipAngle;

  if (avgHipAngle !== null && avgHipAngle < FORM_THRESHOLDS.HIP_SAGGING_ANGLE) {
    issues.push({
      type: 'sagging_hips',
      severity: 'critical',
      message: 'Hips sagging - keep your body in a straight line',
      joint: 'hip',
      timestamp,
    });
  }

  if (elbowAngle !== null && elbowAngle > FORM_THRESHOLDS.MIN_ELBOW_BOTTOM + 20) {
    issues.push({
      type: 'partial_range',
      severity: 'warning',
      message: 'Go deeper - aim to bring chest close to floor',
      joint: 'elbow',
      timestamp,
    });
  }

  if (previousAngles && previousAngles.elbow !== null && elbowAngle !== null) {
    const angleDiff = Math.abs(elbowAngle - previousAngles.elbow);
    const speed = angleDiff * frameRate;
    
    if (speed > FORM_THRESHOLDS.MAX_DESCENT_SPEED) {
      issues.push({
        type: 'too_fast',
        severity: 'warning',
        message: 'Control your descent - don\'t drop too fast',
        joint: 'elbow',
        timestamp,
      });
    }
  }

  if (checkShoulderStability(landmarks)) {
    issues.push({
      type: 'shoulder_collapse',
      severity: 'warning',
      message: 'Keep shoulders down and back',
      joint: 'shoulder',
      timestamp,
    });
  }

  return issues;
}

function checkShoulderStability(landmarks: PoseLandmark[]): boolean {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftEar = landmarks[7];
  const rightEar = landmarks[8];

  if (!leftShoulder || !rightShoulder || !leftEar || !rightEar) return false;
  if (leftShoulder.visibility < 0.5 || rightShoulder.visibility < 0.5) return false;

  const leftShoulderDrop = leftShoulder.y > leftEar.y + 0.05;
  const rightShoulderDrop = rightShoulder.y > rightEar.y + 0.05;

  return leftShoulderDrop && rightShoulderDrop;
}

export function calculateFormScore(
  issues: FormIssue[],
  elbowAngle: number | null,
  hipAngle: number | null,
  reachedBottom: boolean
): number {
  let score = 100;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 25; break;
      case 'warning': score -= 15; break;
      case 'info': score -= 5; break;
    }
  }

  if (reachedBottom && elbowAngle !== null) {
    const depthQuality = 100 - Math.max(0, elbowAngle - FORM_THRESHOLDS.MIN_ELBOW_BOTTOM);
    score += Math.min(10, depthQuality * 0.1);
  }

  if (!reachedBottom && elbowAngle !== null && elbowAngle > FORM_THRESHOLDS.MIN_ELBOW_BOTTOM + 30) {
    score -= 10;
  }

  if (hipAngle !== null && hipAngle >= FORM_THRESHOLDS.HIP_SAGGING_ANGLE) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function getDetailedFormScore(
  issues: FormIssue[],
  elbowAngle: number | null,
  hipAngle: number | null,
  reachedBottom: boolean
): FormScoreParams {
  const rangeOfMotionScore = elbowAngle !== null
    ? Math.min(100, Math.max(0, 100 - (elbowAngle - FORM_THRESHOLDS.MIN_ELBOW_BOTTOM) * 1.5))
    : 50;

  const stabilityScore = hipAngle !== null && hipAngle >= FORM_THRESHOLDS.HIP_SAGGING_ANGLE
    ? 100
    : hipAngle !== null
      ? Math.max(0, 100 - (FORM_THRESHOLDS.HIP_SAGGING_ANGLE - hipAngle) * 2)
      : 50;

  const hasSpeedIssues = issues.some(i => i.type === 'too_fast');
  const tempoScore = hasSpeedIssues ? 70 : 100;

  const hasShoulderIssues = issues.some(i => i.type === 'shoulder_collapse');
  const fluidityScore = hasShoulderIssues ? 80 : 100;

  return {
    rangeOfMotionScore: Math.round(rangeOfMotionScore),
    tempoScore: Math.round(tempoScore),
    stabilityScore: Math.round(stabilityScore),
    fluidityScore: Math.round(fluidityScore),
    weights: {
      rangeOfMotion: 0.35,
      tempo: 0.2,
      stability: 0.35,
      fluidity: 0.1,
    },
  };
}

export function getFormTier(formScore: number): 'perfect' | 'good' | 'fair' | 'poor' {
  if (formScore >= 95) return 'perfect';
  if (formScore >= 80) return 'good';
  if (formScore >= 60) return 'fair';
  return 'poor';
}

export function getFormXpMultiplier(formScore: number): number {
  const tier = getFormTier(formScore);
  switch (tier) {
    case 'perfect': return 1.5;
    case 'good': return 1.0;
    case 'fair': return 0.5;
    case 'poor': return 0.2;
  }
}
