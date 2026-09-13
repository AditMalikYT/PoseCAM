/* ============================================================================
   Cosmetic Rewards, Rarity Tier & Visual Progression System
   ----------------------------------------------------------------------------
   Pure data layer: rarity tiers, item categories, inventory shape, unlock
   rules and the default roster. No React / Three.js imports — cleanly
   decoupled from exercise tracking (playerStore lives in state/).
============================================================================ */
import type { PlayerProgression, StreakData } from './player';

/* ----------------------------------------------------------------------------
   Rarity tiers
---------------------------------------------------------------------------- */
export type RarityTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface RarityConfig {
  label: string;
  /** 0 common -> 3 legendary; used for auto-equip priority. */
  rank: number;
  /** Primary accent color (HUD + 3D aura + borders). */
  color: string;
  /** Soft glow rgba for CSS box-shadows / beams. */
  glow: string;
  /** Thematic drop-rate percentage (arcade flavor, not a live RNG). */
  dropRate: number;
  /** Grade label shown under the name in the locker. */
  grade: string;
}

export const RARITY_TIERS: Record<RarityTier, RarityConfig> = {
  common: {
    label: 'COMMON',
    rank: 0,
    color: '#aeb6c4',
    glow: 'rgba(174, 182, 196, 0.55)',
    dropRate: 60,
    grade: 'SLATE CORE',
  },
  rare: {
    label: 'RARE',
    rank: 1,
    color: '#00e5ff',
    glow: 'rgba(0, 229, 255, 0.6)',
    dropRate: 25,
    grade: 'ELECTRIC CYAN',
  },
  epic: {
    label: 'EPIC',
    rank: 2,
    color: '#b967ff',
    glow: 'rgba(185, 103, 255, 0.6)',
    dropRate: 10,
    grade: 'CYBER PURPLE',
  },
  legendary: {
    label: 'LEGENDARY',
    rank: 3,
    color: '#ffb800',
    glow: 'rgba(255, 184, 0, 0.7)',
    dropRate: 5,
    grade: 'RADIANT AMBER',
  },
};

export const RARITY_ORDER: RarityTier[] = ['common', 'rare', 'epic', 'legendary'];

export function rarityConfig(r: RarityTier): RarityConfig {
  return RARITY_TIERS[r];
}

export function rarityRank(r: RarityTier): number {
  return RARITY_TIERS[r].rank;
}

/* ----------------------------------------------------------------------------
   Item categories
---------------------------------------------------------------------------- */
export type ItemCategory = 'avatar' | 'aura' | 'accessory';

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  avatar: 'Avatars',
  aura: 'Auras',
  accessory: 'Accessories',
};

export const CATEGORY_ORDER: ItemCategory[] = ['avatar', 'aura', 'accessory'];

/* ----------------------------------------------------------------------------
   Cosmetic item schemas
---------------------------------------------------------------------------- */
export interface CosmeticUnlockRequirements {
  level?: number;
  totalReps?: number;
  /** Current weekly streak needed. */
  streakDays?: number;
  /** Longest streak ever achieved. */
  longestStreak?: number;
}

/** Visual config consumed by the AuraRenderer (3D scene). */
export interface AuraVisual {
  color: string;
  mode: 'orbit' | 'swarm' | 'chest-glow' | 'trail';
  /** 0..1 intensity multiplier. */
  intensity: number;
  particleCount: number;
  ringRadius?: number;
  /** MediaPipe landmark indices to attach trail particles to. */
  trailJoints?: number[];
  /** Landmark indices wrapped by the orbit ring. */
  anchorJoints?: number[];
}

/** Visual config for accessory attachments (skeletal node FX). */
export interface AccessoryVisual {
  joints: number[];
  color: string;
  nodeSize: number;
  trail?: boolean;
}

export interface CosmeticItem {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: RarityTier;
  description: string;
  unlockRequirements: CosmeticUnlockRequirements;
  unlocked: boolean;
  equipped: boolean;
  /** Avatar accent used by the HUD (character card ring / chip). */
  avatarColor?: string;
  aura?: AuraVisual;
  accessory?: AccessoryVisual;
}

export interface UserInventoryState {
  items: CosmeticItem[];
  /** One equipped item per category. */
  equipped: Record<ItemCategory, string | null>;
}

/* ----------------------------------------------------------------------------
   Progression snapshot (shape derived from persisted player/streak state)
---------------------------------------------------------------------------- */
export interface ProgressionSnapshot {
  level: number;
  totalReps: number;
  totalWorkouts: number;
  streak: number;
  longestStreak: number;
}

export function buildProgressionSnapshot(
  player: Pick<PlayerProgression, 'currentLevel' | 'stats'>,
  streak: Pick<StreakData, 'currentStreak' | 'longestStreak'>
): ProgressionSnapshot {
  return {
    level: player.currentLevel,
    totalReps: player.stats.totalReps ?? 0,
    totalWorkouts: player.stats.totalWorkouts ?? 0,
    streak: streak.currentStreak,
    longestStreak: streak.longestStreak,
  };
}

/* ----------------------------------------------------------------------------
   Unlock rules
---------------------------------------------------------------------------- */
export function passesRequirements(req: CosmeticUnlockRequirements, snap: ProgressionSnapshot): boolean {
  return (
    (req.level === undefined || snap.level >= req.level) &&
    (req.totalReps === undefined || snap.totalReps >= req.totalReps) &&
    (req.streakDays === undefined || snap.streak >= req.streakDays) &&
    (req.longestStreak === undefined || snap.longestStreak >= req.longestStreak)
  );
}

/** Human-readable unlock condition, e.g. "Reach Level 5 · 500 total reps". */
export function unlockRequirementText(req: CosmeticUnlockRequirements): string {
  const parts: string[] = [];
  if (req.level !== undefined) parts.push(`Reach Level ${req.level}`);
  if (req.totalReps !== undefined) parts.push(`${req.totalReps.toLocaleString()} total reps`);
  if (req.streakDays !== undefined) parts.push(`${req.streakDays}-day streak`);
  if (req.longestStreak !== undefined) parts.push(`${req.longestStreak}-day best streak`);
  return parts.join(' · ');
}

/** Compare two rarities: true when `a` strictly outranks `b`. */
export function outranks(a: RarityTier, b: RarityTier): boolean {
  return rarityRank(a) > rarityRank(b);
}

/* ----------------------------------------------------------------------------
   Default roster — seeded on first run (every new save starts with these).
   `unlocked`/`equipped` are lifecycle flags set by the inventory store.
---------------------------------------------------------------------------- */
type RosterSeed = Omit<CosmeticItem, 'unlocked' | 'equipped'>;

// MediaPipe pose landmark indices (see types/pose.ts):
// 0 nose · 7/8 ears · 11/12 shoulders · 13/14 elbows · 15/16 wrists
// 23/24 hips · 25/26 knees · 27/28 ankles · 11-12-24-23 chest center
export const CHEST_CENTER_JOINTS = [11, 12, 23, 24];
export const CHEST_PLUS = [11, 12, 13, 14, 23, 24];

export const DEFAULT_COSMETIC_ITEMS: RosterSeed[] = [
  /* ---- AVATARS ---------------------------------------------------------- */
  {
    id: 'av-starter',
    name: 'Starter Core',
    category: 'avatar',
    rarity: 'common',
    description: 'Your base training rig. Chrome-slate plating with a warm core.',
    unlockRequirements: {},
    avatarColor: '#aeb6c4',
  },
  {
    id: 'av-neon-prime',
    name: 'Neon Prime',
    category: 'avatar',
    rarity: 'rare',
    description: 'Electric circuit filament running down the spine.',
    unlockRequirements: { level: 5 },
    avatarColor: '#00e5ff',
  },
  {
    id: 'av-phantom',
    name: 'Phantom Vanguard',
    category: 'avatar',
    rarity: 'epic',
    description: 'Cybernetic vanguard frame with a deep violet core.',
    unlockRequirements: { totalReps: 500 },
    avatarColor: '#b967ff',
  },
  {
    id: 'av-sovereign',
    name: 'Apex Sovereign',
    category: 'avatar',
    rarity: 'legendary',
    description: 'The apex rig. Radiant amber keyed to your personal best.',
    unlockRequirements: { totalReps: 2000 },
    avatarColor: '#ffb800',
  },

  /* ---- AURAS ------------------------------------------------------------ */
  {
    id: 'au-static',
    name: 'Static Calibration',
    category: 'aura',
    rarity: 'common',
    description: 'A faint slate calibration field while you train.',
    unlockRequirements: {},
    aura: { color: '#8fa3b8', mode: 'orbit', intensity: 0.35, particleCount: 48, ringRadius: 0.42, anchorJoints: CHEST_CENTER_JOINTS },
  },
  {
    id: 'au-vortex',
    name: 'Vortex Run',
    category: 'aura',
    rarity: 'rare',
    description: 'Electric cyan swarm spiraling around your torso core.',
    unlockRequirements: { streakDays: 3 },
    aura: { color: '#00e5ff', mode: 'swarm', intensity: 0.8, particleCount: 90, ringRadius: 0.55, anchorJoints: CHEST_CENTER_JOINTS },
  },
  {
    id: 'au-soulburn',
    name: 'Soul Burn',
    category: 'aura',
    rarity: 'epic',
    description: 'Cyber-purple chest glow that flares hard at the bottom of a rep.',
    unlockRequirements: { level: 15 },
    aura: { color: '#b967ff', mode: 'chest-glow', intensity: 1, particleCount: 120, anchorJoints: CHEST_PLUS },
  },
  {
    id: 'au-radiant',
    name: 'Radiant Aurelius',
    category: 'aura',
    rarity: 'legendary',
    description: 'Wrists ignite with amber trails, torso wrapped in rotating light.',
    unlockRequirements: { longestStreak: 7 },
    aura: { color: '#ffb800', mode: 'trail', intensity: 1, particleCount: 160, ringRadius: 0.6, anchorJoints: CHEST_CENTER_JOINTS, trailJoints: [15, 16] },
  },

  /* ---- ACCESSORIES ------------------------------------------------------ */
  {
    id: 'ac-titan-wraps',
    name: 'Titan Wraps',
    category: 'accessory',
    rarity: 'common',
    description: 'Slate combat wraps on both wrists.',
    unlockRequirements: { totalReps: 50 },
    accessory: { joints: [15, 16], color: '#aeb6c4', nodeSize: 0.035 },
  },
  {
    id: 'ac-volt-gauntlets',
    name: 'Volt Gauntlets',
    category: 'accessory',
    rarity: 'rare',
    description: 'Spark-dripping cyan gauntlets that leave light trails.',
    unlockRequirements: { level: 6 },
    accessory: { joints: [15, 16], color: '#00e5ff', nodeSize: 0.042, trail: true },
  },
  {
    id: 'ac-phantom-band',
    name: 'Phantom Headband',
    category: 'accessory',
    rarity: 'epic',
    description: 'A hovering violet ring over the crown.',
    unlockRequirements: { streakDays: 5 },
    accessory: { joints: [0], color: '#b967ff', nodeSize: 0.05, trail: true },
  },
  {
    id: 'ac-comet-streaks',
    name: 'Comet Streaks',
    category: 'accessory',
    rarity: 'epic',
    description: 'Twin cyan meteor trails from both elbows.',
    unlockRequirements: { totalReps: 1000 },
    accessory: { joints: [13, 14], color: '#00e5ff', nodeSize: 0.04, trail: true },
  },
  {
    id: 'ac-ember-crown',
    name: 'Ember Crown',
    category: 'accessory',
    rarity: 'legendary',
    description: 'Ancient amber crown. Seven-day champions only.',
    unlockRequirements: { longestStreak: 14 },
    accessory: { joints: [0], color: '#ffb800', nodeSize: 0.055, trail: true },
  },
];

/** Seed a fresh inventory with a free starter item per category equipped. */
export function seedInventory(): UserInventoryState {
  const items: CosmeticItem[] = DEFAULT_COSMETIC_ITEMS.map((seed) => ({
    ...seed,
    unlocked: Object.keys(seed.unlockRequirements).length === 0,
    equipped: false,
  }));
  const equipped = {
    avatar: items.find((i) => i.category === 'avatar' && i.unlocked)?.id ?? null,
    aura: items.find((i) => i.category === 'aura' && i.unlocked)?.id ?? null,
    accessory: null as string | null,
  } as Record<ItemCategory, string | null>;
  return { items, equipped };
}

export function isRosterSeed(c: CosmeticItem): boolean {
  return 'category' in c && 'rarity' in c && Array.isArray(c.aura ?? c.accessory ?? undefined) === false && (c.aura !== undefined || c.accessory !== undefined || c.avatarColor !== undefined);
}

/** True when a persisted item predates the category-based schema. */
export function isLegacyInventoryItem(c: unknown): boolean {
  if (!c || typeof c !== 'object') return true;
  const it = c as Partial<CosmeticItem>;
  return typeof it.category !== 'string' || !CATEGORY_ORDER.includes(it.category as ItemCategory);
}