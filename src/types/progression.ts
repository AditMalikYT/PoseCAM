// Progression types
export interface ProgressionConfig {
  baseXpPerRep: number;
  xpMultiplierPerLevel: number;
  statPointsPerLevel: number;
  formsRequiredForPerfectBonus: number;
}

// Level-up calculation
export interface LevelUpData {
  previousLevel: number;
  newLevel: number;
  xpBefore: number;
  xpAfter: number;
  xpGained: number;
  newStatIncreases: {
    strength?: number;
    endurance?: number;
    flexibility?: number;
  };
  newAchievements?: string[];
  newCosmetics?: string[];
}

// Boss scaling parameters
export interface BossScalingParams {
  baseHealth: number;
  healthPerLevel: number;
  xpPerRep: number;
  xpMultiplierPerLevel: number;
  minReps: number;
  maxReps: number;
}

// Experience and level calculation utilities
export const PROGRESSION_CONFIG: ProgressionConfig = {
  baseXpPerRep: 10,
  xpMultiplierPerLevel: 1.1,
  statPointsPerLevel: 5,
  formsRequiredForPerfectBonus: 5,
};

// XP calculation based on level and form
export function calculateXpForRep(
  level: number,
  formScore: number,
  baseXp: number = PROGRESSION_CONFIG.baseXpPerRep
): number {
  const levelMultiplier = Math.pow(PROGRESSION_CONFIG.xpMultiplierPerLevel, level - 1);
  const formMultiplier = 0.5 + (formScore / 100) * 0.5;  // 0.5 to 1.0
  
  let xp = baseXp * levelMultiplier * formMultiplier;
  
  // Perfect form bonus (formScore >= 95)
  if (formScore >= 95) {
    xp *= 1.5;
  }
  
  return Math.round(xp);
}

// Calculate total XP needed for a level
export function xpForLevel(level: number): number {
  // Exponential curve: each level requires more XP
  return Math.round(100 * Math.pow(1.5, level - 1));
}

// Determine level from total XP
export function levelFromXp(totalXp: number): number {
  let level = 1;
  let xpNeeded = xpForLevel(level);
  let accumulatedXp = 0;
  
  while (accumulatedXp + xpNeeded <= totalXp) {
    accumulatedXp += xpNeeded;
    level++;
    xpNeeded = xpForLevel(level);
  }
  
  return level;
}

// Get progress to next level (0-100%)
export function progressToNextLevel(currentXp: number, currentLevel: number): number {
  const xpAtCurrentLevel = currentXp - (totalXpForLevel(currentLevel - 1) || 0);
  const xpNeeded = xpForLevel(currentLevel);
  return Math.min(100, (xpAtCurrentLevel / xpNeeded) * 100);
}

// Total XP accumulated up to a level
function totalXpForLevel(level: number): number {
  if (level <= 0) return 0;
  
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

// Calculate stat increases for level up
export function calculateStatIncreases(
  currentStats: { strength: number; endurance: number; flexibility: number },
  newLevel: number
): { strength?: number; endurance?: number; flexibility?: number } {
  const statPoints = PROGRESSION_CONFIG.statPointsPerLevel;
  const increases: { strength?: number; endurance?: number; flexibility?: number } = {};
  
  // Distribute stat points based on exercise type weights
  // This would be customized per player preference in full implementation
  increases.strength = Math.floor(statPoints * 0.4);
  increases.endurance = Math.floor(statPoints * 0.4);
  increases.flexibility = statPoints - increases.strength! - increases.endurance!;
  
  return increases;
}

// Boss scaling configuration
export const BOSS_SCALING: BossScalingParams = {
  baseHealth: 100,
  healthPerLevel: 50,
  xpPerRep: 10,
  xpMultiplierPerLevel: 1.2,
  minReps: 10,
  maxReps: 100,
};

// Calculate boss health for a given level
export function calculateBossHealth(level: number): number {
  return Math.round(
    BOSS_SCALING.baseHealth + 
    (level - 1) * BOSS_SCALING.healthPerLevel
  );
}

// Calculate damage dealt based on form score
export function calculateDamage(
  formScore: number,
  comboCount: number,
  baseDamage: number = 10
): number {
  const formMultiplier = 0.2 + (formScore / 100) * 0.8;  // 0.2 to 1.0
  const comboMultiplier = 1 + Math.min(comboCount, 10) * 0.05;  // Up to 1.5x for 10 combo
  const critChance = formScore >= 95 ? 0.3 : 0;  // 30% crit chance for perfect form
  
  let damage = baseDamage * formMultiplier * comboMultiplier;
  
  // Critical hit
  if (Math.random() < critChance) {
    damage *= 2;
  }
  
  return Math.round(damage);
}

// Check if boss is defeated
export function isBossDefeated(
  bossHealth: number,
  damageDealt: number
): boolean {
  return damageDealt >= bossHealth;
}

// Calculate combo streak bonus
export function calculateComboBonus(consecutiveGoodReps: number): number {
  if (consecutiveGoodReps < 3) return 1;
  if (consecutiveGoodReps < 5) return 1.1;
  if (consecutiveGoodReps < 10) return 1.25;
  return 1.5;
}

/* ==========================================================================
   WEEKLY STREAK XP MULTIPLIER
   Consecutive workout days -> escalating XP multiplier.
   Day 1 = 1.0x · Day 3 = 1.25x · Day 7 = 2.0x "STREAK MASTER"
========================================================================== */

export interface StreakTier {
  /** Minimum consecutive workout days for this tier. */
  minDays: number;
  /** XP multiplier for this tier. */
  multiplier: number;
  /** Display label, e.g. "STREAK MASTER". */
  label: string;
  /** Flame / accent color. */
  color: string;
  /** Short flavor description shown in the tooltip. */
  description: string;
}

/** Ascending by minDays - lookup picks the highest tier reached. */
export const STREAK_TIERS: StreakTier[] = [
  { minDays: 1, multiplier: 1.0,  label: 'WARM-UP',        color: '#8b93a7', description: 'Fresh start - every rep counts!' },
  { minDays: 2, multiplier: 1.15, label: 'ON FIRE',        color: '#ffe9b8', description: '+15% bonus XP on every rep' },
  { minDays: 3, multiplier: 1.25, label: 'BLAZING',        color: '#ffdf8e', description: '+25% bonus XP - momentum builds' },
  { minDays: 4, multiplier: 1.4,  label: 'SCORCHING',      color: '#ffd166', description: '+40% bonus XP - unstoppable' },
  { minDays: 5, multiplier: 1.6,  label: 'INFERNO',        color: '#ffb800', description: '+60% bonus XP - pure grind' },
  { minDays: 6, multiplier: 1.8,  label: 'LEGENDARY',      color: '#ff6a3d', description: '+80% bonus XP - legendary pace' },
  { minDays: 7, multiplier: 2.0,  label: 'STREAK MASTER',  color: '#ff8800', description: '2x XP - you are the meta' },
];

export const STREAK_MASTER_DAY = STREAK_TIERS[STREAK_TIERS.length - 1].minDays;

export interface StreakMultiplier {
  /** Current streak length in days. */
  days: number;
  /** Active multiplier. */
  multiplier: number;
  /** (multiplier - 1) * 100, e.g. 25 for 1.25x. */
  bonusPct: number;
  /** Active tier metadata. */
  tier: StreakTier;
  /** Next tier up (higher multiplier) or null at max. */
  nextTier: StreakTier | null;
  /** Days remaining to reach the next tier. */
  daysToNextTier: number;
}

/** Resolve the active streak tier + next milestone. */
export function getStreakMultiplier(days: number): StreakMultiplier {
  const safe = Math.max(0, Math.floor(days));
  let tier = STREAK_TIERS[0];
  let tierIndex = 0;
  for (let i = 0; i < STREAK_TIERS.length; i++) {
    if (safe >= STREAK_TIERS[i].minDays) { tier = STREAK_TIERS[i]; tierIndex = i; }
  }
  const nextTier = tierIndex + 1 < STREAK_TIERS.length ? STREAK_TIERS[tierIndex + 1] : null;
  return {
    days: safe,
    multiplier: tier.multiplier,
    bonusPct: Math.round((tier.multiplier - 1) * 100),
    tier,
    nextTier,
    daysToNextTier: nextTier ? nextTier.minDays - safe : 0,
  };
}

/** Apply the active streak multiplier to a base XP amount. */
export function applyStreakXp(baseXp: number, streakDays: number): {
  baseXp: number;
  totalXp: number;
  bonusXp: number;
  multiplier: number;
  tierLabel: string;
  tierColor: string;
} {
  const meta = getStreakMultiplier(streakDays);
  const totalXp = Math.round(baseXp * meta.multiplier);
  return {
    baseXp,
    totalXp,
    bonusXp: totalXp - baseXp,
    multiplier: meta.multiplier,
    tierLabel: meta.tier.label,
    tierColor: meta.tier.color,
  };
}

/* ==========================================================================
   LEVEL-UP SCALING
   nextLevelMaxXP = prevMaxXP * LEVEL_XP_GROWTH (1.5x), matching xpForLevel.
========================================================================== */

export const LEVEL_XP_GROWTH = 1.5;

/** Scale the next level requirement dynamically. */
export function scaleNextLevelXp(previousMaxXp: number): number {
  return Math.round(previousMaxXp * LEVEL_XP_GROWTH);
}

/** Total XP consumed to *reach* a level (sum of all prior level thresholds). */
export function xpFloorForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForLevel(i);
  return total;
}

/** Rollover XP after crossing a level threshold: newLevelXp = totalXp - floor. */
export function rolloverXp(totalXp: number, newLevel: number): number {
  return Math.max(0, totalXp - xpFloorForLevel(newLevel));
}

/** Per-rep reward info surfaced to the UI (floating text, streak pulses). */
export interface RepRewardInfo {
  formScore: number;
  baseXp: number;
  totalXp: number;
  bonusXp: number;
  multiplier: number;
  streakDays: number;
  tierLabel: string;
  perfect: boolean;
}
