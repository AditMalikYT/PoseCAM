import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LevelUpData } from '../types/progression';
import { IconX, IconSparkle, IconBolt, IconGem, IconShield } from './icons';

/* -------------------------------------------------------------------------- */
/* LevelUpModal - full-screen golden reward sequence.                          */
/*                                                                            */
/* Framer Motion entrance/exit + bouncing level number, rotating god-rays,     */
/* a canvas confetti burst and a golden screen flash. Non-blocking overlay    */
/* over the live AR camera feed (z-index above HUD, dismiss on tap/Continue). */
/* -------------------------------------------------------------------------- */

interface Props {
  data: LevelUpData | null;
  onClose: () => void;
}

export default function LevelUpModal({ data, onClose }: Props) {
  return (
    <AnimatePresence>
      {data && (
        <motion.div
          className="levelup-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Level up! You reached level ${data.newLevel}`}
        >
          {/* Golden screen flash */}
          <motion.div
            className="levelup-flash"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 0.18, 0] }}
            transition={{ duration: 1.1, times: [0, 0.45, 1], ease: 'easeOut' }}
          />
          <ConfettiBurst />

          <motion.div
            className="levelup-panel"
            initial={{ scale: 0.55, y: 60, opacity: 0 }}
            animate={{ scale: [0.55, 1.06, 1], y: 0, opacity: 1 }}
            exit={{ scale: 0.82, y: 24, opacity: 0 }}
            transition={{ duration: 0.55, times: [0, 0.7, 1], ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="levelup-close" onClick={onClose} aria-label="Dismiss level up">
              <IconX width={16} height={16} />
            </button>
            <div className="levelup-rays" />

            {/* Pulsing LEVEL UP badge */}
            <motion.div
              className="levelup-badge"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.25, 1], opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, times: [0, 0.6, 1], ease: 'easeOut' }}
            >
              <IconSparkle width={18} height={18} /> Level Up!
            </motion.div>

            {/* Bouncing level number */}
            <div className="levelup-levels">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`lvl-${data.newLevel}`}
                  className="levelup-level"
                  initial={{ scale: 0.3, filter: 'blur(6px)' }}
                  animate={{ scale: [0.3, 1.3, 1], filter: 'blur(0px)' }}
                  transition={{ delay: 0.45, duration: 0.6, times: [0, 0.6, 1], ease: 'easeOut' }}
                >
                  {data.newLevel}
                </motion.div>
              </AnimatePresence>
              <div className="levelup-prev">
                from level {data.previousLevel}
              </div>
            </div>

            {/* XP + rollover summary */}
            <div className="levelup-xp">
              <span className="levelup-xp-gain">+{data.xpGained} XP</span>
              <span className="levelup-xp-roll">
                · rolls into Lv.{data.newLevel} ({Math.max(0, data.xpAfter - xpFloor(data.newLevel))} XP)
              </span>
            </div>

            {/* Stat increases */}
            <div className="levelup-stats">
              {data.newStatIncreases.strength ? <StatChip icon="strength" label="STR" value={data.newStatIncreases.strength} /> : null}
              {data.newStatIncreases.endurance ? <StatChip icon="endurance" label="END" value={data.newStatIncreases.endurance} /> : null}
              {data.newStatIncreases.flexibility ? <StatChip icon="flex" label="FLEX" value={data.newStatIncreases.flexibility} /> : null}
            </div>

            <motion.button
              className="btn-primary levelup-cta"
              onClick={onClose}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
            >
              Continue
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Rollover helper mirrors store math (total XP already consumed above level). */
function xpFloor(levelOfNew?: number): number {
  if (!levelOfNew || levelOfNew <= 1) return 0;
  let total = 0;
  for (let i = 1; i < levelOfNew; i++) total += Math.round(100 * Math.pow(1.5, i - 1));
  return total;
}

function StatChip({ icon, label, value }: { icon: 'strength' | 'endurance' | 'flex'; label: string; value: number }) {
  return (
    <span className="stat-chip">
      {icon === 'strength' && <IconBolt width={14} height={14} />}
      {icon === 'endurance' && <IconGem width={14} height={14} />}
      {icon === 'flex' && <IconShield width={14} height={14} />}
      <strong>+{value}</strong> {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* ConfettiBurst - lightweight canvas particle shower.                         */
/* One big opening blast + timed follow-up bursts (gold/cyan/emerald),        */
/* gravity + rotation + fade, fully self-cleaning on unmount.                  */
/* -------------------------------------------------------------------------- */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; size: number;
  color: string; life: number; maxLife: number; round: boolean;
}

function ConfettiBurst({
  colors = ['#ffb800', '#ff8800', '#ffe08a', '#ffd166', '#00f0ff', '#00ff85', '#ff2e54'],
}: { colors?: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = 0;
    let height = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let parts: Particle[] = [];
    let raf = 0;
    let prev = performance.now();
    let disposed = false;

    const spawn = (count: number, fromCenter: boolean) => {
      const cx = width / 2;
      const cy = height * 0.36;
      for (let i = 0; i < count; i++) {
        parts.push({
          x: fromCenter
            ? cx + (Math.random() - 0.5) * width * 0.55
            : Math.random() * width,
          y: fromCenter
            ? cy + (Math.random() - 0.5) * height * 0.18
            : -24,
          vx: (Math.random() - 0.5) * 7,
          vy: -6 - Math.random() * 7,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.4,
          size: 5 + Math.random() * 7,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1.7 + Math.random() * 1.3,
          maxLife: 3,
          round: Math.random() < 0.4,
        });
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      ctx.clearRect(0, 0, width, height);
      for (const p of parts) {
        p.vy += 140 * dt;
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(now / 420 + p.rot) * 0.5;
        p.rot += p.vr * dt;
        p.life -= dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.6));
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      parts = parts.filter((p) => p.life > 0 && p.y < height + 50);
      raf = requestAnimationFrame(tick);
    };

    // Opening blast + timed follow-ups
    spawn(130, true);
    const b1 = window.setTimeout(() => spawn(40, true), 520);
    const b2 = window.setTimeout(() => spawn(60, true), 1150);
    const b3 = window.setTimeout(() => spawn(90, true), 2000);
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(b1);
      window.clearTimeout(b2);
      window.clearTimeout(b3);
      window.removeEventListener('resize', resize);
    };
  }, [colors]);

  return <canvas ref={ref} className="levelup-confetti" aria-hidden="true" />;
}