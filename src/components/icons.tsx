import type { SVGProps } from 'react';

/* -------------------------------------------------------------------------- */
/* ArGym premium line-icon set (Lucide-inspired, SVG).                        */
/* All icons inherit currentColor, stroke-based, rounded caps for a sleek     */
/* cyber-luxe look. Add gradient fills via the `gradId` prop or CSS filters.  */
/* -------------------------------------------------------------------------- */

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  className: `icon ${props.className ?? ''}`,
  ...props,
});

export function IconCoins({ gradId, ...p }: IconProps & { gradId?: string }) {
  return (
    <svg {...base(p)}>
      {gradId && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd88a" />
            <stop offset="100%" stopColor="#ff8800" />
          </linearGradient>
        </defs>
      )}
      <circle cx="9" cy="9" r="6" stroke={gradId ? `url(#${gradId})` : 'currentColor'} />
      <path d="M14.5 5.7a6 6 0 0 1 0 6.6" />
      <path d="M17.6 8a6 6 0 0 1 0 6" />
      <path d="M20.4 10.6a6 6 0 0 1 0 4.9" />
    </svg>
  );
}

export function IconBolt(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
    </svg>
  );
}

export function IconGem(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 3h10l4 5-9 13L3 8l4-5Z" />
      <path d="M3 8h18" />
      <path d="M12 21 9 8l1.5-5M12 21l3-13L13.5 3" />
    </svg>
  );
}

export function IconFire(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 22c4.4 0 7-2.8 7-6.5 0-3.2-2.2-5.3-4.1-7C13.5 6.9 12 5 12 2c0 0-3.6 3.2-4.6 5.2C6.5 8.8 5 10.6 5 13.6 5 18.4 7.6 22 12 22Z" />
      <path d="M12 22c-2 0-3.4-1.5-3.4-3.4 0-1.6 1.2-2.7 2.6-3.9C12.6 13.5 13.8 12 14.9 11c-.5 2-1.2 3.3-2.3 4-1.2.8-1.8 1.6-1.8 2.5 0 1.4 1 2.5 2.2 2.5" />
    </svg>
  );
}

export function IconCamera(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 8h1.8L8 5h8l2.2 3H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13.5" r="3.5" />
      <path d="M14 6h-4" />
      <path d="M18.5 10.5v.01M5.5 10.5v.01" />
    </svg>
  );
}

export function IconTarget(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
    </svg>
  );
}

export function IconBug(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="8" y="6" width="8" height="12" rx="4" />
      <path d="M9 6a3 3 0 0 1 6 0" />
      <path d="M12 10v.01M12 14v.01" />
      <path d="M4 10h4M4 15h4M16 10h4M16 15h4M8 9H5M8 14H5M16 9h3M16 14h3" />
    </svg>
  );
}

export function IconBookOpen(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 6.5C10.4 5 8 4.5 3.5 4.5A1.5 1.5 0 0 0 2 6v11.5a1.5 1.5 0 0 0 1.5 1.5C8 19 10.4 19.5 12 21c1.6-1.5 4-2 8.5-2a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5C16 4.5 13.6 5 12 6.5Z" />
      <path d="M12 6.5v14" />
    </svg>
  );
}

export function IconSword(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 20 20 4" />
      <path d="M20 4h-5M20 4v5" />
      <path d="m14 10 3 3" />
    </svg>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 4.5v15L19 12 7 4.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4.5 12.5 10 18 19.5 6.5" />
    </svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function IconShield(d: IconProps) {
  return (
    <svg {...base(d)}>
      <path d="M12 2 4 5v6c0 5.5 3.4 9.5 8 11 4.6-1.5 8-5.5 8-11V5l-8-3Z" />
      <path d="m8.5 12 2.3 2.3L15.5 9.8" />
    </svg>
  );
}

export function IconDumbbell(d: IconProps) {
  return (
    <svg {...base(d)}>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6" />
      <path d="M6.5 9a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3V9Z" />
    </svg>
  );
}

export function IconSparkle(d: IconProps) {
  return (
    <svg {...base(d)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.3 6.3 2 2M15.7 15.7l2 2M17.7 6.3l-2 2M8.3 15.7l-2 2" />
    </svg>
  );
}

export function IconAlertTriangle(d: IconProps) {
  return (
    <svg {...base(d)}>
      <path d="M10.3 4.2 2.6 17.1A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.8-2.9L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconActivity(d: IconProps) {
  return (
    <svg {...base(d)}>
      <path d="M3 12h4l2.5-7 4.5 14 2.5-7H21" />
    </svg>
  );
}

export function IconBag(d: IconProps) {
  return (
    <svg {...base(d)}>
      <path d="M4.5 8.5h15l-1 11a2 2 0 0 1-2 1.9H7.5a2 2 0 0 1-2-1.9l-1-11Z" />
      <path d="M8.5 9V6.2a3.5 3.5 0 0 1 7 0V9" />
      <path d="M9 13.5h.01M15 13.5h.01" />
    </svg>
  );
}

export function IconLock(d: IconProps) {
  return (
    <svg {...base(d)}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2.5" />
    </svg>
  );
}

export function IconShirt(d: IconProps) {
  return (
    <svg {...base(d)}>
      <path d="M5 5h4l3 3 3-3h4l2.4 4.4L17 12.5V19H7v-6.5L2.6 9.4 5 5Z" />
      <path d="M12 8v11" />
    </svg>
  );
}