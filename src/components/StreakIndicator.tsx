import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconFire, IconChevronRight } from './icons';
import { STREAK_TIERS } from '../types/progression';
import type { StreakMultiplier } from '../types/progression';

/* -------------------------------------------------------------------------- */
/* StreakIndicator - glowing weekly-streak XP multiplier HUD pill.             */
/* Flaming day counter + active multiplier badge, fire-embers while the       */
/* multiplier is live, an explosion pulse whenever bonus XP is awarded, and   */
/* an expanding tier-ladder tooltip with next-milestone progress.             */
/* -------------------------------------------------------------------------- */

interface Props {
  streak: StreakMultiplier;
  /** Bump this counter to fire the bonus-award pulse (from useProgression). */
  pulseToken?: number;
}

const fmtMult = (mult: number) => mult.toFixed(2).replace(/\.?0+$/, '');

export default function StreakIndicator({ streak, pulseToken = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const prevToken = useRef(pulseToken);

  const active = streak.multiplier > 1;
  const { tier, nextTier, daysToNextTier } = streak;
  const nextPct = nextTier
    ? Math.min(100, Math.round(((streak.days - (tier.minDays - 1)) / (nextTier.minDays - (tier.minDays - 1))) * 100))
    : 100;

  useEffect(() => {
    if (pulseToken > prevToken.current) {
      setPulsing(true);
      const t = window.setTimeout(() => setPulsing(false), 950);
      prevToken.current = pulseToken;
      return () => window.clearTimeout(t);
    }
    prevToken.current = pulseToken;
  }, [pulseToken]);

  const tierStyle = { '--tier-color': tier.color } as React.CSSProperties;

  return (
    <div
      className={`streak-indicator ${active ? 'active' : ''} ${pulsing ? 'pulse' : ''}`}
      onClick={() => setOpen((o) => !o)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      role="button"
      aria-expanded={open}
      aria-label={`${streak.days} day streak, ${tier.label}, ${fmtMult(tier.multiplier)}x XP`}
    >
      <div className="streak-pill" style={tierStyle}>
        <span className="streak-flame">
          <IconFire width={19} height={19} />
          {active && (
            <>
              <span className="ember e1" />
              <span className="ember e2" />
              <span className="ember e3" />
            </>
          )}
        </span>
        <span className="streak-days">{streak.days}<em>d</em></span>
        {active && (
          <motion.span
            className="streak-mult"
            key={`${tier.minDays}-${streak.days}`}
            initial={{ scale: 0.5 }}
            animate={{ scale: [0.5, 1.25, 1] }}
            transition={{ duration: 0.4, times: [0, 0.6, 1] }}
          >
            ×{fmtMult(tier.multiplier)}
          </motion.span>
        )}
        <span className="streak-tier-label">{tier.label}</span>
        <IconChevronRight className={`streak-chev ${open ? 'flip' : ''}`} width={13} height={13} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="streak-tooltip"
            initial={{ opacity: 0, y: -8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="streak-tooltip-head">
              <span className="streak-tooltip-tier" style={{ color: tier.color }}>
                {tier.label}
              </span>
              <span className="streak-tooltip-mult">×{fmtMult(tier.multiplier)} XP</span>
            </div>
            <p className="streak-tooltip-desc">{tier.description}</p>

            {nextTier && (
              <div className="streak-next">
                <span className="streak-next-label">
                  {daysToNextTier} day{daysToNextTier === 1 ? '' : 's'} to {nextTier.label}
                </span>
                <div className="streak-next-track">
                  <div className="streak-next-fill" style={{ width: `${nextPct}%`, background: nextTier.color }} />
                </div>
              </div>
            )}

            <div className="streak-ladder">
              {STREAK_TIERS.map((t) => {
                const reached = streak.days >= t.minDays;
                const isCurrent = t.minDays === tier.minDays;
                return (
                  <div
                    key={t.minDays}
                    className={`streak-ladder-row ${isCurrent ? 'current' : ''} ${reached ? '' : 'locked'}`}
                    style={{ '--tier-color': t.color } as React.CSSProperties}
                  >
                    <span className="streak-ladder-dot" />
                    <span className="streak-ladder-label">{t.label}</span>
                    <span className="streak-ladder-days">{t.minDays}D</span>
                    <span className="streak-ladder-mult">×{fmtMult(t.multiplier)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}