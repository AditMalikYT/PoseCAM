import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerProgression, StreakData, CosmeticItem, Achievement, UserSettings, BossState, ExerciseSessionState, ExerciseType } from '../types';
import {
  xpForLevel,
  levelFromXp,
  calculateXpForRep,
  getStreakMultiplier,
  applyStreakXp,
  calculateStatIncreases,
  xpFloorForLevel,
  rolloverXp,
} from '../types/progression';
import type { LevelUpData, RepRewardInfo } from '../types/progression';
import { eventBus, Events } from '../events/eventBus';
const defaultPlayer: PlayerProgression = {
  currentLevel: 1, currentXp: 0, totalXpEarned: 0, xpToNextLevel: xpForLevel(1),
  stats: { strength: 10, endurance: 10, flexibility: 5, totalReps: 0, totalWorkouts: 0 },
  levelHistory: [], createdDate: new Date().toISOString(), lastWorkoutDate: null,
};
const defaultStreak: StreakData = {
  currentStreak: 0, longestStreak: 0, lastWorkoutDate: new Date().toISOString(), streakStartDate: new Date().toISOString(),
};
const defaultCosmetics: CosmeticItem[] = [
  { id: 'cs', name: 'Starter Outfit', type: 'costume', rarity: 'common', description: 'Basic', unlockRequirements: {}, unlocked: true, equipped: true },
  { id: 'ag', name: 'Golden Aura', type: 'aura', rarity: 'rare', description: 'Golden shimmer', unlockRequirements: { level: 5 }, unlocked: false, equipped: false },
];
const defaultAchievements: Achievement[] = [
  { id: 'fr', name: 'First Steps', description: 'Complete your first rep', requirements: { type: 'reps', target: 1, exerciseType: 'pushups' }, unlocked: false, progress: 0 },
];
const defaultSettings: UserSettings = {
  poseModelComplexity: 1, autoStartCamera: true, soundEnabled: true, hapticFeedback: false,
  videoMirrored: true, arIntensity: 'medium', language: 'en', showFormFeedback: true,
};
const defaultBoss: BossState = {
  isActive: false, bossId: null, bossName: '', bossHealth: 0, maxHealth: 0,
  damageDealt: 0, currentPhase: 'idle', phaseStartTime: null, comboCount: 0,
  lastHitTime: null, specialAttackImminent: false,
};
const defaultSession: ExerciseSessionState = {
  exerciseType: 'pushups', isActive: false, repCount: 0, currentRepNumber: 0,
  startTime: null, lastRepTime: null, totalFormScore: 100, formScoreSum: 0,
  currentFormScore: 100, consecutiveGoodReps: 0, consecutiveBadReps: 0,
  phaseStartTime: null, repHistory: [], sessionReps: 0, estimatedCalories: 0,
  sessionXp: 0, duration: 0,
};
interface PlayerStore {
  player: PlayerProgression; streak: StreakData; cosmetics: CosmeticItem[];
  achievements: Achievement[]; settings: UserSettings; boss: BossState; session: ExerciseSessionState;
  /** Transient per-rep reward (floating XP + streak bonus). Cleared by the next rep. */
  lastRepReward: RepRewardInfo | null;
  /** Transient level-up snapshot ready for the reward sequence. */
  levelUp: LevelUpData | null;
  addXp: (amount: number) => void; addRep: (formScore: number) => void;
  consumeLevelUp: () => void;
  startBossBattle: (bossId: string, bossName: string, maxHealth: number) => void;
  damageBoss: (damage: number, formScore: number) => void; defeatBoss: () => void;
  updateStreak: () => void; unlockCosmetic: (id: string) => void; equipCosmetic: (id: string) => void;
  unlockAchievement: (id: string) => void; updateAchievementProgress: (id: string, progress: number) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  startSession: (type: ExerciseType) => void; endSession: () => void; addRepToSession: (xp: number) => void;
}
export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      player: defaultPlayer, streak: defaultStreak, cosmetics: defaultCosmetics,
      achievements: defaultAchievements, settings: defaultSettings,
      boss: defaultBoss, session: defaultSession,
      lastRepReward: null, levelUp: null,
      addXp: (amount: number) => {
        const state = get();
        const prevLevel = state.player.currentLevel;
        const newTotalXp = state.player.totalXpEarned + amount;
        const newLevel = levelFromXp(newTotalXp);
        let stats = state.player.stats;
        let levelUp: LevelUpData | null = null;

        if (newLevel > prevLevel) {
          const increases = calculateStatIncreases(state.player.stats, newLevel);
          stats = {
            ...stats,
            strength: stats.strength + (increases.strength ?? 0),
            endurance: stats.endurance + (increases.endurance ?? 0),
            flexibility: stats.flexibility + (increases.flexibility ?? 0),
          };
          levelUp = {
            previousLevel: prevLevel,
            newLevel,
            xpBefore: state.player.totalXpEarned,
            xpAfter: newTotalXp,
            xpGained: amount,
            newStatIncreases: increases,
          };
        }

        set({
          player: {
            ...state.player,
            currentXp: rolloverXp(newTotalXp, newLevel),
            totalXpEarned: newTotalXp,
            currentLevel: newLevel,
            xpToNextLevel: xpForLevel(newLevel + 1),
            stats,
          },
          levelUp,
        });
        if (levelUp) eventBus.emit(Events.LEVEL_UP, levelUp);
        eventBus.emit(Events.XP_GAINED, { amount, total: newTotalXp });
      },
      consumeLevelUp: () => set({ levelUp: null }),
      addRep: (formScore: number) => {
        const state = get();
        get().updateStreak();
        const streakDays = get().streak.currentStreak;
        const baseXp = calculateXpForRep(state.player.currentLevel, formScore);
        const { totalXp, bonusXp, multiplier, tierLabel } = applyStreakXp(baseXp, streakDays);
        get().addXp(totalXp);
        get().addRepToSession(totalXp);
        set({
          lastRepReward: {
            formScore, baseXp, totalXp, bonusXp, multiplier,
            streakDays, tierLabel, perfect: formScore >= 95,
          },
        });
        get().updateAchievementProgress('fr', 1);
        if (bonusXp > 0) {
          eventBus.emit(Events.STREAK_BONUS_AWARDED, { bonusXp, multiplier, streakDays });
        }
      },
      startBossBattle: (bossId, bossName, maxHealth) => set({
        boss: { isActive: true, bossId, bossName, bossHealth: maxHealth, maxHealth, damageDealt: 0, currentPhase: 'battle', phaseStartTime: Date.now(), comboCount: 0, lastHitTime: null, specialAttackImminent: false },
      }),
      damageBoss: (damage, formScore) => {
        const state = get();
        const boss = state.boss;
        if (!boss.isActive) return;
        const combo = boss.lastHitTime ? (Date.now() - boss.lastHitTime < 3000 ? boss.comboCount + 1 : 1) : 1;
        const dmg = Math.round(damage * (1 + Math.min(combo, 10) * 0.05) * (0.5 + formScore / 200));
        set({ boss: { ...boss, bossHealth: Math.max(0, boss.bossHealth - dmg), damageDealt: boss.damageDealt + dmg, comboCount: combo, lastHitTime: Date.now() } });
        if (boss.bossHealth - dmg <= 0) get().defeatBoss();
      },
      defeatBoss: () => { const s = get(); set({ boss: { ...s.boss, currentPhase: 'victory', isActive: false } }); },
      updateStreak: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        const lastDate = state.streak.lastWorkoutDate?.split('T')[0];
        let newStreak = state.streak.currentStreak;
        if (!lastDate) newStreak = 1;
        else if (lastDate !== today) { const y = new Date(); y.setDate(y.getDate() - 1); if (lastDate !== y.toISOString().split('T')[0]) newStreak = 1; else newStreak += 1; }
        set({ streak: { ...state.streak, currentStreak: newStreak, lastWorkoutDate: new Date().toISOString(), longestStreak: Math.max(state.streak.longestStreak, newStreak) } });
      },
      unlockCosmetic: (id) => set({ cosmetics: get().cosmetics.map(c => c.id === id ? { ...c, unlocked: true } : c) }),
      equipCosmetic: (id) => set({ cosmetics: get().cosmetics.map(c => c.id === id ? { ...c, equipped: !c.equipped } : c) }),
      unlockAchievement: (id) => { const a = get().achievements.find(x => x.id === id); if (a && !a.unlocked) set({ achievements: get().achievements.map(x => x.id === id ? { ...x, unlocked: true, unlockedDate: new Date().toISOString() } : x) }); },
      updateAchievementProgress: (id, progress) => { set({ achievements: get().achievements.map(a => a.id === id ? { ...a, progress: Math.min(a.requirements.target, progress) } : a) }); const a = get().achievements.find(x => x.id === id); if (a && a.progress >= a.requirements.target) get().unlockAchievement(id); },
      updateSettings: (newSettings) => set({ settings: { ...get().settings, ...newSettings } }),
      startSession: (type) => set({ session: { ...defaultSession, exerciseType: type, isActive: true, startTime: Date.now() } }),
      endSession: () => { const s = get(); const dur = s.session.startTime ? (Date.now() - s.session.startTime) / 1000 : 0; set({ session: { ...s.session, isActive: false, duration: dur } }); },
      addRepToSession: (xp) => set({ session: { ...get().session, repCount: get().session.repCount + 1, sessionXp: get().session.sessionXp + xp } }),
    }),
    { name: 'argym-player-store', version: 1, partialize: (state) => ({ player: state.player, streak: state.streak, cosmetics: state.cosmetics, achievements: state.achievements, settings: state.settings }) }
  )
);
