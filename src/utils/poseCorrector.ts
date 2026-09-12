import type { PoseLandmark, PoseLandmarkIndex } from '../types/pose';
import type { 
  PoseCorrectorConfig, 
  PoseAlignment, 
  PoseCorrectorState,
} from '../types/poseCorrector';
import {
  SKELETON_CONNECTIONS,
  POSE_CORRECTOR_COLORS,
  IDEAL_PUSHUP_POSE,
} from '../types/poseCorrector';

// Re-export for use in other modules
export { 
  SKELETON_CONNECTIONS,
  POSE_CORRECTOR_COLORS,
  IDEAL_PUSHUP_POSE,
};

export function createPoseCorrectorState(): PoseCorrectorState {
  return { isCalibrated: false, calibrationLandmarks: null, currentAlignment: [], overallScore: 100 };
}

function calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }, w: number, h: number): number {
  const dx = (p1.x - p2.x) * w;
  const dy = (p1.y - p2.y) * h;
  return Math.sqrt(dx * dx + dy * dy);
}

export function checkLandmarkAlignment(landmark: PoseLandmark | null, target: { x: number; y: number } | null, threshold: number, w: number, h: number, index: PoseLandmarkIndex = 0): PoseAlignment {
  if (!landmark || !target || landmark.visibility < 0.5) {
    return { landmarkIndex: index, targetPosition: target || { x: 0, y: 0 }, actualPosition: null, deviation: null, isAligned: false };
  }
  const dev = calculateDistance({ x: landmark.x, y: landmark.y }, target, w, h);
  const normalized = dev / Math.min(w, h);
  return {
    landmarkIndex: index,
    targetPosition: target,
    actualPosition: { x: landmark.x, y: landmark.y },
    deviation: dev,
    isAligned: normalized < (threshold / 100),
  };
}

export function calculateAlignmentScore(alignments: PoseAlignment[]): number {
  if (!alignments.length) return 100;
  const aligned = alignments.filter(a => a.isAligned).length;
  return Math.round((aligned / alignments.length) * 100);
}

export function getAlignmentStatus(score: number): string {
  if (score >= 90) return 'Excellent!';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Needs Improvement';
  if (score >= 40) return 'Poor Alignment';
  return 'Critical Issues';
}

export function drawPoseCorrector(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, landmarks: PoseLandmark[], targetPose: Partial<Record<number, { x: number; y: number }>>, config: PoseCorrectorConfig, alignment?: PoseAlignment[]) {
  if (!config.enabled) return;
  const w = canvas.width, h = canvas.height;

  if (config.showTargetSkeleton) {
    ctx.strokeStyle = POSE_CORRECTOR_COLORS.target;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    for (const [i, j] of SKELETON_CONNECTIONS) {
      const t1 = targetPose[i], t2 = targetPose[j];
      if (t1 && t2) {
        ctx.beginPath();
        ctx.moveTo(t1.x * w, t1.y * h);
        ctx.lineTo(t2.x * w, t2.y * h);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    for (const [idx, pos] of Object.entries(targetPose)) {
      const actual = landmarks[Number(idx)];
      if (actual && actual.visibility > 0.5 && pos) {
        ctx.beginPath();
        ctx.arc(pos.x * w, pos.y * h, 8, 0, Math.PI * 2);
        ctx.fillStyle = POSE_CORRECTOR_COLORS.target;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  ctx.strokeStyle = POSE_CORRECTOR_COLORS.skeleton;
  ctx.lineWidth = 4;
  ctx.setLineDash([]);
  for (const [i, j] of SKELETON_CONNECTIONS) {
    const p1 = landmarks[i], p2 = landmarks[j];
    if (p1 && p2 && (p1.visibility ?? 0) > 0.5 && (p2.visibility ?? 0) > 0.5) {
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    }
  }

  for (let idx = 11; idx <= 28; idx++) {
    const lm = landmarks[idx];
    const target = targetPose[idx];
    if (lm && target && (lm.visibility ?? 0) > 0.5) {
      const isAligned = alignment?.find(a => a.landmarkIndex === idx)?.isAligned ?? true;
      const color = isAligned ? POSE_CORRECTOR_COLORS.aligned : POSE_CORRECTOR_COLORS.misaligned;
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (config.showDeviationArrows && !isAligned) {
        const tx = target.x * w, ty = target.y * h;
        const ax = lm.x * w, ay = lm.y * h;
        const angle = Math.atan2(ay - ty, ax - tx);
        const len = 20;
        ctx.strokeStyle = POSE_CORRECTOR_COLORS.arrow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(angle) * len, ay - Math.sin(angle) * len);
        ctx.stroke();
      }
    }
  }

  if (alignment) {
    const score = calculateAlignmentScore(alignment);
    const status = getAlignmentStatus(score);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.roundRect(10, 10, 200, 50, 8);
    ctx.fill();
    ctx.fillStyle = score >= 75 ? POSE_CORRECTOR_COLORS.aligned : POSE_CORRECTOR_COLORS.misaligned;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${score}%`, 20, 35);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '12px monospace';
    ctx.fillText(status, 70, 35);
  }
}

export function calibratePoseForPushups(landmarks: PoseLandmark[]): PoseCorrectorState {
  const state = createPoseCorrectorState();
  state.currentAlignment = [];
  for (let idx = 11; idx <= 28; idx++) {
    const lm = landmarks[idx];
    const target = IDEAL_PUSHUP_POSE[idx];
    if (lm && target && lm.visibility > 0.5) {
      state.currentAlignment.push({
        landmarkIndex: idx as PoseLandmarkIndex,
        targetPosition: target,
        actualPosition: { x: lm.x, y: lm.y },
        deviation: 0,
        isAligned: true,
      });
    }
  }
  state.overallScore = calculateAlignmentScore(state.currentAlignment);
  state.isCalibrated = true;
  return state;
}
