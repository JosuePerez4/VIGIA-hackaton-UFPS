import type { ReactNode } from 'react';
import { LEVEL_META, type Level } from '@/config/thresholds';

export const levelText: Record<Level, string> = {
  0: 'text-lvl0',
  1: 'text-lvl1',
  2: 'text-lvl2',
  3: 'text-lvl3',
};

export const levelBorder: Record<Level, string> = {
  0: 'border-lvl0/40',
  1: 'border-lvl1/40',
  2: 'border-lvl2/40',
  3: 'border-lvl3/40',
};

export const levelBg: Record<Level, string> = {
  0: 'bg-lvl0',
  1: 'bg-lvl1',
  2: 'bg-lvl2',
  3: 'bg-lvl3',
};

/** Estado siempre con texto e icono de forma: el color nunca es el único canal. */
export function LevelPill({ level, compact = false }: { level: Level; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-sm border px-2 py-0.5 font-semibold uppercase tracking-wider ${levelBorder[level]} ${levelText[level]} ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${levelBg[level]}`} />
      {LEVEL_META[level].mineLabel}
    </span>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border border-line bg-panel ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-wide text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  unit,
  tone,
  footnote,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Level;
  footnote?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-line bg-panel p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`font-display text-5xl font-semibold leading-none tabular-nums ${tone !== undefined ? levelText[tone] : 'text-ink'}`}>
        {value}
        {unit ? <span className="ml-1.5 text-lg font-medium text-ink-muted">{unit}</span> : null}
      </p>
      {footnote ? <div className="text-sm text-ink-muted">{footnote}</div> : null}
    </div>
  );
}

export const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40';

export const buttonIdle = `${buttonBase} border-line bg-panel-2 text-ink hover:border-ink-muted`;
export const buttonActive = `${buttonBase} border-ink bg-ink text-canvas`;
