import type { FormStatus } from '../types/formAnalyzer';
import { FAULT_SEVERITY, FAULT_TEXT } from '../types/formAnalyzer';
import { IconAlertTriangle, IconX } from './icons';

/* -------------------------------------------------------------------------- */
/* FormFeedbackOverlay - real-time textual + color-coded form feedback        */
/* -------------------------------------------------------------------------- */
/* Shows the live dynamic cue ("Lower your chest", "Drive chin above bar"),   */
/* active fault chips (red/amber), the form score and the current phase.      */
/* -------------------------------------------------------------------------- */

interface FormFeedbackOverlayProps {
  status: FormStatus | null;
  exercise: 'pushups' | 'pullups';
}

const PHASE_LABELS: Record<string, string> = {
  SETUP: 'Setup',
  ECCENTRIC: 'Eccentric',
  BOTTOM: 'Bottom',
  CONCENTRIC: 'Concentric',
};

export default function FormFeedbackOverlay({ status, exercise }: FormFeedbackOverlayProps) {
  if (!status) return null;

  const { isValidForm, currentPhase, faults, faultCodes, metrics, cue, setup } = status;
  const severity = faultCodes.length > 0
    ? faultCodes.some((c) => FAULT_SEVERITY[c] === 'critical') ? 'bad' : 'warn'
    : 'good';

  return (
    <div className="form-feedback-overlay">
      {/* Live dynamic cue banner */}
      <div className={`form-cue ${severity}`}>
        <span className="form-cue-dot" />
        <span className="form-cue-text">{cue}</span>
        <span className="form-score">{metrics.formScore}</span>
      </div>

      {/* Active faults */}
      {faults.length > 0 && (
        <div className="form-faults">
          {faultCodes.map((code) => (
            <div
              key={code}
              className={`fault-chip ${FAULT_SEVERITY[code] === 'critical' ? 'critical' : 'warning'}`}
            >
              {FAULT_SEVERITY[code] === 'critical'
                ? <IconX width={13} height={13} />
                : <IconAlertTriangle width={13} height={13} />} {FAULT_TEXT[code]}
            </div>
          ))}
        </div>
      )}

      {/* Phase + exercise meta row */}
      <div className="form-meta">
        <span className={`phase-pill phase-${currentPhase.toLowerCase()}`}>
          {PHASE_LABELS[currentPhase] ?? currentPhase}
        </span>
        <span className="meta-item">
          Elbow: {metrics.elbowAngle !== null ? `${Math.round(metrics.elbowAngle)}°` : '—'}
        </span>
        {exercise === 'pushups' ? (
          <span className="meta-item">
            Body line: {metrics.hipLineAngle !== null ? `${Math.round(metrics.hipLineAngle)}°` : '—'}
          </span>
        ) : (
          <span className="meta-item">
            Chin: {metrics.chinClearsBar === null ? '—' : metrics.chinClearsBar ? 'over bar ✓' : 'below bar'}
          </span>
        )}
        {!setup.isReady && setup.warnings.length > 0 && (
          <span className="meta-item setup-warn">⚠ {setup.warnings[0]}</span>
        )}
      </div>

      {/* Validity ribbon */}
      {!isValidForm && (
        <div className="form-invalid-ribbon">Fix your form — reps may not count</div>
      )}
    </div>
  );
}
