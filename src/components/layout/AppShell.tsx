'use client';

import {
  Activity,
  Bell,
  History,
  LayoutDashboard,
  Map as MapIcon,
  Play,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { SCENARIO_BY_ID } from '@/sim/scenarios';
import { useVigia } from '@/store/vigia-store';
import { LevelPill } from '@/components/ui/primitives';
import { AlertNotifier } from '@/components/alerts/AlertNotifier';
import { EmergencyBanner } from '@/components/alerts/EmergencyBanner';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/panel', label: 'Panel en tiempo real', icon: LayoutDashboard },
  { href: '/mapa', label: 'Mapa 3D', icon: MapIcon },
  { href: '/alertas', label: 'Centro de alertas', icon: Bell },
  { href: '/simulaciones', label: 'Simulaciones', icon: Play },
  { href: '/personal', label: 'Personal', icon: Users },
  { href: '/historial', label: 'Historial y reportes', icon: History },
  { href: '/sistema', label: 'Estado del sistema', icon: Activity },
  { href: '/configuracion', label: 'Umbrales', icon: SlidersHorizontal },
];

function useLocalTime() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const localTime = useLocalTime();
  const scenario = useVigia((s) => s.scenario);
  const clock = useVigia((s) => s.clock);
  const mineLevel = useVigia((s) => s.mineLevel);
  const paused = useVigia((s) => s.paused);
  const current = NAV.find((item) => pathname.startsWith(item.href));
  const scenarioName = SCENARIO_BY_ID[scenario].name;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="no-print border-b border-line bg-panel md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-5 py-4 md:py-6">
          <span className="font-display text-3xl font-semibold tracking-[0.18em] text-ink">VIGIA</span>
        </div>
        <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors ${
                  active ? 'bg-panel-2 text-ink ring-1 ring-line' : 'text-ink-muted hover:bg-panel-2 hover:text-ink'
                }`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto hidden px-5 py-4 text-xs text-ink-muted md:block">Datos simulados · prototipo</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-canvas/80 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-ink">{current?.label ?? 'VIGIA'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-ink-muted">Estado general</span>
              <LevelPill level={mineLevel} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-muted">Escenario</span>
              <span className="font-medium text-ink">{scenarioName}</span>
              <span className="tabular-nums text-ink-muted">T+{clock}</span>
              {paused ? <span className="text-ink-muted">· pausado</span> : null}
            </div>
            <time className="tabular-nums text-ink-muted" suppressHydrationWarning>
              {localTime ?? '--:--:--'}
            </time>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>

      <AlertNotifier />
      <EmergencyBanner />
    </div>
  );
}
