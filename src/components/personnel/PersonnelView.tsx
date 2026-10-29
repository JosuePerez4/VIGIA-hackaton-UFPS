'use client';

import Link from 'next/link';
import { LevelPill, Metric, Panel, buttonIdle } from '@/components/ui/primitives';
import type { GasKey } from '@/config/thresholds';
import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

const SHOWN_GASES: GasKey[] = ['CO', 'H2S', 'CH4', 'O2'];

export function PersonnelView() {
  const workers = useVigia((s) => s.workers);
  const thresholds = useVigia((s) => s.thresholds);
  const selectWorker = useVigia((s) => s.selectWorker);
  const selectedWorkerId = useVigia((s) => s.selectedWorkerId);

  const alerted = workers.filter((w) => w.level >= 2);
  const stationName = (id: string) => NODE_BY_ID[id]?.name.split(' · ')[1] ?? id;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Mineros en recorrido" value={workers.length} />
        <Metric
          label="En puntos con alerta"
          value={alerted.length}
          tone={alerted.some((w) => w.level === 3) ? 3 : alerted.length > 0 ? 2 : 0}
        />
        <Metric label="Muestras enviadas por MX6" value={workers.reduce((sum, w) => sum + w.samples, 0).toLocaleString('es-CO')} />
      </div>

      <Panel
        title="Personal y dispositivos MX6"
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
            <caption className="sr-only">Mineros con su dispositivo MX6, enlace, lecturas y exposición</caption>
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Nombre y cargo</th>
                <th scope="col" className="py-2 pr-4 font-medium">MX6</th>
                <th scope="col" className="py-2 pr-4 font-medium">Enlace</th>
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
              {workers.map((w) => (
                <tr key={w.id} className={w.id === selectedWorkerId ? 'bg-panel-2' : ''}>
                  <td className="py-3 pr-4">
                    <span className="block font-medium text-ink">{w.name}</span>
                    <span className="text-xs text-ink-muted">{w.role}</span>
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-ink-muted">{w.mx6}</td>
                  <td className="py-3 pr-4 text-ink">
                    {w.linkedStationId} <span className="text-ink-muted">· {stationName(w.linkedStationId)}</span>
                  </td>
                  <td className="py-3 pr-4"><LevelPill level={w.level} compact /></td>
                  {SHOWN_GASES.map((gas) => (
                    <td key={gas} className="py-3 pr-4 text-right tabular-nums text-ink">
                      {w.reading[gas].toFixed(thresholds[gas].decimals)}{' '}
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
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
