import { useEffect, useRef } from 'react';
import type { CameraSetupStatus, GuidanceExercise } from '../types/formAnalyzer';

/* -------------------------------------------------------------------------- */
/* SetupGuideOverlay - Onboarding & Camera Placement Guide                    */
/* -------------------------------------------------------------------------- */
/* Draws a semi-transparent AR bounding zone with a ghost silhouette showing  */
/* the optimal body angle/distance, plus dynamic setup warnings               */
/* ("Step back 2 feet", "Turn to your side for push-ups", ...).               */
/* Canvas uses the same 640x480 landmark space and mirror transform as the    */
/* pose canvas, so the zone stays glued to the video feed.                    */
/* -------------------------------------------------------------------------- */

interface SetupGuideOverlayProps {
  exercise: GuidanceExercise;
  setup: CameraSetupStatus | null;
  /** Show the full guide (pre-workout). When false only warnings show. */
  full: boolean;
}

/** Ghost silhouette keypoint sets in normalized landmark space. */
const SILHOUETTE_PUSHUP: [number, number][] = [
  [0.78, 0.66], // head
  [0.7, 0.7],   // shoulder
  [0.74, 0.86], // elbow
  [0.8, 0.9],   // wrist
  [0.45, 0.72], // hip
  [0.25, 0.74], // knee
  [0.08, 0.76], // ankle
];

const SILHOUETTE_PUSHUP_BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6],
];

const SILHOUETTE_PULLUP: [number, number][] = [
  [0.5, 0.3],   // head
  [0.44, 0.38], // L shoulder
  [0.56, 0.38], // R shoulder
  [0.38, 0.47], // L elbow
  [0.62, 0.47], // R elbow
  [0.36, 0.17], // L wrist (on bar)
  [0.64, 0.17], // R wrist (on bar)
  [0.46, 0.58], // L hip
  [0.54, 0.58], // R hip
  [0.45, 0.73], // L knee
  [0.55, 0.73], // R knee
  [0.44, 0.89], // L ankle
  [0.56, 0.89], // R ankle
];

const SILHOUETTE_PULLUP_BONES: [number, number][] = [
  [1, 2], [0, 1], [0, 2], [1, 3], [3, 5], [2, 4], [4, 6],
  [1, 7], [2, 8], [7, 8], [7, 9], [9, 11], [8, 10], [10, 12],
];


function drawZone(
  ctx: CanvasRenderingContext2D,
  exercise: GuidanceExercise,
  ready: boolean
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const accent = ready ? '0, 255, 136' : '0, 243, 255';

  // AR bounding zone
  const zx = exercise === 'pushups' ? w * 0.06 : w * 0.26;
  const zy = exercise === 'pushups' ? h * 0.52 : h * 0.05;
  const zw = exercise === 'pushups' ? w * 0.88 : w * 0.48;
  const zh = exercise === 'pushups' ? h * 0.44 : h * 0.92;

  ctx.save();
  ctx.fillStyle = `rgba(${accent}, 0.07)`;
  ctx.strokeStyle = `rgba(${accent}, 0.75)`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.roundRect(zx, zy, zw, zh, 22);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  // Corner ticks
  ctx.strokeStyle = `rgba(${accent}, 0.95)`;
  ctx.lineWidth = 4;
  const tick = 18;
  const corners: [number, number, number, number][] = [
    [zx, zy, 1, 1], [zx + zw, zy, -1, 1], [zx, zy + zh, 1, -1], [zx + zw, zy + zh, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * tick, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * tick);
    ctx.stroke();
  }

  // Ghost silhouette
  const pts = exercise === 'pushups' ? SILHOUETTE_PUSHUP : SILHOUETTE_PULLUP;
  const bones = exercise === 'pushups' ? SILHOUETTE_PUSHUP_BONES : SILHOUETTE_PULLUP_BONES;
  const scale = Math.min(zw / 0.9, zh / 0.95);
  const originX = zx + zw / 2;
  const originY = zy + zh / 2;
  const toPx = (p: [number, number]): [number, number] => [
    originX + (p[0] - 0.5) * scale,
    originY + (p[1] - (exercise === 'pushups' ? 0.76 : 0.5)) * scale * 0.92,
  ];

  ctx.strokeStyle = `rgba(${accent}, 0.5)`;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const [i, jj] of bones) {
    const a = toPx(pts[i]);
    const b = toPx(pts[jj]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  for (const p of pts) {
    const [px, py] = toPx(p);
    ctx.beginPath();
    ctx.arc(px, py, p === pts[0] ? 13 : 9, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${accent}, 0.55)`;
    ctx.fill();
  }

  if (exercise === 'pullups') {
    // Bar line across the zone top
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(zx + zw * 0.08, zy + zh * 0.12);
    ctx.lineTo(zx + zw * 0.92, zy + zh * 0.12);
    ctx.stroke();
  }

  ctx.restore();
}


export default function SetupGuideOverlay({ exercise, setup, full }: SetupGuideOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exerciseRef = useRef(exercise);
  const readyRef = useRef(false);
  exerciseRef.current = exercise;
  readyRef.current = setup?.isReady ?? false;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (full) drawZone(ctx, exerciseRef.current, readyRef.current);
      raf = requestAnimationFrame(render);
    };
    let raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [full]);

  const warnings = setup?.warnings ?? ['Step into the camera frame'];
  const isReady = setup?.isReady ?? false;

  return (
    <div className="setup-guide-overlay">
      <canvas ref={canvasRef} width={640} height={480} className="setup-guide-canvas" />
      <div className="setup-guide-warnings">
        {full && (
          <div className="setup-guide-title">
            {exercise === 'pushups'
              ? '📱 Prop the phone to your side, at floor level'
              : '🧗 Stand facing the bar, full body in frame'}
          </div>
        )}
        {isReady ? (
          <div className="setup-chip ready">
            ✓ Setup locked — {Math.round(setup?.viewAngleDeg ?? 0)}° body angle
          </div>
        ) : (
          warnings.slice(0, 2).map((wtext) => (
            <div key={wtext} className="setup-chip warn">⚠ {wtext}</div>
          ))
        )}
        {full && (
          <div className="setup-chip hint">
            Match the translucent silhouette, then start your set
          </div>
        )}
      </div>
    </div>
  );
}

