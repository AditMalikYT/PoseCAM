import type { PoseLandmark, PoseLandmarkIndex } from './pose';

export interface PoseCorrectorConfig {
  enabled: boolean;
  showTargetSkeleton: boolean;
  showDeviationArrows: boolean;
  highlightMisaligned: boolean;
  misalignmentThreshold: number; // percent of canvas height
}

export interface PoseAlignment {
  landmarkIndex: PoseLandmarkIndex;
  targetPosition: { x: number; y: number };
  actualPosition: { x: number; y: number } | null;
  deviation: number | null;
  isAligned: boolean;
}

export interface PoseCorrectorState {
  isCalibrated: boolean;
  calibrationLandmarks: PoseLandmark[] | null;
  currentAlignment: PoseAlignment[];
  overallScore: number;
}

export type PoseTarget = Record<number, { x: number; y: number }>;

export const SKELETON_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

export const POSE_CORRECTOR_COLORS = {
  target: '#00f3ff',
  skeleton: 'rgba(255,255,255,0.85)',
  aligned: '#00ff88',
  misaligned: '#ff2a6d',
  arrow: '#ffd700',
} as const;

export const IDEAL_PUSHUP_POSE: PoseTarget = {
  11: { x: 0.38, y: 0.30 },
  12: { x: 0.62, y: 0.30 },
  13: { x: 0.30, y: 0.42 },
  14: { x: 0.70, y: 0.42 },
  15: { x: 0.25, y: 0.48 },
  16: { x: 0.75, y: 0.48 },
  23: { x: 0.42, y: 0.52 },
  24: { x: 0.58, y: 0.52 },
  25: { x: 0.42, y: 0.72 },
  26: { x: 0.58, y: 0.72 },
  27: { x: 0.43, y: 0.92 },
  28: { x: 0.57, y: 0.92 },
};
