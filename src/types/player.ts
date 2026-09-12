// Player/Avatar state

export interface PlayerStats {
  strength: number;      // 1-100 scale
  endurance: number;     // 1-100 scale
  flexibility: number;   // 1-100 scale
  totalReps: number;     // Cumulative reps across all exercises
  totalWorkouts: number; // Total workout sessions completed
}

// Character level configuration
export interface LevelConfig {
  level: number;
  xpRequired: number;
  statIncreases: {
    strength?: number;
    endurance?: number;
    flexibility?: number;
  };
}

// Player progression data
export interface PlayerProgression {
  currentLevel: number;
  currentXp: number;
  totalXpEarned: number;
  xpToNextLevel: number;
  stats: PlayerStats;
  levelHistory: LevelConfig[];
  createdDate: string;
  lastWorkoutDate: string | null;
}

// Streak tracking
export interface StreakData {
  currentStreak: number;        // Consecutive days worked out
  longestStreak: number;        // Best streak achieved
  lastWorkoutDate: string;      // ISO date string
  streakStartDate: string;      // When current streak started
}

// Unlockable cosmetic items
export interface CosmeticItem {
  id: string;
  name: string;
  type: 'costume' | 'weapon' | 'accessory' | 'pet' | 'aura';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  unlockRequirements: {
    level?: number;
    totalReps?: number;
    achievements?: string[];
  };
  modelPath?: string;          // Path to 3D model file
  texturePath?: string;        // Path to texture file
  unlocked: boolean;
  equipped: boolean;
}

// Achievement definitions
export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconPath?: string;
  requirements: {
    type: 'reps' | 'workouts' | 'streak' | 'level' | 'custom';
    target: number;
    exerciseType?: 'pushups' | 'pullups' | 'squats' | 'plank';
  };
  rewardItems?: string[];      // Cosmetic item IDs to unlock
  unlocked: boolean;
  unlockedDate?: string;
  progress: number;
}

// Boss configuration
export interface BossConfig {
  id: string;
  name: string;
  title: string;
  level: number;
  health: number;
  attackPattern?: string;      // Visual/audio attack effect
  rewards: {
    xp: number;
    statIncrease: {
      strength?: number;
      endurance?: number;
    };
    items?: string[];          // Cosmetic item IDs
  };
  defeatVoiceLine?: string;    // Celebration message
}

// Full player state
export interface PlayerState {
  player: PlayerProgression;
  streak: StreakData;
  cosmetics: CosmeticItem[];
  achievements: Achievement[];
  unlockedBosses: string[];    // Boss IDs defeated
  currentActiveCosmetics: {
    costume?: string;
    weapon?: string;
    accessory?: string;
    aura?: string;
  };
}

// Exercise session data
export interface ExerciseSession {
  id: string;
  exerciseType: 'pushups' | 'pullups' | 'squats' | 'plank' | 'custom';
  startTime: string;
  endTime?: string;
  duration: number;            // Seconds
  repsCompleted: number;
  totalXp: number;
  avgFormScore: number;        // 0-100
  perfectReps: number;         // Reps with 95%+ form
  goodReps: number;            // Reps with 80-94% form
  fairReps: number;            // Reps with 60-79% form
  poorReps: number;            // Reps with <60% form
  wasCompleted: boolean;       // Did they finish the session?
}

// Workout session summary
export interface WorkoutSummary {
  sessionId: string;
  date: string;
  exerciseType: string;
  duration: number;
  reps: number;
  xpEarned: number;
  levelUp: boolean;
  newItemsUnlocked: string[];
  notes?: string;
}

// Save data structure for persistence
export interface SaveData {
  version: number;
  lastUpdated: string;
  player: PlayerProgression;
  streak: StreakData;
  cosmetics: CosmeticItem[];
  achievements: Achievement[];
  unlockedBosses: string[];
  workoutHistory: WorkoutSummary[];
  settings: UserSettings;
}

// User settings
export interface UserSettings {
  poseModelComplexity: 1 | 2 | 3;
  autoStartCamera: boolean;
  soundEnabled: boolean;
  hapticFeedback: boolean;
  videoMirrored: boolean;
  arIntensity: 'low' | 'medium' | 'high';
  language: string;
  showFormFeedback: boolean;
}
