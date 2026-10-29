'use client';

import dynamic from 'next/dynamic';
import { LevelPill, Panel, buttonActive, buttonIdle } from '@/components/ui/primitives';
import { GAS_ORDER, type GasKey } from '@/config/thresholds';
import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

const MineMap = dynamic(() => import('./MineMap').then((m) => m.MineMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[34rem] items-center justify-center rounded-md border border-line bg-canvas text-ink-muted md:h-[42rem]">
      Cargando mapa 3D…
    </div>
  ),
});

export function MapView() {
  const stations = useVigia((s) => s.stations);
  const workers = useVigia((s) => s.workers);
  const thresholds = useVigia((s) => s.thresholds);
  const selectedStationId = useVigia((s) => s.selectedStationId);
  const selectedWorkerId = useVigia((s) => s.selectedWorkerId);
  const heatGas = useVigia((s) => s.heatGas);
  const setHeatGas = useVigia((s) => s.setHeatGas);
  const selectStation = useVigia((s) => s.selectStation);
  const selectWorker = useVigia((s) => s.selectWorker);

  const station = stations.find((s) => s.id === selectedStationId);
  const worker = workers.find((w) => w.id === selectedWorkerId);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <MineMap />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Capa de mapa de calor">
          <span className="mr-2 text-sm text-ink-muted">Mapa de calor:</span>
          <button type="button" onClick={() => setHeatGas(null)} aria-pressed={heatGas === null} className={heatGas === null ? buttonActive : buttonIdle}>
            Apagado
          </button>
          {GAS_ORDER.map((gas: GasKey) => (
            <button
              key={gas}
              type="button"
              onClick={() => setHeatGas(gas)}
              aria-pressed={heatGas === gas}
              className={heatGas === gas ? buttonActive : buttonIdle}
            >
              {thresholds[gas].label.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <Panel title="Detalle" description="Haz clic en una estación o minero del mapa, o elige uno de la lista.">
          {station ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold text-ink">{station.id}</p>
                  <p className="text-sm text-ink-muted">{NODE_BY_ID[station.id].name}</p>
                </div>
                <LevelPill level={station.level} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-ink-muted">Batería</dt>
                  <dd className="tabular-nums text-ink">{station.battery.toFixed(0)} %</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Latencia</dt>
                  <dd className="tabular-nums text-ink">{station.latencyMs} ms</dd>
                </div>
              </dl>
              <table className="w-full text-sm">
                <caption className="sr-only">Lecturas de la estación {station.id}</caption>
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th scope="col" className="py-1.5 font-medium">Gas</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Promedio</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Nivel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {GAS_ORDER.map((gas) => {
                    const reading = station.readings[gas];
                    return (
                      <tr key={gas}>
                        <td className="py-1.5 text-ink">{thresholds[gas].label.split(' (')[0]}</td>
                        <td className="py-1.5 text-right tabular-nums text-ink">
                          {reading.avg.toFixed(thresholds[gas].decimals)} <span className="text-ink-muted">{thresholds[gas].unit}</span>
                        </td>
                        <td className="py-1.5 text-right">
                          <LevelPill level={reading.level} compact />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : worker ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold text-ink">{worker.name}</p>
                  <p className="text-sm text-ink-muted">
                    {worker.role} · {worker.mx6}
                  </p>
                </div>
                <LevelPill level={worker.level} />
              </div>
              <p className="text-sm text-ink">
                Ubicación: <span className="font-medium">{worker.stationId}</span>
                {worker.evacuating ? <span className="text-lvl3"> · evacuando</span> : null}
              </p>
              <p className="text-sm text-ink-muted">Batería {worker.battery} %</p>
            </div>
          ) : (
            <p className="text-ink-muted">Ninguna selección.</p>
          )}
        </Panel>

        <Panel title="Estaciones" description="Lista accesible para seleccionar sin mouse.">
          <ul className="grid max-h-80 gap-1 overflow-y-auto pr-1">
            {stations.map((st) => (
              <li key={st.id}>
                <button
                  type="button"
                  onClick={() => selectStation(st.id)}
                  aria-pressed={st.id === selectedStationId}
                  className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm ${
                    st.id === selectedStationId ? 'bg-panel-2 text-ink' : 'text-ink-muted hover:bg-panel-2 hover:text-ink'
                  }`}
                >
                  <span className="tabular-nums">{st.id}</span>
                  <LevelPill level={st.level} compact />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Personal en la mina" description="Haz clic para seleccionar un minero y resaltarlo en el mapa.">
          <ul className="grid max-h-64 gap-1 overflow-y-auto pr-1">
            {workers.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => selectWorker(w.id)}
                  aria-pressed={w.id === selectedWorkerId}
                  className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm ${
                    w.id === selectedWorkerId ? 'bg-panel-2 text-ink' : 'text-ink-muted hover:bg-panel-2 hover:text-ink'
                  }`}
                >
                  <span>
                    {w.name}
                    <span className="block text-xs">{w.exited ? 'Evacuado' : w.stationId}</span>
                  </span>
                  <LevelPill level={w.level} compact />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
