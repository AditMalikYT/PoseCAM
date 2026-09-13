import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../state/playerStore';
import { RARITY_TIERS, CATEGORY_LABELS } from '../types/cosmetics';
import type { CosmeticItem } from '../types/cosmetics';
import { playCoachSound } from '../utils/audioCoach';
import { IconLock, IconSparkle } from './icons';

/* ============================================================================
   UnlockCelebrationModal — animated rarity-coded popup for newly acquired
   items. Rarity-coloured light beams, a golden screen flash on reveal and
   rank-scaled entrance animations (legendaries detonate bigger). Multiple
   unlocks queue up and are celebrated one at a time.
============================================================================ */

export default function UnlockCelebrationModal() {
  const pending = usePlayerStore((s) => s.pendingUnlocks);
  const dismiss = usePlayerStore((s) => s.dismissPendingUnlock);

  const item = pending[0];

  // Play the unlock chime once per new item
  useEffect(() => {
    if (item) playCoachSound('cosmeticUnlock', true);
  }, [item?.id, item]);

  return (
    <AnimatePresence>
      {item && <Celebration key={item.id} item={item} remaining={pending.length - 1} onClaim={() => dismiss(item.id)} />}
    </AnimatePresence>
  );
}

function Celebration({
  item,
  remaining,
  onClaim,
}: {
  item: CosmeticItem;
  remaining: number;
  onClaim: () => void;
}) {
  const rarity = RARITY_TIERS[item.rarity];
  const accent = item.aura?.color ?? item.accessory?.color ?? item.avatarColor ?? rarity.color;
  const isLegendary = item.rarity === 'legendary';

  return (
    <motion.div
      className="unlock-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Rarity light beams */}
      <div
        className="unlock-beams"
        style={{ background: `repeating-conic-gradient(from 0deg, ${rarity.glow} 0deg 6deg, transparent 6deg 18deg)` }}
      />

      {/* Screen flash on reveal */}
      <motion.div
        className="unlock-flash"
        style={{ background: `radial-gradient(circle, ${rarity.glow}, transparent 65%)` }}
        initial={{ opacity: 0.9 }}
        animate={{ opacity: [0.9, 0.25, 0] }}
        transition={{ duration: 1, times: [0, 0.5, 1] }}
      />

      <motion.div
        className={`unlock-card rarity-${item.rarity}`}
        style={{ '--rarity-color': rarity.color, '--rarity-glow': rarity.glow } as React.CSSProperties}
        initial={{ scale: isLegendary ? 0.3 : 0.55, y: 60, opacity: 0, rotateX: 24 }}
        animate={{ scale: [isLegendary ? 0.3 : 0.55, 1.08, 1], y: 0, opacity: 1, rotateX: 0 }}
        exit={{ scale: 0.85, y: -30, opacity: 0 }}
        transition={{ duration: 0.6, times: [0, 0.72, 1], ease: 'easeOut' }}
      >
        <div className="unlock-rarity-badge">
          <IconSparkle width={15} height={15} />
          {rarity.label} item unlocked
        </div>

        <div
          className={`unlock-orb ${isLegendary ? 'legendary' : ''}`}
          style={{ background: `radial-gradient(circle at 34% 30%, #ffffff66, ${accent})`, boxShadow: `0 0 46px ${rarity.glow}, 0 0 120px ${rarity.glow}` }}
        >
          {isLegendary && <div className="unlock-orb-rings" />}
        </div>

        <div className="unlock-category">{CATEGORY_LABELS[item.category]}</div>
        <motion.h2
          className="unlock-name"
          initial={{ opacity: 0, y: 14, letterSpacing: '6px' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '2px' }}
          transition={{ delay: 0.28, duration: 0.45 }}
        >
          {item.name}
        </motion.h2>
        <p className="unlock-desc">{item.description}</p>

        <button className="unlock-claim" onClick={onClaim}>
          Claim item{remaining > 1 ? 's' : ''}
          {remaining > 0 && <span className="unlock-remaining">+{remaining} more</span>}
        </button>
      </motion.div>

      {/* Lock icon watermark for flavor */}
      <IconLock className="unlock-lock-watermark" width={220} height={220} />
    </motion.div>
  );
}