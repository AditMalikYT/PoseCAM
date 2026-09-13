/* ============================================================================
   Cosmetic Rewards, Rarity Tier & Visual Progression System
   ----------------------------------------------------------------------------
   Pure data layer: rarity tiers, item categories, inventory shape, unlock
   rules and the default roster. No React / Three.js imports — cleanly
   decoupled from exercise tracking (playerStore lives in state/).
============================================================================ */
import type { PlayerProgression, StreakData } from './player';
import avatarRosterData from '../data/cosmeticsData.json';

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
  /** 2D sprite asset for avatars (rendered in the locker + HUD). */
  imageUrl?: string;
  /** Optional human-readable unlock hint carried from the dataset (locked items). */
  unlockHint?: string;
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

   Avatar items live in `data/cosmeticsData.json` (lightweight 2D PNG sprites
   tuned for low-end mobile). Auras + accessories below stay data-driven here
   because their `aura`/`accessory` configs feed the Three.js AuraRenderer.
--------------------------------------------------------------------------- */
type RosterSeed = Omit<CosmeticItem, 'unlocked' | 'equipped'> & {
  /** Initial unlock state override (defaults to "no requirements → unlocked"). */
  startUnlocked?: boolean;
};

// MediaPipe pose landmark indices (see types/pose.ts):
// 0 nose · 7/8 ears · 11/12 shoulders · 13/14 elbows · 15/16 wrists
// 23/24 hips · 25/26 knees · 27/28 ankles · 11-12-24-23 chest center
export const CHEST_CENTER_JOINTS = [11, 12, 23, 24];
export const CHEST_PLUS = [11, 12, 13, 14, 23, 24];

export const DEFAULT_COSMETIC_ITEMS: RosterSeed[] = [
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
  const items: CosmeticItem[] = [...buildAvatarSeeds(), ...DEFAULT_COSMETIC_ITEMS].map((seed) => {
    const { startUnlocked, ...rest } = seed;
    return {
      ...rest,
      unlocked: startUnlocked ?? Object.keys(seed.unlockRequirements).length === 0,
      equipped: false,
    };
  });
  const equipped = {
    avatar: items.find((i) => i.category === 'avatar' && i.unlocked)?.id ?? null,
    aura: items.find((i) => i.category === 'aura' && i.unlocked)?.id ?? null,
    accessory: null as string | null,
  } as Record<ItemCategory, string | null>;
  return { items, equipped };
}

/* ----------------------------------------------------------------------------
   Avatar roster — loaded from `data/cosmeticsData.json`.
   The dataset stores uppercase categories/rarities plus a human-readable
   `unlockRequirement` string; we normalize those into the typed seeds the
   inventory store expects (dynamic unlocks still run off `unlockRequirements`).
--------------------------------------------------------------------------- */
const CATEGORY_FROM_LABEL: Record<string, ItemCategory> = {
  AVATARS: 'avatar', AVATAR: 'avatar',
  AURAS: 'aura', AURA: 'aura',
  ACCESSORIES: 'accessory', ACCESSORY: 'accessory',
};

const AVATAR_COLORS: Record<string, string> = {
  common: '#aeb6c4',
  rare: '#00e5ff',
  epic: '#b967ff',
  legendary: '#ffb800',
};

/** Map a dataset display string like "Level 3 Unlocked" / "2,000 Total Reps" back to structured gates. */
export function parseUnlockRequirement(text: string | undefined): CosmeticUnlockRequirements {
  if (!text) return {};
  const t = text.toLowerCase();
  const level = t.match(/level\s*(\d+)/);
  if (level) return { level: parseInt(level[1], 10) };
  const reps = t.match(/([\d,]+)\s*total\s*reps/);
  if (reps) return { totalReps: parseInt(reps[1].replace(/,/g, ''), 10) };
  const streak = t.match(/(\d+)-day\s*streak/);
  if (streak) return { streakDays: parseInt(streak[1], 10) };
  return {};
}

interface AvatarDataSeed {
  id: string;
  name: string;
  category: string;
  rarity: string;
  description: string;
  imageUrl: string;
  unlocked: boolean;
  unlockRequirement?: string;
}

function buildAvatarSeeds(): RosterSeed[] {
  return (avatarRosterData as AvatarDataSeed[]).map((d) => {
    const rarity = d.rarity.toLowerCase() as RarityTier;
    return {
      id: d.id,
      name: d.name,
      category: CATEGORY_FROM_LABEL[d.category] ?? 'avatar',
      rarity,
      description: d.description,
      imageUrl: d.imageUrl,
      unlockRequirements: parseUnlockRequirement(d.unlockRequirement),
      unlockHint: d.unlockRequirement,
      avatarColor: AVATAR_COLORS[rarity] ?? AVATAR_COLORS.common,
      startUnlocked: d.unlocked,
    };
  });
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