import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { getStreakMultiplier } from '../types/progression';
import type { LevelUpData, RepRewardInfo, StreakMultiplier } from '../types/progression';

/* -------------------------------------------------------------------------- */
/* useProgression - progression + weekly streak XP multiplier brain.          */
/*                                                                            */
/* Read-only derivation (multiplier, progress, streak meta) + transient UI    */
/* flags consumed by the HUD: level-up trigger and the floating +XP queue.    */
/* -------------------------------------------------------------------------- */

export interface FloatingXpItem {
  id: number;
  formScore: number;
  baseXp: number;
  totalXp: number;
  bonusXp: number;
  multiplier: number;
  streakDays: number;
  tierLabel: string;
  perfect: boolean;
}

interface LevelProgress {
  currentXp: number;
  xpToNextLevel: number;
  /** 0-100 progress to the next level. */
  percent: number;
}

export interface ProgressionApi {
  /** Current player level. */
  level: number;
  /** XP progress to the next level (0-100%). */
  progress: LevelProgress;
  /** Weekly-streak metadata (days, multiplier, tiers). */
  streak: StreakMultiplier;
  /** True when the active multiplier grants a bonus (>1x). */
  isStreakMultiplied: boolean;
  /** Live snapshot of the last rep reward (null between reps). */
  lastReward: RepRewardInfo | null;
  /** Queued floating XP popups (capped at 4, auto-expiring). */
  floatingXp: FloatingXpItem[];
  /** Level-up snapshot awaiting the reward sequence, or null. */
  levelUp: LevelUpData | null;
  /** True while the level-up celebration is pending/playing. */
  isLevelingUp: boolean;
  /** Dismiss + clear the pending level-up celebration. */
  dismissLevelUp: () => void;
  /** Monotonic counter bumped on every streak-bonus award (HUD pulse). */
  streakBonusPulse: number;
}

const FLOAT_TTL_MS = 1500;
const MAX_FLOAT_ITEMS = 4;

let floatId = 0;

export function useProgression(): ProgressionApi {
  const level = usePlayerStore((s) => s.player.currentLevel);
  const currentXp = usePlayerStore((s) => s.player.currentXp);
  const xpToNextLevel = usePlayerStore((s) => s.player.xpToNextLevel);
  const streakDays = usePlayerStore((s) => s.streak.currentStreak);
  const lastReward = usePlayerStore((s) => s.lastRepReward);
  const levelUp = usePlayerStore((s) => s.levelUp);

  const streak = useMemo(() => getStreakMultiplier(streakDays), [streakDays]);
  const isStreakMultiplied = streak.multiplier > 1;

  const progress: LevelProgress = useMemo(
    () => ({
      currentXp,
      xpToNextLevel,
      percent: Math.min(100, Math.round((currentXp / Math.max(1, xpToNextLevel)) * 100)),
    }),
    [currentXp, xpToNextLevel]
  );

  // ---- floating +XP queue (streak bonus popups) --------------------------
  const [floatingXp, setFloatingXp] = useState<FloatingXpItem[]>([]);

  useEffect(() => {
    if (!lastReward) return;
    const id = ++floatId;
    setFloatingXp((items) =>
      [...items, { id, ...lastReward }].slice(-MAX_FLOAT_ITEMS)
    );
    const timer = window.setTimeout(() => {
      setFloatingXp((items) => items.filter((it) => it.id !== id));
    }, FLOAT_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [lastReward]);

  // ---- streak bonus pulse counter -----------------------------------------
  const [streakBonusPulse, setStreakBonusPulse] = useState(0);
  useEffect(() => {
    if (lastReward && lastReward.bonusXp > 0) {
      setStreakBonusPulse((n) => n + 1);
    }
  }, [lastReward]);

  // ---- level-up trigger flag ----------------------------------------------
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const prevLevelUpRef = useRef<LevelUpData | null>(null);

  useEffect(() => {
    if (levelUp && levelUp !== prevLevelUpRef.current) {
      prevLevelUpRef.current = levelUp;
      setIsLevelingUp(true);
    }
  }, [levelUp]);

  const dismissLevelUp = useMemo(
    () => () => {
      setIsLevelingUp(false);
      usePlayerStore.getState().consumeLevelUp();
    },
    []
  );

  return {
    level,
    progress,
    streak,
    isStreakMultiplied,
    lastReward,
    floatingXp,
    levelUp,
    isLevelingUp,
    dismissLevelUp,
    streakBonusPulse,
  };
}

export type { LevelUpData, RepRewardInfo };