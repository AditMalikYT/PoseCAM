/**
 * EventBus - Simple event system for decoupled communication
 * between components (pose detection, rep detection, UI, AR scene)
 */

type EventCallback = (...args: any[]) => void;

interface EventBus {
  // Subscribe to an event
  on: (event: string, callback: EventCallback) => () => void;
  
  // Emit an event to all subscribers
  emit: (event: string, ...args: unknown[]) => void;
  
  // Subscribe once and auto-unsubscribe
  once: (event: string, callback: EventCallback) => void;
  
  // Unsubscribe from an event
  off: (event: string, callback: EventCallback) => void;
  
  // Get number of listeners for an event
  listenerCount: (event: string) => number;
}

// Event names for the application
export const Events = {
  // Pose detection events
  POSE_DETECTED: 'pose_detected',
  POSE_LOST: 'pose_lost',
  POSE_CONFIDENCE_CHANGE: 'pose_confidence_change',
  
  // Rep detection events
  REP_STARTED: 'rep_started',
  REP_COMPLETED: 'rep_completed',
  REP_FAILED: 'rep_failed',
  FORM_ISSUE_DETECTED: 'form_issue_detected',
  
  // Session events
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session ended',
  EXERCISE_CHANGED: 'exercise_changed',
  
  // Boss battle events
  BOSS_BATTLE_STARTED: 'boss_battle_started',
  BOSS_DAMAGE_TAKEN: 'boss_damage_taken',
  BOSS_DEFEATED: 'boss_defeated',
  BOSS_ATTACK: 'boss_attack',
  
  // Progression events
  XP_GAINED: 'xp_gained',
  LEVEL_UP: 'level_up',
  STREAK_BONUS_AWARDED: 'streak_bonus_awarded',
  COSMETIC_UNLOCKED: 'cosmetic_unlocked',
  COSMETIC_EQUIPPED: 'cosmetic_equipped',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  
  // UI events
  HUD_UPDATE: 'hud_update',
  FEEDBACK_SHOW: 'feedback_show',
  FLOATING_TEXT: 'floating_text',
  
  // AR events
  AR_SESSION_STARTED: 'ar_session_started',
  AR_SESSION_ENDED: 'ar_session_ended',
  AR_CAMERA_MOVE: 'ar_camera_move',
  
  // Camera events
  CAMERA_SWITCHED: 'camera_switched',
  CAMERA_RECALIBRATED: 'camera_recalibrated',

  // Audio events
  PLAY_SOUND: 'play_sound',
  PLAY_BOSS_SOUND: 'play_boss_sound',
} as const;

type EventName = typeof Events[keyof typeof Events];

class SimpleEventBus implements EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  emit(event: string, ...args: unknown[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      // Create array to avoid mutation during iteration
      const callbacks = Array.from(listeners);
      for (const callback of callbacks) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`EventBus error for event "${event}":`, error);
        }
      }
    }
  }

  once(event: string, callback: EventCallback): void {
    const unsubscribe = this.on(event, (...args) => {
      callback(...args);
      unsubscribe();
    });
  }

  off(event: string, callback: EventCallback): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  // Clear all listeners (for cleanup)
  clear(): void {
    this.listeners.clear();
  }

  // Remove all listeners for an event
  clearEvent(event: string): void {
    this.listeners.delete(event);
  }
}

// Singleton instance
export const eventBus: EventBus = new SimpleEventBus();

// Helper functions for common event patterns

/**
 * Subscribe to pose detection updates
 */
export function onPoseDetected(callback: (landmarks: unknown) => void): () => void {
  return eventBus.on(Events.POSE_DETECTED, callback);
}

/**
 * Subscribe to rep completion
 */
export function onRepCompleted(
  callback: (repData: { repNumber: number; formScore: number; xpEarned: number }) => void
): () => void {
  return eventBus.on(Events.REP_COMPLETED, callback);
}

/**
 * Subscribe to boss damage
 */
export function onBossDamage(callback: (damage: number, formScore: number) => void): () => void {
  return eventBus.on(Events.BOSS_DAMAGE_TAKEN, callback);
}

/**
 * Subscribe to level up
 */
export function onLevelUp(callback: (newLevel: number, stats: unknown) => void): () => void {
  return eventBus.on(Events.LEVEL_UP, callback);
}

/**
 * Show floating feedback text
 */
export function showFloatingText(text: string, color: number = 0x00ff88, position: unknown = { x: 0, y: 1.5, z: 0 }): void {
  eventBus.emit(Events.FLOATING_TEXT, { text, color, position });
}

/**
 * Show feedback message
 */
export function showFeedback(message: string, type: 'success' | 'warning' | 'error' = 'success'): void {
  eventBus.emit(Events.FEEDBACK_SHOW, { message, type });
}

/**
 * Play sound effect
 */
export function playSound(soundName: string, volume: number = 1.0): void {
  eventBus.emit(Events.PLAY_SOUND, { soundName, volume });
}
