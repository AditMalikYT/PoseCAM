import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerProgression, StreakData, CosmeticItem, ItemCategory, Achievement, UserSettings, BossState, ExerciseSessionState, ExerciseType } from '../types';
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
import {
  seedInventory,
  buildProgressionSnapshot,
  passesRequirements,
  rarityRank,
  outranks,
  CATEGORY_ORDER,
  isLegacyInventoryItem,
} from '../types/cosmetics';
import { eventBus, Events } from '../events/eventBus';

const seed = seedInventory();

const defaultPlayer: PlayerProgression = {
  currentLevel: 1, currentXp: 0, totalXpEarned: 0, xpToNextLevel: xpForLevel(1),
  stats: { strength: 10, endurance: 10, flexibility: 5, totalReps: 0, totalWorkouts: 0 },
  levelHistory: [], createdDate: new Date().toISOString(), lastWorkoutDate: null,
};
const defaultStreak: StreakData = {
  currentStreak: 0, longestStreak: 0, lastWorkoutDate: new Date().toISOString(), streakStartDate: new Date().toISOString(),
};
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
  /** One equipped cosmetic id per category. */
  equipped: Record<ItemCategory, string | null>;
  /** Queue of recently unlocked items awaiting the celebration modal. */
  pendingUnlocks: CosmeticItem[];
  /** Transient per-rep reward (floating XP + streak bonus). Cleared by the next rep. */
  lastRepReward: RepRewardInfo | null;
  /** Transient level-up snapshot ready for the reward sequence. */
  levelUp: LevelUpData | null;
  addXp: (amount: number) => void; addRep: (formScore: number) => void;
  consumeLevelUp: () => void;
  startBossBattle: (bossId: string, bossName: string, maxHealth: number) => void;
  damageBoss: (damage: number, formScore: number) => void; defeatBoss: () => void;
  updateStreak: () => void;
  /** Evaluate all lock requirements against live progression; unlock + queue + auto-equip better rarities. */
  syncCosmeticUnlocks: () => void;
  unlockCosmetic: (id: string) => void; equipCosmetic: (id: string) => void;
  dismissPendingUnlock: (id: string) => void; flushPendingUnlocks: () => void;
  unlockAchievement: (id: string) => void; updateAchievementProgress: (id: string, progress: number) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  startSession: (type: ExerciseType) => void; endSession: () => void; addRepToSession: (xp: number) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      player: defaultPlayer, streak: defaultStreak, cosmetics: seed.items,
      achievements: defaultAchievements, settings: defaultSettings,
      boss: defaultBoss, session: defaultSession,
      equipped: seed.equipped, pendingUnlocks: [],
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
        get().syncCosmeticUnlocks();
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
        // Milestone: cumulative reps across the whole account
        const cur = get().player;
        set({
          player: { ...cur, stats: { ...cur.stats, totalReps: cur.stats.totalReps + 1 } },
          lastRepReward: {
            formScore, baseXp, totalXp, bonusXp, multiplier,
            streakDays, tierLabel, perfect: formScore >= 95,
          },
        });
        get().updateAchievementProgress('fr', get().player.stats.totalReps);
        if (bonusXp > 0) {
          eventBus.emit(Events.STREAK_BONUS_AWARDED, { bonusXp, multiplier, streakDays });
        }
        get().syncCosmeticUnlocks();
      },
      syncCosmeticUnlocks: () => {
        const state = get();
        const snap = buildProgressionSnapshot(state.player, state.streak);
        const items: CosmeticItem[] = [];
        const newly: CosmeticItem[] = [];
        for (const seedItem of state.cosmetics) {
          if (!seedItem.unlocked && passesRequirements(seedItem.unlockRequirements, snap)) {
            const unlocked = { ...seedItem, unlocked: true };
            items.push(unlocked);
            newly.push(unlocked);
          } else {
            items.push(seedItem);
          }
        }
        if (newly.length === 0) return;

        // Auto-equip the best newly-unlocked rarity per category
        const equipped = { ...state.equipped };
        for (const cat of CATEGORY_ORDER) {
          const current = equipped[cat] ? items.find((i) => i.id === equipped[cat]) : null;
          const best = newly
            .filter((i) => i.category === cat)
            .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
          if (best && (!current || outranks(best.rarity, current.rarity))) equipped[cat] = best.id;
        }
        const finalItems = items.map((i) => ({ ...i, equipped: equipped[i.category] === i.id }));
        const pendingUnlocks = [...state.pendingUnlocks, ...newly].slice(-6);
        set({ cosmetics: finalItems, equipped, pendingUnlocks });
        for (const item of newly) eventBus.emit(Events.COSMETIC_UNLOCKED, item);
      },
      unlockCosmetic: (id) => {
        const state = get();
        const existing = state.cosmetics.find((c) => c.id === id);
        if (!existing || existing.unlocked) return;
        const unlocked = { ...existing, unlocked: true };
        set({
          cosmetics: state.cosmetics.map((c) => (c.id === id ? unlocked : c)),
          pendingUnlocks: [...state.pendingUnlocks, unlocked].slice(-6),
        });
        eventBus.emit(Events.COSMETIC_UNLOCKED, unlocked);
      },
      equipCosmetic: (id) => {
        const state = get();
        const item = state.cosmetics.find((c) => c.id === id);
        if (!item || !item.unlocked) return;
        if (state.equipped[item.category] === id) return;
        const equipped: Record<ItemCategory, string | null> = { ...state.equipped };
        equipped[item.category] = id;
        set({
          cosmetics: state.cosmetics.map((c) =>
            c.category === item.category ? { ...c, equipped: c.id === id } : c
          ),
          equipped,
        });
        eventBus.emit(Events.COSMETIC_EQUIPPED, { item, category: item.category });
      },
      dismissPendingUnlock: (id) =>
        set({ pendingUnlocks: get().pendingUnlocks.filter((u) => u.id !== id) }),
      flushPendingUnlocks: () => set({ pendingUnlocks: [] }),
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
      unlockAchievement: (id) => { const a = get().achievements.find(x => x.id === id); if (a && !a.unlocked) set({ achievements: get().achievements.map(x => x.id === id ? { ...x, unlocked: true, unlockedDate: new Date().toISOString() } : x) }); },
      updateAchievementProgress: (id, progress) => { set({ achievements: get().achievements.map(a => a.id === id ? { ...a, progress: Math.min(a.requirements.target, progress) } : a) }); const a = get().achievements.find(x => x.id === id); if (a && a.progress >= a.requirements.target) get().unlockAchievement(id); },
      updateSettings: (newSettings) => set({ settings: { ...get().settings, ...newSettings } }),
      startSession: (type) => set({ session: { ...defaultSession, exerciseType: type, isActive: true, startTime: Date.now() } }),
      endSession: () => {
        const s = get();
        const dur = s.session.startTime ? (Date.now() - s.session.startTime) / 1000 : 0;
        const cur = get().player;
        set({
          session: { ...s.session, isActive: false, duration: dur },
          player: { ...cur, stats: { ...cur.stats, totalWorkouts: cur.stats.totalWorkouts + 1 } },
        });
        get().syncCosmeticUnlocks();
      },
      addRepToSession: (xp) => set({ session: { ...get().session, repCount: get().session.repCount + 1, sessionXp: get().session.sessionXp + xp } }),
    }),
    {
      name: 'argym-player-store',
      version: 3,
      migrate: (persisted, _version) => {
        const state = (persisted ?? {}) as Partial<PlayerStore>;
        const stored = Array.isArray(state.cosmetics) ? (state.cosmetics as CosmeticItem[]) : [];
        // Reseed on schema changes: v1 predates the category schema, and v2
        // predates the 2D `imageUrl` avatar roster (v3).
        const needsReseed =
          !Array.isArray(state.cosmetics) ||
          stored.some(isLegacyInventoryItem) ||
          !stored.some((c) => c.category === 'avatar' && typeof c.imageUrl === 'string');
        const cosmetics = needsReseed ? seed.items : stored;
        const equipped: Record<ItemCategory, string | null> = needsReseed
          ? seed.equipped
          : (state.equipped ?? { avatar: null, aura: null, accessory: null });
        const migrated = {
          ...state,
          cosmetics,
          equipped,
          pendingUnlocks: [],
        };
        return migrated as PlayerStore;
      },
      partialize: (state) => ({
        player: state.player,
        streak: state.streak,
        cosmetics: state.cosmetics,
        achievements: state.achievements,
        settings: state.settings,
        equipped: state.equipped,
      }),
    }
  )
);