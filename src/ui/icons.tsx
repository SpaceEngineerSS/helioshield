/**
 * Single-stroke icons drawn for HelioShield on a 24-unit grid. They share the
 * hairline weight of the panel rules, so they read as part of the instrument.
 */

import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  viewBox: '0 0 24 24',
  className: `icon ${props.className ?? ''}`,
  'aria-hidden': true as const,
  ...props,
});

export const Play = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 5.5v13l11-6.5z" />
  </svg>
);

export const Pause = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 5v14M16 5v14" />
  </svg>
);

/** Arc with an arrowhead, drawn like a dial being turned. */
export const Refresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12a7 7 0 1 1-2.05-4.95" />
    <path d="M19 4.5V8h-3.5" />
  </svg>
);

/** A control knob with index tick, not a gear. */
export const Dial = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="6.5" />
    <path d="M12 12l3.2-3.2M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" />
  </svg>
);

export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** Survey crosshair. */
export const Locate = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="5" />
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </svg>
);

/** Tape-reel rewind for replay. */
export const Reel = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="12" r="4" />
    <circle cx="16" cy="12" r="4" />
    <path d="M8 16h8" />
  </svg>
);

export const External = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 6H6v12h12v-4M13 5h6v6M19 5l-8 8" />
  </svg>
);

export const Chevron = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** A bell drawn as a signal lamp with rays. */
export const Signal = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 16V11a4 4 0 0 1 8 0v5M6.5 16h11M10.5 19h3" />
    <path d="M12 3.5v1.5M4.8 6.3l1.1 1.1M19.2 6.3l-1.1 1.1" />
  </svg>
);

export const Step = (p: P & { dir?: 'back' | 'fwd' }) => {
  const { dir = 'fwd', ...rest } = p;
  return (
    <svg {...base(rest)} style={{ transform: dir === 'back' ? 'scaleX(-1)' : undefined }}>
      <path d="M6 6.5v11l8-5.5zM18 6v12" />
    </svg>
  );
};

export const Live = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
  </svg>
);
