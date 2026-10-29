'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LevelPill, Metric, Panel, buttonActive, buttonIdle } from '@/components/ui/primitives';
import { GAS_ORDER, levelFor, type GasKey } from '@/config/thresholds';
import { NODE_BY_ID, STATION_IDS } from '@/sim/mine';
import { buildSeries, detectEvents, STEP_MINUTES } from '@/sim/history';
import { useVigia } from '@/store/vigia-store';

const RANGES = [
  { label: '24 horas', minutes: 1440 },
  { label: '48 horas', minutes: 2880 },
  { label: '5 días', minutes: 5 * 1440 },
] as const;

/** Fin del histórico simulado: 29 oct 2026, 12:00 hora de Colombia. Fijo para que la demo sea repetible. */
const END_MINUTE = Math.floor(Date.UTC(2026, 9, 29, 17, 0) / 60_000);

const timeLabel = (t: number) =>
  new Date(t).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });

export function HistoryView() {
  const thresholds = useVigia((s) => s.thresholds);
  const [gas, setGas] = useState<GasKey>('CH4');
  const [stationId, setStationId] = useState<string>('mina');
  const [rangeIndex, setRangeIndex] = useState(0);
  const [compare, setCompare] = useState(false);
  const threshold = thresholds[gas];
  const range = RANGES[rangeIndex];
  const station = stationId === 'mina' ? null : stationId;

  const { points, previous, stats, events } = useMemo(() => {
    const endMinute = END_MINUTE;
    const current = buildSeries({
      gas,
      stationId: station,
      direction: threshold.direction,
      endMinute,
      minutes: range.minutes,
    });
    const prev = compare
      ? buildSeries({ gas, stationId: station, direction: threshold.direction, endMinute: endMinute - range.minutes, minutes: range.minutes })
      : [];
    const values = current.map((p) => p.value);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const overMinutes = current.filter((p) => levelFor(p.value, threshold) > 0).length * STEP_MINUTES;
    return {
      points: current,
      previous: prev,
      stats: { avg, max, min, overMinutes },
      events: detectEvents(current, threshold).slice(0, 15),
    };
  }, [gas, station, threshold, range.minutes, compare]);

  const chartData = points.map((p, i) => ({ t: p.t, value: p.value, previous: previous[i]?.value }));
  const decimals = threshold.decimals;
  const extreme = threshold.direction === 'above' ? stats.max : stats.min;

  const exportCsv = () => {
    const header = ['fecha_hora', `valor_${gas}`, 'unidad'].join(',');
    const rows = points.map((p) => `${new Date(p.t).toISOString()},${p.value.toFixed(decimals)},${threshold.unit}`);
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vigia-${gas}-${stationId}-${range.minutes / 60}h.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Panel title="Consulta" description="Datos simulados. Filtra por gas, estación y rango de fechas.">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[14rem] flex-col gap-1.5 text-sm text-ink-muted">
            Gas
            <select value={gas} onChange={(e) => setGas(e.target.value as GasKey)} className="rounded-sm border border-line bg-panel-2 px-3 py-2 text-ink">
              {GAS_ORDER.map((g) => (
                <option key={g} value={g}>
                  {thresholds[g].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[14rem] flex-col gap-1.5 text-sm text-ink-muted">
            Estación
            <select value={stationId} onChange={(e) => setStationId(e.target.value)} className="rounded-sm border border-line bg-panel-2 px-3 py-2 text-ink">
              <option value="mina">Mina (valor más crítico)</option>
              {STATION_IDS.map((id) => (
                <option key={id} value={id}>
                  {id} · {NODE_BY_ID[id].name.split(' · ')[1]}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Rango" className="flex flex-wrap items-center gap-1">
            {RANGES.map((r, index) => (
              <button key={r.label} type="button" aria-pressed={rangeIndex === index} onClick={() => setRangeIndex(index)} className={rangeIndex === index ? buttonActive : buttonIdle}>
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" aria-pressed={compare} onClick={() => setCompare((v) => !v)} className={compare ? buttonActive : buttonIdle}>
            Comparar con periodo anterior
          </button>
          <div className="ml-auto flex flex-wrap gap-2 no-print">
            <button type="button" onClick={exportCsv} className={buttonIdle}>
              Exportar CSV
            </button>
            <button type="button" onClick={() => window.print()} className={buttonIdle}>
              Imprimir reporte SST
            </button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Promedio del periodo" value={stats.avg.toFixed(decimals)} unit={threshold.unit} />
        <Metric
          label={threshold.direction === 'above' ? 'Máximo del periodo' : 'Mínimo del periodo'}
          value={extreme.toFixed(decimals)}
          unit={threshold.unit}
          tone={levelFor(extreme, threshold)}
        />
        <Metric label="Tiempo sobre Nivel 1" value={stats.overMinutes} unit="min" />
      </div>

      <Panel
        title={`${threshold.label} · ${stationId === 'mina' ? 'mina' : stationId}`}
        description={compare ? 'Línea continua: periodo actual. Línea discontinua: periodo anterior del mismo tamaño.' : `Rango: ${range.label}.`}
      >
        <div className="h-80 w-full" role="img" aria-label={`Histórico simulado de ${threshold.label}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#1f2b37" vertical={false} />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => timeLabel(Number(v))} stroke="#8a9aab" tick={{ fontSize: 12, fill: '#8a9aab' }} minTickGap={60} />
              <YAxis stroke="#8a9aab" tick={{ fontSize: 12, fill: '#8a9aab' }} width={64} domain={['auto', 'auto']} tickFormatter={(v) => Number(v).toFixed(decimals)} />
              <Tooltip
                contentStyle={{ background: '#111820', border: '1px solid #1f2b37', borderRadius: 4, color: '#e8eef4' }}
                labelFormatter={(v) => timeLabel(Number(v))}
                formatter={(value, name) => [`${Number(value).toFixed(decimals)} ${threshold.unit}`, String(name)]}
              />
              <ReferenceLine y={threshold.level1} stroke="#facc15" strokeDasharray="2 4" />
              <ReferenceLine y={threshold.level2} stroke="#fb923c" strokeDasharray="2 4" />
              <ReferenceLine y={threshold.level3} stroke="#f43f5e" strokeDasharray="2 4" />
              <Line type="monotone" dataKey="value" name="Periodo actual" stroke="#e8eef4" strokeWidth={2} dot={false} isAnimationActive={false} />
              {compare ? (
                <Line type="monotone" dataKey="previous" name="Periodo anterior" stroke="#8a9aab" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Eventos del periodo" description={`Cruces del umbral de Nivel 1 o superior. Mostrando hasta 15 de los más recientes.`}>
        {events.length === 0 ? (
          <p className="text-ink-muted">Sin eventos en este periodo para este gas y estación.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Eventos del periodo seleccionado</caption>
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Inicio</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Nivel máximo</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Valor pico</th>
                  <th scope="col" className="py-2 text-right font-medium">Duración aprox.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((event) => (
                  <tr key={event.start}>
                    <td className="py-2.5 pr-4 tabular-nums text-ink">{timeLabel(event.start)}</td>
                    <td className="py-2.5 pr-4"><LevelPill level={event.peakLevel} compact /></td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink">
                      {event.peakValue.toFixed(decimals)} <span className="text-ink-muted">{threshold.unit}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-muted">{event.durationMin} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-sm text-ink-muted">
        Histórico generado con datos simulados. Los niveles usan los umbrales de ejemplo de Configuración, pendientes de la normativa.
        Nivel de referencia en el periodo: {LEVEL_LABEL[levelFor(extreme, threshold)]}.
      </p>
    </div>
  );
}

const LEVEL_LABEL = ['Normal', 'Precaución', 'Alerta', 'Emergencia'] as const;
