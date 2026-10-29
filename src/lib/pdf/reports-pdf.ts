import { rgb, type RGB } from 'pdf-lib';
import { GAS_ORDER, LEVEL_META, gasThreshold, levelFor, type GasKey, type GasThreshold, type Level } from '@/config/thresholds';
import { clockFromElapsed, engine } from '@/sim/engine';
import { NODE_BY_ID } from '@/sim/mine';
import type { AlertRecord, MineSnapshot } from '@/sim/types';
import { LEVEL_TEXT_COLORS, PdfReport } from './layout';

type Thresholds = Record<GasKey, GasThreshold>;

/** Segundos antes y después de la alerta que incluye el reporte de incidente. */
const CONTEXT_S = 120;
/** Cuánto antes de la alerta empieza la gráfica de evolución. */
const LEAD_S = 300;

const LEVEL_FILL: Record<number, RGB> = {
  0: rgb(0.02, 0.59, 0.41),
  1: rgb(0.85, 0.6, 0.04),
  2: rgb(0.92, 0.35, 0.05),
  3: rgb(0.88, 0.11, 0.28),
};

const stamp = () =>
  new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

const fmt = (value: number, decimals: number) => value.toFixed(decimals);
const stationArea = (id: string) => NODE_BY_ID[id]?.name.split(' · ')[1] ?? '';
const levelCell = (level: Level) => ({ text: LEVEL_META[level].mineLabel, color: LEVEL_TEXT_COLORS[level], bold: true });
const levelLines = (thresholds: GasThreshold): { value: number; color: RGB; label: string }[] => [
  { value: thresholds.level1, color: LEVEL_FILL[1], label: 'Nivel 1' },
  { value: thresholds.level2, color: LEVEL_FILL[2], label: 'Nivel 2' },
  { value: thresholds.level3, color: LEVEL_FILL[3], label: 'Nivel 3' },
];

/** Frase de tendencia: qué hizo el valor entre dos instantes, con la hora real. */
function trendSentence(
  label: string,
  unit: string,
  decimals: number,
  first: number,
  last: number,
  peak: number,
  thresholds: GasThreshold,
  fromClock: string,
  toClock: string,
): string {
  const range = Math.max(thresholds.level3 - thresholds.level1, 1e-9);
  const delta = last - first;
  const movement =
    Math.abs(delta) < range * 0.03 ? 'se mantuvo estable' : delta > 0 ? 'aumentó' : 'disminuyó';
  const peakLevel = LEVEL_META[levelFor(peak, thresholds)].mineLabel;
  return (
    `${label} ${movement} entre ${fromClock} y ${toClock}: pasó de ${fmt(first, decimals)} a ${fmt(last, decimals)} ${unit}. ` +
    `Valor más crítico del periodo: ${fmt(peak, decimals)} ${unit} (${peakLevel}).`
  );
}

/** Reporte de incidente: la alerta, cómo evolucionó el gas, lo que medía la estación, quién estaba cerca y lo que pasó alrededor. */
export async function incidentPdf(snapshot: MineSnapshot, alert: AlertRecord, thresholds: Thresholds): Promise<Uint8Array> {
  const threshold = gasThreshold(alert.gas, thresholds);
  const isEquipment = alert.kind === 'equipo';
  const station = snapshot.stations.find((s) => s.id === alert.stationId);
  const from = alert.elapsed - CONTEXT_S;
  const to = alert.elapsed + CONTEXT_S;
  const inWindow = (elapsed: number) => elapsed >= from && elapsed <= to;
  const timeline = snapshot.timeline.filter((e) => inWindow(e.elapsed));
  const others = snapshot.alerts.filter((a) => a.id !== alert.id && inWindow(a.elapsed));
  const workers = snapshot.workers.filter((w) => w.linkedStationId === alert.stationId);
  const clock = (elapsed: number) => clockFromElapsed(elapsed, snapshot.startSeconds);

  // Evolución: promedio de 40 s de la estación desde antes de la alerta hasta el momento del reporte.
  const trace = isEquipment ? [] : engine.stationTrace(alert.stationId, alert.gas as GasKey, Math.max(0, alert.elapsed - LEAD_S), snapshot.elapsed);
  const values = trace.map((p) => p.v);
  const first = values[0];
  const last = values[values.length - 1];
  const peak = threshold.direction === 'above' ? Math.max(...values) : Math.min(...values);

  const report = await PdfReport.create(`VIGIA · Reporte de incidente #${alert.id} · Fuente: simulación · ${stamp()}`);
  report.cover(
    `Reporte de incidente #${alert.id}`,
    `${LEVEL_META[alert.level].label} · ${alert.stationId} · ${isEquipment ? alert.detail : threshold.label} · ${alert.time}`,
    LEVEL_FILL[alert.level],
  );

  report.kpis([
    { label: 'Nivel', value: LEVEL_META[alert.level].mineLabel, color: LEVEL_TEXT_COLORS[alert.level] },
    { label: isEquipment ? 'Tipo' : 'Valor al disparar', value: isEquipment ? 'Equipo' : `${fmt(alert.value, threshold.decimals)} ${threshold.unit}` },
    { label: 'Estación', value: alert.stationId },
    { label: 'Hora simulada', value: alert.time },
  ]);

  if (!isEquipment) {
  report.heading('Evolución');
  if (values.length >= 2) {
    report.paragraph(
      trendSentence(
        threshold.label,
        threshold.unit,
        threshold.decimals,
        first,
        last,
        peak,
        threshold,
        clock(trace[0].t),
        clock(trace[trace.length - 1].t),
      ),
      9.5,
      LEVEL_TEXT_COLORS[1],
    );
    report.chart({
      points: trace.map((p) => ({ t: p.t, v: p.v })),
      thresholds: levelLines(threshold),
      marker: { t: alert.elapsed, label: `Alerta ${alert.time}` },
      unit: `${threshold.label} · promedio 40 s (${threshold.unit})`,
      decimals: threshold.decimals,
      timeLabel: clock,
    });
  } else {
    report.empty('Todavía no hay suficientes datos para mostrar la evolución.');
  }
  }

  report.heading('Alerta');
  report.keyValues([
    isEquipment ? ['Detalle', alert.detail] : ['Gas', threshold.label],
    ['Área', stationArea(alert.stationId)],
    ['Canal que disparó', alert.channel === 'rápido' ? 'Canal rápido' : 'Canal lento (oficial)'],
    ['Estado', `${alert.status}${alert.acknowledged ? ' · reconocida' : ' · sin reconocer'}`],
    ['Estado general de la mina', LEVEL_META[snapshot.mineLevel].label],
  ]);

  if (!isEquipment) {
  report.heading('Lecturas de la estación al generar el reporte');
  if (station) {
    report.table({
      headers: ['Gas', 'Último valor', 'Promedio 40 s', 'Nivel'],
      widths: [0.4, 0.2, 0.2, 0.2],
      align: ['left', 'right', 'right', 'left'],
      rows: GAS_ORDER.map((gas) => {
        const r = station.readings[gas];
        const t = thresholds[gas];
        return [t.label, `${fmt(r.raw, t.decimals)} ${t.unit}`, `${fmt(r.avg, t.decimals)} ${t.unit}`, levelCell(r.level)];
      }),
    });
    report.keyValues([
      ['Temperatura', `${fmt(station.climate.tempC, 1)} °C`],
      ['Humedad relativa (medida)', `${fmt(station.climate.rh, 0)} %`],
      ['Temperatura húmeda (calculada)', `${fmt(station.climate.wetBulbC, 1)} °C`],
    ]);
  } else {
    report.empty('Estación no encontrada en el estado actual.');
  }
  }

  report.heading('Mineros enlazados a la estación');
  if (workers.length) {
    report.table({
      headers: ['Minero', 'MX6', 'CH4', 'CO', 'H2S', 'O2', 'Nivel del punto'],
      widths: [0.23, 0.14, 0.11, 0.11, 0.11, 0.11, 0.19],
      align: ['left', 'left', 'right', 'right', 'right', 'right', 'left'],
      rows: workers.map((w) => [
        w.name,
        w.mx6,
        fmt(w.reading.CH4, thresholds.CH4.decimals),
        fmt(w.reading.CO, thresholds.CO.decimals),
        fmt(w.reading.H2S, thresholds.H2S.decimals),
        fmt(w.reading.O2, thresholds.O2.decimals),
        levelCell(w.level),
      ]),
    });
  } else {
    report.empty('Ningún minero está enlazado a esta estación en este momento.');
  }

  report.heading(`Eventos en los ${CONTEXT_S} s alrededor de la alerta`);
  if (timeline.length) {
    report.table({
      headers: ['Hora', 'Evento'],
      widths: [0.14, 0.86],
      rows: timeline.map((e) => [{ text: e.time, bold: true }, e.text]),
    });
  } else {
    report.empty('Sin eventos registrados en ese intervalo.');
  }

  report.heading('Otras alertas en el mismo intervalo');
  if (others.length) {
    report.table({
      headers: ['Hora', 'Estación', 'Gas', 'Nivel', 'Estado'],
      widths: [0.14, 0.14, 0.34, 0.18, 0.2],
      rows: others.map((a) => [a.time, a.stationId, gasThreshold(a.gas, thresholds).label, levelCell(a.level), a.status]),
    });
  } else {
    report.empty('Ninguna.');
  }

  return report.save();
}

/** Reporte del turno: totales por nivel, evolución del gas más alertado, alertas y línea de tiempo. */
export async function turnPdf(snapshot: MineSnapshot, thresholds: Thresholds): Promise<Uint8Array> {
  const active = snapshot.alerts.filter((a) => a.status === 'activa');
  const unacknowledged = active.filter((a) => !a.acknowledged).length;
  const mineLevel = snapshot.mineLevel;
  const clock = (elapsed: number) => clockFromElapsed(elapsed, snapshot.startSeconds);

  // Gas con más alertas: su evolución es la que cuenta la historia del turno.
  const perGas = GAS_ORDER.map((gas) => ({ gas, count: snapshot.alerts.filter((a) => a.gas === gas).length }));
  const focus = perGas.reduce((best, cur) => (cur.count > best.count ? cur : best), perGas[0]);
  const focusThreshold = thresholds[focus.gas];
  const series = snapshot.series[focus.gas];

  const report = await PdfReport.create(`VIGIA · Reporte del turno · Fuente: simulación · ${stamp()}`);
  report.cover('Reporte del turno', `${snapshot.scenario} · objetivo ${snapshot.target} · inicio ${clock(0)} · ahora ${snapshot.clock}`, LEVEL_FILL[mineLevel]);

  report.kpis([
    { label: 'Estado general', value: LEVEL_META[mineLevel].mineLabel, color: LEVEL_TEXT_COLORS[mineLevel] },
    { label: 'Alertas en total', value: String(snapshot.alerts.length) },
    { label: 'Activas', value: String(active.length) },
    { label: 'Sin reconocer', value: String(unacknowledged), color: unacknowledged ? LEVEL_TEXT_COLORS[2] : undefined },
  ]);

  report.heading('Evolución');
  if (focus.count > 0 && series.length >= 2) {
    const values = series.map((p) => p.slow);
    const first = values[0];
    const last = values[values.length - 1];
    const peak = focusThreshold.direction === 'above' ? Math.max(...values) : Math.min(...values);
    report.paragraph(
      trendSentence(
        `${focusThreshold.label} en la mina (valor más crítico)`,
        focusThreshold.unit,
        focusThreshold.decimals,
        first,
        last,
        peak,
        focusThreshold,
        clock(series[0].t),
        clock(series[series.length - 1].t),
      ),
      9.5,
      LEVEL_TEXT_COLORS[1],
    );
    report.chart({
      points: series.map((p) => ({ t: p.t, v: p.slow })),
      thresholds: levelLines(focusThreshold),
      unit: `${focusThreshold.label} · promedio 40 s (${focusThreshold.unit})`,
      decimals: focusThreshold.decimals,
      timeLabel: clock,
    });
  } else {
    report.empty('Sin alertas de gas en este turno: no hay evolución que mostrar.');
  }

  report.heading('Alertas por nivel');
  report.table({
    headers: ['Nivel', 'Total', 'Activas'],
    widths: [0.5, 0.25, 0.25],
    align: ['left', 'right', 'right'],
    rows: ([1, 2, 3] as const).map((level) => [
      levelCell(level),
      String(snapshot.alerts.filter((a) => a.level === level).length),
      String(active.filter((a) => a.level === level).length),
    ]),
  });

  report.heading('Alertas');
  if (snapshot.alerts.length) {
    report.table({
      headers: ['#', 'Hora', 'Estación', 'Gas', 'Nivel', 'Valor', 'Canal', 'Estado'],
      widths: [0.05, 0.1, 0.11, 0.25, 0.13, 0.15, 0.1, 0.11],
      rows: snapshot.alerts.map((a) => [
        String(a.id),
        a.time,
        a.stationId,
        a.kind === 'equipo' ? a.detail : thresholds[a.gas as GasKey].label,
        levelCell(a.level),
        a.kind === 'equipo' ? '-' : `${fmt(a.value, thresholds[a.gas as GasKey].decimals)} ${thresholds[a.gas as GasKey].unit}`,
        a.channel,
        `${a.status}${a.acknowledged ? ' · rec.' : ''}`,
      ]),
    });
  } else {
    report.empty('Sin alertas en este turno.');
  }

  report.heading('Línea de tiempo');
  if (snapshot.timeline.length) {
    report.table({
      headers: ['Hora', 'Evento'],
      widths: [0.14, 0.86],
      rows: snapshot.timeline.map((e) => [{ text: e.time, bold: true }, { text: e.text, color: LEVEL_TEXT_COLORS[e.tone] }]),
    });
  } else {
    report.empty('Sin eventos.');
  }

  return report.save();
}
