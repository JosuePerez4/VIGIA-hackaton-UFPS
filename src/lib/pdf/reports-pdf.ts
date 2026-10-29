import { rgb, type RGB } from 'pdf-lib';
import { GAS_ORDER, LEVEL_META, type GasKey, type GasThreshold, type Level } from '@/config/thresholds';
import { clockToElapsed } from '@/lib/recorder';
import { NODE_BY_ID } from '@/sim/mine';
import type { AlertRecord, MineSnapshot } from '@/sim/types';
import { LEVEL_TEXT_COLORS, PdfReport } from './layout';

type Thresholds = Record<GasKey, GasThreshold>;

/** Segundos antes y después de la alerta que incluye el reporte de incidente. */
const CONTEXT_S = 120;

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

function inWindow(time: string, from: number, to: number) {
  const t = clockToElapsed(time);
  return t >= from && t <= to;
}

/** Reporte de incidente: la alerta, lo que medía su estación, quién estaba cerca y lo que pasó alrededor. */
export async function incidentPdf(snapshot: MineSnapshot, alert: AlertRecord, thresholds: Thresholds): Promise<Uint8Array> {
  const threshold = thresholds[alert.gas];
  const station = snapshot.stations.find((s) => s.id === alert.stationId);
  const alertAt = clockToElapsed(alert.time);
  const from = alertAt - CONTEXT_S;
  const to = alertAt + CONTEXT_S;
  const timeline = snapshot.timeline.filter((e) => inWindow(e.time, from, to));
  const others = snapshot.alerts.filter((a) => a.id !== alert.id && inWindow(a.time, from, to));
  const workers = snapshot.workers.filter((w) => w.linkedStationId === alert.stationId);

  const report = await PdfReport.create(`VIGIA · Reporte de incidente #${alert.id} · Fuente: simulación · ${stamp()}`);
  report.cover(
    `Reporte de incidente #${alert.id}`,
    `${LEVEL_META[alert.level].label} · ${alert.stationId} · ${threshold.label} · ${alert.time}`,
    LEVEL_FILL[alert.level],
  );

  report.kpis([
    { label: 'Nivel', value: LEVEL_META[alert.level].mineLabel, color: LEVEL_TEXT_COLORS[alert.level] },
    { label: 'Valor al disparar', value: `${fmt(alert.value, threshold.decimals)} ${threshold.unit}` },
    { label: 'Estación', value: alert.stationId },
    { label: 'Hora simulada', value: alert.time },
  ]);

  report.heading('Alerta');
  report.keyValues([
    ['Gas', threshold.label],
    ['Área', stationArea(alert.stationId)],
    ['Canal que disparó', alert.channel === 'rápido' ? 'Canal rápido' : 'Canal lento (oficial)'],
    ['Estado', `${alert.status}${alert.acknowledged ? ' · reconocida' : ' · sin reconocer'}`],
    ['Estado general de la mina', LEVEL_META[snapshot.mineLevel].label],
  ]);

  report.heading('Lecturas de la estación al generar el reporte');
  if (station) {
    report.table({
      headers: ['Gas', 'Último valor', 'Promedio 40 s', 'Nivel'],
      widths: [0.4, 0.2, 0.2, 0.2],
      align: ['left', 'right', 'right', 'left'],
      rows: GAS_ORDER.map((gas) => {
        const r = station.readings[gas];
        const t = thresholds[gas];
        return [
          t.label,
          `${fmt(r.raw, t.decimals)} ${t.unit}`,
          `${fmt(r.avg, t.decimals)} ${t.unit}`,
          levelCell(r.level),
        ];
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
      rows: others.map((a) => [a.time, a.stationId, thresholds[a.gas].label, levelCell(a.level), a.status]),
    });
  } else {
    report.empty('Ninguna.');
  }

  return report.save();
}

/** Reporte del turno: totales por nivel, alertas sin reconocer y la línea de tiempo completa. */
export async function turnPdf(snapshot: MineSnapshot, thresholds: Thresholds): Promise<Uint8Array> {
  const active = snapshot.alerts.filter((a) => a.status === 'activa');
  const unacknowledged = active.filter((a) => !a.acknowledged).length;
  const mineLevel = snapshot.mineLevel;

  const report = await PdfReport.create(`VIGIA · Reporte del turno · Fuente: simulación · ${stamp()}`);
  report.cover(
    'Reporte del turno',
    `${snapshot.scenario} · objetivo ${snapshot.target} · T+${snapshot.clock}`,
    LEVEL_FILL[mineLevel],
  );

  report.kpis([
    { label: 'Estado general', value: LEVEL_META[mineLevel].mineLabel, color: LEVEL_TEXT_COLORS[mineLevel] },
    { label: 'Alertas en total', value: String(snapshot.alerts.length) },
    { label: 'Activas', value: String(active.length) },
    { label: 'Sin reconocer', value: String(unacknowledged), color: unacknowledged ? LEVEL_TEXT_COLORS[2] : undefined },
  ]);

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
      align: ['left', 'left', 'left', 'left', 'left', 'right', 'left', 'left'],
      rows: snapshot.alerts.map((a) => [
        String(a.id),
        a.time,
        a.stationId,
        thresholds[a.gas].label,
        levelCell(a.level),
        `${fmt(a.value, thresholds[a.gas].decimals)} ${thresholds[a.gas].unit}`,
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

