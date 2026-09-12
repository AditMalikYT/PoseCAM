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
