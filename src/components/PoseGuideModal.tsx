import { useState } from 'react';
import GuideSkeleton3D, { type GuideVariant } from './GuideSkeleton3D';
import type { GuidanceExercise } from '../types/formAnalyzer';
import {
  IconX,
  IconDumbbell,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconSparkle,
} from './icons';

/* -------------------------------------------------------------------------- */
/* PoseGuideModal - step-by-step visual exercise guide                        */
/* -------------------------------------------------------------------------- */
/* Interactive 3D illustrations of correct vs. incorrect joint alignments,    */
/* shown before starting a workout set (and available any time from the HUD). */
/* -------------------------------------------------------------------------- */

interface PoseGuideModalProps {
  exercise: GuidanceExercise;
  open: boolean;
  onClose: () => void;
  /** CTA on the last step (e.g. "I'm Ready - Start Set") */
  onStartSet?: () => void;
}

interface GuideStep {
  title: string;
  description: string;
  checkpoints: string[];
  faultNote?: string;
}


const STEPS: Record<GuidanceExercise, GuideStep[]> = {
  pushups: [
    {
      title: '1 · Camera & Starting Pose (Top)',
      description:
        'Side-profile view (30°-90° to your body). Hands under shoulders, arms fully extended, body one straight line.',
      checkpoints: ['Elbow angle ≥ 160°', 'Shoulder-hip-ankle line ≥ 160°', 'Core braced, glutes tight'],
    },
    {
      title: '2 · Descent (Eccentric)',
      description:
        'Lower your chest toward the floor by bending the elbows. Keep the hips locked to the shoulder-ankle line.',
      checkpoints: ['Elbows track back ~45°', 'Hips move with the chest', 'Control the tempo (no diving)'],
    },
    {
      title: '3 · Bottom Position',
      description:
        'Chest nearly touches the floor. This is where depth is judged - partial reps do not count.',
      checkpoints: ['Elbow angle ≤ 90°', 'Body still in one line', 'No bouncing out of the hole'],
      faultNote: 'COMMON FAULT: hips sag or pike at the bottom (line < 150°) - watch the red hips in the fault view.',
    },
    {
      title: '4 · Press Up (Concentric)',
      description:
        'Drive the floor away until the arms reach a full lockout to complete the rep.',
      checkpoints: ['Return to elbow ≥ 160°', 'Shoulders stable, no collapse', 'Breath out on the press'],
    },
  ],
  pullups: [
    {
      title: '1 · Camera & Dead Hang',
      description:
        'Front or rear view facing the bar. Hang with arms fully extended overhead - this calibrates the bar height.',
      checkpoints: ['Elbow angle ≥ 150°', 'Wrists visible on the bar', 'Shoulders engaged, legs still'],
    },
    {
      title: '2 · The Pull (Concentric)',
      description:
        'Pull by driving the elbows down toward the hips. No kipping - leg swings void the rep.',
      checkpoints: ['Elbows drive down and back', 'Legs quiet (no swing/tuck)', 'Bar stays steady'],
      faultNote: 'COMMON FAULT: kipping - knee tucks and lateral swings. Toggle the fault view to see it flagged red.',
    },
    {
      title: '3 · Top Position',
      description:
        'Chin passes the bar level. Wrists stay below shoulder height at the top.',
      checkpoints: ['Chin over the bar', 'Elbow angle ≤ 60°', 'Chest toward the bar'],
    },
    {
      title: '4 · Lowering (Eccentric)',
      description:
        'Lower under control to a full dead-hang lockout before the next rep.',
      checkpoints: ['Return to elbow ≥ 150°', 'No dropping fast', 'Re-set the shoulders each rep'],
    },
  ],
};


export default function PoseGuideModal({ exercise, open, onClose, onStartSet }: PoseGuideModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [variant, setVariant] = useState<GuideVariant>('correct');

  if (!open) return null;

  const steps = STEPS[exercise];
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="pose-guide-backdrop" role="dialog" aria-modal="true">
      <div className="pose-guide-modal">
        <button className="pose-guide-close" onClick={onClose} aria-label="Close guide">
          <IconX width={16} height={16} />
        </button>

        <div className="pose-guide-header">
          <span className="pose-guide-badge">
            {exercise === 'pushups'
              ? <><IconDumbbell width={18} height={18} /> Push-Up Guide</>
              : <><IconDumbbell width={18} height={18} /> Pull-Up Guide</>}
          </span>
          <span className="pose-guide-stepcount">Step {stepIndex + 1} / {steps.length}</span>
        </div>

        <div className="pose-guide-3d">
          <GuideSkeleton3D exercise={exercise} variant={variant} />
          <div className="guide-3d-legend">drag to orbit</div>
          <div className={`guide-3d-tag ${variant}`}>
            {variant === 'correct'
              ? <><IconCheck width={13} height={13} /> Correct Form</>
              : <><IconX width={13} height={13} /> Common Fault</>}
          </div>
        </div>

        <div className="pose-guide-body">
          <h3 className="pose-guide-step-title">{step.title}</h3>
          <p className="pose-guide-desc">{step.description}</p>
          <ul className="pose-guide-checkpoints">
            {step.checkpoints.map((c) => (
              <li key={c}>
                <IconCheck width={12} height={12} /> {c}
              </li>
            ))}
          </ul>
          {step.faultNote && <p className="pose-guide-faultnote">{step.faultNote}</p>}
        </div>

        <div className="pose-guide-variant-toggle">
          <button className={variant === 'correct' ? 'active correct' : ''} onClick={() => setVariant('correct')}>
            Correct
          </button>
          <button className={variant === 'fault' ? 'active fault' : ''} onClick={() => setVariant('fault')}>
            Common fault
          </button>
        </div>

        <div className="pose-guide-footer">
          <div className="pose-guide-dots">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`dot ${i === stepIndex ? 'active' : ''}`}
                onClick={() => setStepIndex(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
          <div className="pose-guide-nav">
            <button
              className="btn-ghost"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
            >
              <IconChevronLeft width={14} height={14} /> Back
            </button>
            {isLast ? (
              <button
                className="btn-primary"
                onClick={() => {
                  setVariant('correct');
                  if (onStartSet) onStartSet();
                  else onClose();
                }}
              >
                <IconSparkle width={15} height={15} /> Start Set
              </button>
            ) : (
              <button className="btn-primary" onClick={() => setStepIndex((s) => s + 1)}>
                Next <IconChevronRight width={14} height={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

