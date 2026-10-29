'use client';

import Link from 'next/link';
import { LevelPill, Metric, Panel, buttonIdle } from '@/components/ui/primitives';
import type { GasKey } from '@/config/thresholds';
import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

const SHOWN_GASES: GasKey[] = ['CO', 'H2S', 'CH4'];

export function PersonnelView() {
  const workers = useVigia((s) => s.workers);
  const latched = useVigia((s) => s.latched);
  const thresholds = useVigia((s) => s.thresholds);
  const selectWorker = useVigia((s) => s.selectWorker);
  const selectedWorkerId = useVigia((s) => s.selectedWorkerId);

  const inside = workers.filter((w) => !w.exited);
  const affected = inside.filter((w) => w.level >= 2 || w.evacuating);
  const stationName = (id: string) => NODE_BY_ID[id]?.name.split(' · ')[1] ?? id;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Mineros dentro" value={inside.length} unit={`de ${workers.length}`} />
        <Metric
          label="En zona afectada"
          value={affected.length}
          tone={affected.some((w) => w.level === 3) ? 3 : affected.length > 0 ? 2 : 0}
        />
        <Metric label="Evacuados" value={workers.length - inside.length} />
      </div>

      {affected.length > 0 ? (
        <Panel
          title="Evacuación sugerida"
          description={`Ruta hasta la entrada para el personal en zona afectada. Evacuación ${latched.evacuation ? 'iniciada' : 'no iniciada'}.`}
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {affected.map((w) => (
              <li key={w.id} className="rounded-md border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">{w.name}</span>
                  <LevelPill level={w.level} compact />
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Desde {w.stationId} · {stationName(w.stationId)}
                </p>
                <p className="mt-3 text-sm tabular-nums text-ink">
                  {w.route.length > 1 ? w.route.join(' → ') : 'Ruta no disponible'}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Personal" description="Exposición promedio (tipo TWA) desde el inicio del turno. Batería y ubicación en vivo.">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <caption className="sr-only">Personal de la mina con exposición a gases</caption>
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Nombre y cargo</th>
                <th scope="col" className="py-2 pr-4 font-medium">MX6</th>
                <th scope="col" className="py-2 pr-4 font-medium">Ubicación</th>
                <th scope="col" className="py-2 pr-4 font-medium">Estado</th>
                {SHOWN_GASES.map((gas) => (
                  <th key={gas} scope="col" className="py-2 pr-4 text-right font-medium">
                    {thresholds[gas].label.split(' (')[0]}
                  </th>
                ))}
                <th scope="col" className="py-2 pr-4 text-right font-medium">Batería</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {workers.map((w) => {
                return (
                  <tr key={w.id} className={w.id === selectedWorkerId ? 'bg-panel-2' : ''}>
                    <td className="py-3 pr-4">
                      <span className="block font-medium text-ink">{w.name}</span>
                      <span className="text-xs text-ink-muted">{w.role}</span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-ink-muted">{w.mx6}</td>
                    <td className="py-3 pr-4 text-ink">
                      {w.exited ? 'Fuera de la mina' : `${w.stationId} · ${stationName(w.stationId)}`}
                    </td>
                    <td className="py-3 pr-4">
                      {w.exited ? (
                        <span className="text-ink-muted">Evacuado</span>
                      ) : (
                        <LevelPill level={w.level} compact />
                      )}
                    </td>
                    {SHOWN_GASES.map((gas) => (
                      <td key={gas} className="py-3 pr-4 text-right tabular-nums text-ink">
                        {w.twa[gas].toFixed(thresholds[gas].decimals)}{' '}
                        <span className="text-ink-muted">{thresholds[gas].unit}</span>
                      </td>
                    ))}
                    <td className="py-3 pr-4 text-right tabular-nums text-ink">{w.battery} %</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => selectWorker(w.id)} className={buttonIdle}>
                          Resaltar
                        </button>
                        <Link href="/mapa" onClick={() => selectWorker(w.id)} className={buttonIdle}>
                          Ver en mapa
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
