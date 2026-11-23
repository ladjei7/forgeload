// Shared look for every screen. One place for cards, buttons, fields and icons, so spacing and
// sizes stay the same everywhere. Rule from the design system: orange (primary) marks the one
// next action on a screen; everything else is secondary or a text button.

export const ui = {
  main: 'mx-auto max-w-xl px-4 pb-32 pt-6 text-fl-tx',
  h1: 'text-3xl font-bold leading-tight',
  h2: 'text-lg font-bold',
  card: 'rounded-2xl border border-fl-line bg-fl-s1 p-5',
  sub: 'text-sm leading-relaxed text-fl-tx2',
  label: 'mb-1 block text-xs font-medium text-fl-tx2',
  input: 'h-12 w-full min-w-0 rounded-xl border border-fl-field bg-fl-s2 px-3 text-base text-fl-tx',
  primary: 'flex h-12 w-full items-center justify-center rounded-xl bg-fl-acc px-4 font-bold text-fl-on-acc disabled:opacity-60',
  secondary: 'flex h-12 w-full items-center justify-center rounded-xl bg-fl-s2 px-4 font-semibold text-fl-tx disabled:opacity-60',
  // Same as secondary, sized to its label: for a button beside an input.
  secondaryInline: 'flex h-12 shrink-0 items-center justify-center rounded-xl bg-fl-s2 px-5 font-semibold text-fl-tx disabled:opacity-60',
  chip: 'flex h-10 items-center justify-center gap-1 rounded-lg bg-fl-s2 px-3 text-sm font-semibold text-fl-tx disabled:opacity-40',
  textBtn: 'inline-flex h-10 items-center rounded-lg px-2 text-sm font-semibold text-fl-tx2 hover:text-fl-tx',
  dangerText: 'inline-flex h-10 items-center rounded-lg px-2 text-sm font-semibold text-fl-bad',
  iconBtn: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fl-tx2 hover:bg-fl-s2 disabled:opacity-30',
  pill: 'h-10 rounded-full border px-4 text-sm font-semibold',
  pillOn: 'border-fl-acc bg-fl-tint text-fl-tx',
  pillOff: 'border-fl-line bg-fl-s2 text-fl-tx2',
} as const;

// Simple 24px line icons (same stroke style as the bottom bar).
const PATHS = {
  up: 'M6 15l6-6 6 6',
  grip: 'M5 8h14M5 12h14M5 16h14',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  // onboarding icons
  grow: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 12h6M12 9v6',
  flame: 'M12 2.5c.8 3.5 6 6 6 11.5a6 6 0 01-12 0c0-3 1.6-5 3-6.2.2 2.4 1.3 3.7 2.6 3.7C11 8.5 10.4 5.5 12 2.5z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  barbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  dumbbell: 'M7 8v8M17 8v8M4.5 10v4M19.5 10v4M7 12h10',
  machine: 'M5 3v18M19 3v18M5 5h14M12 5v6M9 11h6v5H9z',
  help: 'M9.2 9a3 3 0 015.6 1.2c0 1.8-2.8 2.4-2.8 4M12 17.5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.9L12 3.5z',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, filled = false, className = '' }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Experience level as 1 to 4 rising bars (filled up to the level). */
export function LevelBars({ level }: { level: 1 | 2 | 3 | 4 }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={3 + i * 5} y={17 - i * 4} width="3.5" height={4 + i * 4} rx="1"
          fill={i < level ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" opacity={i < level ? 1 : 0.45} />
      ))}
    </svg>
  );
}

/** Status line after an action: teal for done, red for a problem. Announced to screen readers. */
export function Notice({ msg }: { msg: { kind: 'ok' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return msg.kind === 'error'
    ? <p role="alert" className="rounded-xl bg-fl-s2 p-3 text-sm text-fl-bad">⚠ {msg.text}</p>
    : <p role="status" className="rounded-xl bg-fl-s2 p-3 text-sm text-fl-ok">{msg.text}</p>;
}
