'use client';

import Link from 'next/link';
import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

/** Aviso a pantalla completa cuando hay Nivel 3 activo. Reaparece si llega una nueva alerta de Nivel 3. */
export function EmergencyBanner() {
  const alerts = useVigia((s) => s.alerts);
  const emergency = useVigia((s) => s.emergency);
  const latched = useVigia((s) => s.latched);
  const dismissedId = useVigia((s) => s.dismissedEmergencyId);
  const dismiss = useVigia((s) => s.dismissEmergency);

  if (!emergency) return null;
  const alert = [...alerts].reverse().find((a) => a.level === 3 && a.status === 'activa');
  if (!alert || alert.id === dismissedId) return null;

  const station = NODE_BY_ID[alert.stationId];
  const actions = [
    { label: 'Corte eléctrico de la zona', done: latched.powerCut },
    { label: 'Ventiladores al máximo', done: latched.fansMax },
    { label: 'Evacuación del personal hacia la entrada', done: latched.evacuation },
  ];

  return (
    <div
      role="alert"
      aria-labelledby="emergency-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-canvas/95 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-md border border-lvl3 bg-panel">
        <div className="bg-lvl3 px-6 py-3 text-canvas">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em]">Nivel 3 · Emergencia</p>
        </div>
        <div className="space-y-6 p-6 md:p-8">
          <h2 id="emergency-title" className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            {alert.gas} en {alert.stationId}
          </h2>
          <p className="text-lg text-ink-muted">
            {station?.name} · valor promedio {alert.value.toFixed(2)} · hora {alert.time}
          </p>
          <ul className="space-y-3">
            {actions.map((action) => (
              <li key={action.label} className="flex items-center gap-3 text-lg">
                <span
                  aria-hidden="true"
                  className={`flex size-6 items-center justify-center rounded-sm border text-xs font-bold ${
                    action.done ? 'border-lvl3 bg-lvl3 text-canvas' : 'border-line text-ink-muted'
                  }`}
                >
                  {action.done ? '✓' : ''}
                </span>
                <span className={action.done ? 'text-ink' : 'text-ink-muted'}>
                  {action.label}
                  <span className="sr-only">{action.done ? ' (activo)' : ' (pendiente)'}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              autoFocus
              onClick={dismiss}
              className="rounded-sm bg-ink px-5 py-3 text-base font-semibold text-canvas hover:bg-ink/90"
            >
              Cerrar aviso
            </button>
            <Link
              href="/alertas"
              onClick={dismiss}
              className="rounded-sm border border-line px-5 py-3 text-base font-semibold text-ink hover:border-ink-muted"
            >
              Ir al centro de alertas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
