'use client';

import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

/** Aviso a pantalla completa cuando hay una alerta de Nivel 3. Reaparece si llega otra alerta de Nivel 3. */
export function EmergencyBanner() {
  const alerts = useVigia((s) => s.alerts);
  const emergency = useVigia((s) => s.emergency);
  const thresholds = useVigia((s) => s.thresholds);
  const dismissedId = useVigia((s) => s.dismissedEmergencyId);
  const dismiss = useVigia((s) => s.dismissEmergency);

  if (!emergency) return null;
  const alert = [...alerts].reverse().find((a) => a.level === 3 && a.status === 'activa');
  if (!alert || alert.id === dismissedId) return null;

  const station = NODE_BY_ID[alert.stationId];
  const threshold = thresholds[alert.gas];

  return (
    <div
      role="alert"
      aria-labelledby="alert-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-canvas/95 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-md border border-lvl3 bg-panel">
        <div className="bg-lvl3 px-6 py-3 text-canvas">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em]">Alerta · Nivel 3</p>
        </div>
        <div className="space-y-5 p-6 md:p-8">
          <h2 id="alert-title" className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            {threshold.label}
          </h2>
          <p className="text-lg text-ink-muted">
            {alert.stationId} · {station?.name.split(' · ')[1]}
          </p>
          <p className="font-display text-5xl font-semibold tabular-nums text-lvl3">
            {alert.value.toFixed(threshold.decimals)}
            <span className="ml-2 text-2xl font-medium text-ink-muted">{threshold.unit}</span>
          </p>
          <p className="tabular-nums text-ink-muted">Hora {alert.time}</p>
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            className="rounded-sm bg-ink px-5 py-3 text-base font-semibold text-canvas hover:bg-ink/90"
          >
            Cerrar aviso
          </button>
        </div>
      </div>
    </div>
  );
}
