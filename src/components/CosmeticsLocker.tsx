import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../state/playerStore';
import { RARITY_TIERS, CATEGORY_LABELS, CATEGORY_ORDER, unlockRequirementText, cosmeticImageUrl } from '../types/cosmetics';
import type { CosmeticItem, ItemCategory, RarityTier } from '../types/cosmetics';
import { playCoachSound } from '../utils/audioCoach';
import { IconX, IconShirt, IconSparkle, IconBag, IconLock, IconCheck } from './icons';

/* ============================================================================
   CosmeticsLocker — glassmorphic inventory modal.
   Category tabs (Avatars / Auras / Accessories), rarity border glows,
   lock/unlock status, EQUIP actions and an animated preview. Avatar and
   accessory items render lightweight 2D PNG sprites (see data/cosmeticsData.json
   + data/accessoriesData.json); auras keep the glowing particle-field canvas.
============================================================================ */

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CosmeticsLocker({ open, onClose }: Props) {
  const cosmetics = usePlayerStore((s) => s.cosmetics);
  const equipped = usePlayerStore((s) => s.equipped);
  const equipCosmetic = usePlayerStore((s) => s.equipCosmetic);

  const [tab, setTab] = useState<ItemCategory>('avatar');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showLocked, setShowLocked] = useState(true);

  useEffect(() => {
    if (open) setPreviewId(null);
  }, [open]);

  const activeItems = cosmetics
    .filter((c) => c.category === tab)
    .sort((a, b) => RARITY_TIERS[a.rarity].rank - RARITY_TIERS[b.rarity].rank);

  const previewItem =
    activeItems.find((c) => c.id === previewId) ??
    activeItems.find((c) => c.equipped) ??
    activeItems[0];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="locker-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="locker-panel"
            initial={{ scale: 0.9, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="locker-header">
              <div className="locker-title">
                <IconBag width={18} height={18} />
                Cosmetic Locker
              </div>
              <button className="locker-close" onClick={onClose} aria-label="Close locker">
                <IconX width={16} height={16} />
              </button>
            </header>

            {/* Category tabs (44px min touch targets, sticky under only-scrolling grid) */}
            <div className="locker-tabs" role="tablist" aria-label="Cosmetic categories">
              {CATEGORY_ORDER.map((cat) => {
                const count = cosmetics.filter((c) => c.category === cat && c.unlocked).length;
                const Icon = cat === 'avatar' ? IconShirt : cat === 'aura' ? IconSparkle : IconBag;
                const isActive = tab === cat;
                return (
                  <button
                    key={cat}
                    role="tab"
                    aria-selected={isActive}
                    className={`locker-tab ${isActive ? 'active' : ''}`}
                    onClick={() => setTab(cat)}
                  >
                    <Icon width={15} height={15} />
                    {CATEGORY_LABELS[cat]}
                    <span className="locker-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Animated item preview */}
            <CosmeticPreview item={previewItem} />

            {/* Item grid wrapper — flex-1 min-h-0 scroll region; the ONLY
                scrolling area. The inner list holds the responsive grid.
                key={tab} resets scroll position on category switch. */}
            <div className="locker-grid custom-scrollbar pr-1" key={tab}>
              <div className="locker-grid-list">
                {activeItems.map((item) => (
                  <CosmeticCard
                    key={item.id}
                    item={item}
                    isEquipped={equipped[item.category] === item.id}
                    showLocked={showLocked}
                    onHover={() => setPreviewId(item.id)}
                    onEquip={() => {
                      playCoachSound('cosmeticEquip');
                      equipCosmetic(item.id);
                      setPreviewId(item.id);
                    }}
                  />
                ))}
              </div>
            </div>

            <footer className="locker-footer">
              <label className="locker-locked-toggle">
                <input
                  type="checkbox"
                  checked={showLocked}
                  onChange={(e) => setShowLocked(e.target.checked)}
                />
                Show locked items
              </label>
              <span className="locker-hint">Equipped cosmetics glow in the AR arena</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* Single item card                                                           */
/* -------------------------------------------------------------------------- */
function CosmeticCard({
  item,
  isEquipped,
  showLocked,
  onHover,
  onEquip,
}: {
  item: CosmeticItem;
  isEquipped: boolean;
  showLocked: boolean;
  onHover: () => void;
  onEquip: () => void;
}) {
  const rarity = RARITY_TIERS[item.rarity];
  if (!item.unlocked && !showLocked) return null;

  return (
    <motion.div
      className={`cosmetic-card rarity-${item.rarity} ${isEquipped ? 'equipped' : ''} ${item.unlocked ? '' : 'locked'}`}
      style={{ '--rarity-color': rarity.color, '--rarity-glow': rarity.glow } as React.CSSProperties}
      onMouseEnter={onHover}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      <div className="cosmetic-card-orb-ring">
        <CardArt item={item} />
        {item.rarity === 'legendary' && <div className="cosmetic-orb-sheen" />}
      </div>

      <div className="cosmetic-card-info">
        <div className="cosmetic-name">{item.name}</div>
        <div className="cosmetic-rarity">{rarity.label} · {rarity.grade}</div>
        <div className="cosmetic-desc">{item.description}</div>
      </div>

      <div className="cosmetic-card-foot">
        {item.unlocked ? (
          isEquipped ? (
            <span className="equipped-tag">
              <IconCheck width={13} height={13} /> EQUIPPED
            </span>
          ) : (
            <button className="btn-equip" onClick={onEquip}>EQUIP</button>
          )
        ) : (
          <span className="unlock-req" title={unlockRequirementText(item.unlockRequirements)}>
            <IconLock width={12} height={12} />
            {item.unlockHint ?? unlockRequirementText(item.unlockRequirements)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Preview — 2D sprite for avatars / accessories, particle field for auras     */
/* -------------------------------------------------------------------------- */
function CosmeticPreview({ item }: { item: CosmeticItem | undefined }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => setImgFailed(false), [item?.id]);

  const spriteUrl = cosmeticImageUrl(item);

  if (spriteUrl && !imgFailed) {
    const rarity = RARITY_TIERS[item!.rarity];
    return (
      <div className="avatar-preview" key={item!.id}>
        <img
          className="avatar-preview-img"
          src={spriteUrl}
          alt={item!.name}
          loading="lazy"
          style={{ '--rarity-glow': rarity.glow } as React.CSSProperties}
          onError={() => setImgFailed(true)}
        />
        <span className="avatar-preview-chip">{item!.name} · {rarity.label}</span>
      </div>
    );
  }

  return <ParticlePreview item={item} />;
}

/* -------------------------------------------------------------------------- */
/* Canvas preview — glowing particle field keyed to the hovered/equipped item  */
/* -------------------------------------------------------------------------- */
function ParticlePreview({ item }: { item: CosmeticItem | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const color = item
    ? (item.aura?.color ?? item.accessory?.color ?? item.avatarColor ?? RARITY_TIERS[item.rarity].color)
    : '#334155';
  const legendary = !!item && item.rarity === 'legendary';

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 240;
    const H = 240;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const N = legendary ? 110 : 70;
    const particles = Array.from({ length: N }, (_, i) => ({
      t: Math.random() * Math.PI * 2,
      r: 30 + Math.random() * 55,
      rv: (0.4 + Math.random() * 0.9) * (i % 2 ? 1 : -1),
      z: 0.4 + Math.random() * 0.6,
      size: 1 + Math.random() * 2.4,
      tw: Math.random() * 5,
    }));

    const [r, g, b] = hexToRgb(color);
    const beams = 6;
    let raf = 0;
    let t = 0;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      // Rotating radial beams for legendaries
      if (legendary) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        for (let i = 0; i < beams; i++) {
          const ang = (i / beams) * Math.PI * 2 + t * 0.35;
          const grad = ctx.createLinearGradient(0, 0, Math.cos(ang) * 88, Math.sin(ang) * 88);
          grad.addColorStop(0, `rgba(${r},${g},${b},0.20)`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang - 0.4) * 88, Math.sin(ang - 0.4) * 88);
          ctx.lineTo(Math.cos(ang + 0.4) * 88, Math.sin(ang + 0.4) * 88);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Core glow orb
      const halo = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, 42);
      halo.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 42, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting particle cloud
      for (const p of particles) {
        p.t += p.rv * 0.016;
        const depth = Math.sin(p.t * 2 + p.tw) * 0.5 + 0.5;
        const rad = p.r * (0.85 + 0.15 * Math.sin(t * 1.1 + p.t));
        const x = W / 2 + Math.cos(p.t) * rad;
        const y = H / 2 + Math.sin(p.t * 0.8) * rad * 0.55;
        const alpha = 0.25 + 0.75 * depth;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * depth, 0, Math.PI * 2);
        ctx.fill();
      }

      // Full-brightness ring orbit for legendaries
      if (legendary) {
        ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(W / 2, H / 2, 74, 24, t * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [color, legendary]);

  return <canvas ref={ref} className="cosmetic-preview-canvas" aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Card artwork — real 2D sprite when available, rarity orb otherwise          */
/* -------------------------------------------------------------------------- */
function CardArt({ item }: { item: CosmeticItem }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [item.id]);

  const spriteUrl = cosmeticImageUrl(item);

  if (spriteUrl && !failed) {
    return (
      <img
        className="cosmetic-thumb-img"
        src={spriteUrl}
        alt={item.name}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }

  const accent = item.aura?.color ?? item.accessory?.color ?? item.avatarColor ?? RARITY_TIERS[item.rarity].color;
  return (
    <div
      className="cosmetic-orb"
      style={{
        background: `radial-gradient(circle at 32% 28%, #ffffff55, ${accent})`,
        boxShadow: `0 0 22px ${RARITY_TIERS[item.rarity].glow}`,
      }}
      title={item.name}
    />
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}