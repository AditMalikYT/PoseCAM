/* -------------------------------------------------------------------------- */
/* Audio Form Feedback Coach (Web Audio API)                                  */
/* -------------------------------------------------------------------------- */
/* Real-time audio cues for the AR pose guidance system: distinct, rate-      */
/* limited beeps for setup-ready, phase transitions, faults, top position     */
/* and rep completion. The AudioContext is unlocked on the first user gesture */
/* (call unlockAudioCoach() from a click handler, e.g. "Start Workout").      */
/* -------------------------------------------------------------------------- */

export type CoachSound =
  | 'setupReady'    // camera placement locked
  | 'phaseChange'   // ECCENTRIC/BOTTOM/CONCENTRIC transition
  | 'fault'         // red-level form fault surfaced
  | 'warning'       // yellow-level deviation
  | 'topPosition'   // bottom (push-up) / chin-over-bar (pull-up) reached
  | 'repComplete'   // full-ROM rep closed
  | 'streakBonus'   // +XP streak multiplier applied
  | 'levelUp';      // player leveled up!

interface CueTone {
  freq: number;
  durMs: number;
  type: OscillatorType;
  delayMs: number;
  gain: number;
}

const CUES: Record<CoachSound, CueTone[]> = {
  setupReady: [
    { freq: 523.25, durMs: 110, type: 'sine', delayMs: 0, gain: 0.25 },
    { freq: 783.99, durMs: 160, type: 'sine', delayMs: 130, gain: 0.3 },
  ],
  phaseChange: [
    { freq: 660, durMs: 70, type: 'triangle', delayMs: 0, gain: 0.18 },
  ],
  fault: [
    { freq: 220, durMs: 200, type: 'sawtooth', delayMs: 0, gain: 0.22 },
  ],
  warning: [
    { freq: 440, durMs: 90, type: 'square', delayMs: 0, gain: 0.12 },
  ],
  topPosition: [
    { freq: 987.77, durMs: 120, type: 'sine', delayMs: 0, gain: 0.25 },
  ],
  repComplete: [
    { freq: 880, durMs: 90, type: 'sine', delayMs: 0, gain: 0.22 },
    { freq: 1318.5, durMs: 140, type: 'sine', delayMs: 100, gain: 0.25 },
  ],
  streakBonus: [
    { freq: 987.77, durMs: 80, type: 'triangle', delayMs: 0, gain: 0.2 },
    { freq: 1318.51, durMs: 70, type: 'triangle', delayMs: 70, gain: 0.2 },
    { freq: 1975.53, durMs: 180, type: 'sine', delayMs: 140, gain: 0.22 },
  ],
  levelUp: [
    { freq: 523.25, durMs: 150, type: 'sine', delayMs: 0, gain: 0.26 },
    { freq: 659.25, durMs: 150, type: 'sine', delayMs: 110, gain: 0.26 },
    { freq: 783.99, durMs: 180, type: 'sine', delayMs: 220, gain: 0.28 },
    { freq: 1046.5, durMs: 460, type: 'sine', delayMs: 330, gain: 0.32 },
    { freq: 1567.98, durMs: 520, type: 'sine', delayMs: 330, gain: 0.1 },
  ],
};

/** Minimum spacing between two plays of the same cue (ms). */
const RATE_LIMIT_MS: Record<CoachSound, number> = {
  setupReady: 3000,
  phaseChange: 450,
  fault: 1600,
  warning: 2500,
  topPosition: 1200,
  repComplete: 300,
  streakBonus: 600,
  levelUp: 5000,
};

let ctx: AudioContext | null = null;
let enabled = true;
const lastPlayedAt = new Map<CoachSound, number>();

/** Lazily create the AudioContext (must happen after a user gesture). */
function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a user-gesture handler so playback is allowed by autoplay policy. */
export function unlockAudioCoach(): void {
  ensureContext();
}

/** Mute/unmute all coach sounds. */
export function setAudioCoachEnabled(next: boolean): void {
  enabled = next;
}

export function isAudioCoachEnabled(): boolean {
  return enabled;
}

/**
 * Play a coach cue. Rate-limited per cue type; silently no-ops when the
 * context is unavailable (SSR, blocked autoplay) or audio is disabled.
 */
export function playCoachSound(sound: CoachSound, force = false): void {
  if (!enabled) return;
  const now = performance.now();
  const last = lastPlayedAt.get(sound) ?? -Infinity;
  if (!force && now - last < RATE_LIMIT_MS[sound]) return;
  lastPlayedAt.set(sound, now);

  const audio = ensureContext();
  if (!audio) return;

  for (const tone of CUES[sound]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const t0 = audio.currentTime + tone.delayMs / 1000;
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(tone.gain, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.durMs / 1000);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + tone.durMs / 1000 + 0.05);
  }
}
