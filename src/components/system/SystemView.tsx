'use client';

import { Metric, Panel } from '@/components/ui/primitives';
import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

const LOW_BATTERY = 25;
const HIGH_LATENCY = 150;

export function SystemView() {
  const stations = useVigia((s) => s.stations);
  const system = useVigia((s) => s.system);

  const online = stations.filter((s) => s.online).length;
  const lowBattery = stations.filter((s) => s.battery < LOW_BATTERY);
  const slowLinks = stations.filter((s) => s.latencyMs > HIGH_LATENCY);
  const oldestCalibration = [...stations].sort((a, b) => a.lastCalibration.localeCompare(b.lastCalibration))[0];

  const health = [
    {
      label: 'Comunicación',
      value: `${online} de ${stations.length}`,
      status: online === stations.length ? 'Saludable' : 'Atención',
      ok: online === stations.length,
    },
    {
      label: 'Batería mínima',
      value: `${Math.min(...stations.map((s) => s.battery)).toFixed(0)} %`,
      status: lowBattery.length === 0 ? 'Saludable' : `${lowBattery.length} por debajo de ${LOW_BATTERY} %`,
      ok: lowBattery.length === 0,
    },
    {
      label: 'Latencia de enlace',
      value: `${Math.max(...stations.map((s) => s.latencyMs))} ms`,
      status: slowLinks.length === 0 ? 'Saludable' : `${slowLinks.length} enlaces lentos`,
      ok: slowLinks.length === 0,
    },
    {
      label: 'Calibración más antigua',
      value: oldestCalibration?.lastCalibration ?? '—',
      status: oldestCalibration ? oldestCalibration.id : '—',
      ok: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {health.map((item) => (
          <div key={item.label} className="flex flex-col gap-2 rounded-md border border-line bg-panel p-5">
            <p className="text-sm text-ink-muted">{item.label}</p>
            <p className="font-display text-3xl font-semibold tabular-nums text-ink">{item.value}</p>
            <p className={`text-sm ${item.ok ? 'text-ink-muted' : 'text-lvl2'}`}>
              {item.ok ? '● ' : '▲ '}
              {item.status}
            </p>
          </div>
        ))}
      </div>

      <Panel title="Dispositivo de procesamiento">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-ink-muted">Conexión con la plataforma</dt>
            <dd className="mt-1 text-base text-ink">{system.connection}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Broker de mensajes</dt>
            <dd className="mt-1 text-base text-ink">{system.broker}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Cola store-and-forward</dt>
            <dd className="mt-1 text-base tabular-nums text-ink">{system.queueLength} lotes pendientes</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Tiempo de procesamiento</dt>
            <dd className="mt-1 text-base tabular-nums text-ink">{system.processingMs} ms</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Estaciones">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <caption className="sr-only">Estado de comunicación, batería y calibración de cada estación</caption>
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Estación</th>
                <th scope="col" className="py-2 pr-4 font-medium">Galería</th>
                <th scope="col" className="py-2 pr-4 font-medium">Comunicación</th>
                <th scope="col" className="py-2 pr-4 font-medium">Batería</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Temperatura</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Humedad relativa</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Temp. húmeda (calc.)</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Latencia</th>
                <th scope="col" className="py-2 font-medium">Última calibración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stations.map((st) => {
                const lowBat = st.battery < LOW_BATTERY;
                return (
                  <tr key={st.id}>
                    <td className="py-2.5 pr-4 font-medium text-ink">{st.id}</td>
                    <td className="py-2.5 pr-4 text-ink-muted">{NODE_BY_ID[st.id].name.split(' · ')[1]}</td>
                    <td className={st.online ? 'py-2.5 pr-4 text-ink' : 'py-2.5 pr-4 font-semibold text-lvl3'}>{st.online ? '● En línea' : '○ Sin señal'}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line" aria-hidden="true">
                          <span className={`block h-full ${lowBat ? 'bg-lvl2' : 'bg-ink-muted'}`} style={{ width: `${st.battery}%` }} />
                        </span>
                        <span className={`tabular-nums ${lowBat ? 'text-lvl2' : 'text-ink'}`}>{st.battery.toFixed(0)} %</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink">{st.climate.tempC.toFixed(1)} °C</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink">{st.climate.rh.toFixed(0)} %</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink-muted">{st.climate.wetBulbC.toFixed(1)} °C</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink">{st.latencyMs} ms</td>
                    <td className="py-2.5 tabular-nums text-ink-muted">{st.lastCalibration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Metric label="Estaciones en línea" value={online} unit={`de ${stations.length}`} />
    </div>
  );
}
