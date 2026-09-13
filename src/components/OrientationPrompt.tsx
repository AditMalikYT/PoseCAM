import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'argym-orientation-dismissed';

interface OrientationPromptProps {
  exercise: string;
  /** When a set is mid-flight we never interrupt with the prompt. */
  active: boolean;
}

export default function OrientationPrompt({ exercise, active }: OrientationPromptProps) {
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
  );
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage unavailable - prompt repeats, harmless */
    }
    setDismissed(true);
  }, []);

  // Push-up tracking benefits from a full-body sideways view -> landscape.
  if (dismissed || active || !isPortrait || exercise !== 'pushups') return null;

  return (
    <div
      className="orientation-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Rotate device to landscape"
    >
      <div className="orientation-phone">
        <span className="orientation-ring" />
      </div>
      <div className="orientation-title">Rotate your phone</div>
      <p className="orientation-desc">
        Push-up tracking reads your whole body sideways for the best depth &amp; form
        readouts. Landscape gives you a wider tracking zone and a steadier camera.
      </p>
      <button type="button" className="orientation-cta" onClick={dismiss}>
        Continue in portrait
      </button>
    </div>
  );
}