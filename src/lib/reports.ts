import { GAS_ORDER, LEVEL_META, type GasKey, type GasThreshold } from '@/config/thresholds';
import { clockToElapsed } from '@/lib/recorder';
import { NODE_BY_ID } from '@/sim/mine';
import type { AlertRecord, MineSnapshot } from '@/sim/types';

/** Contexto en segundos antes y después de la alerta que incluye el reporte de incidente. */
const CONTEXT_S = 120;

type Thresholds = Record<GasKey, GasThreshold>;

const escapeHtml = (value: unknown) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stamp = () =>
  new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'America/Bogota' });

const fmt = (value: number, decimals: number) => value.toFixed(decimals);

const scenarioLabel = (snapshot: MineSnapshot) => `${snapshot.scenario} · objetivo ${snapshot.target} · T+${snapshot.clock}`;

const STYLE = `
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 32px; font-size: 14px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #555; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  th { font-weight: 600; color: #333; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .badge { display: inline-block; padding: 2px 8px; border: 1px solid #111; border-radius: 3px; font-weight: 600; }
  @media print { body { margin: 16px; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
`;

function page(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body>${body}</body>
</html>`;
}

/** Reporte de incidente: qué alerta fue, qué medía su estación, quién estaba cerca y qué pasó alrededor. */
export function incidentReportHtml(snapshot: MineSnapshot, alert: AlertRecord, thresholds: Thresholds): string {
  const threshold = thresholds[alert.gas];
  const station = snapshot.stations.find((s) => s.id === alert.stationId);
  const alertAt = clockToElapsed(alert.time);
  const from = alertAt - CONTEXT_S;
  const to = alertAt + CONTEXT_S;
  const inWindow = (time: string) => {
    const t = clockToElapsed(time);
    return t >= from && t <= to;
  };
  const timeline = snapshot.timeline.filter((e) => inWindow(e.time));
  const others = snapshot.alerts.filter((a) => a.id !== alert.id && inWindow(a.time));
  const workers = snapshot.workers.filter((w) => w.linkedStationId === alert.stationId);
  const levelText = LEVEL_META[alert.level].label;

  const gasRows = station
    ? GAS_ORDER.map((gas) => {
        const r = station.readings[gas];
        const t = thresholds[gas];
        return `<tr><td>${escapeHtml(t.label)}</td><td class="num">${fmt(r.raw, t.decimals)} ${escapeHtml(t.unit)}</td><td class="num">${fmt(r.avg, t.decimals)} ${escapeHtml(t.unit)}</td><td>${escapeHtml(LEVEL_META[r.level].mineLabel)}</td></tr>`;
      }).join('')
    : '';

  const body = `
    <h1>Reporte de incidente · alerta #${alert.id}</h1>
    <p class="meta">Generado ${escapeHtml(stamp())} · ${escapeHtml(scenarioLabel(snapshot))}</p>

    <h2>Alerta</h2>
    <table>
      <tr><th>Nivel</th><td><span class="badge">${escapeHtml(levelText)}</span></td></tr>
      <tr><th>Hora simulada</th><td>${escapeHtml(alert.time)}</td></tr>
      <tr><th>Estación</th><td>${escapeHtml(alert.stationId)} · ${escapeHtml(NODE_BY_ID[alert.stationId]?.name.split(' · ')[1] ?? '')}</td></tr>
      <tr><th>Gas</th><td>${escapeHtml(threshold.label)}</td></tr>
      <tr><th>Valor al disparar</th><td>${fmt(alert.value, threshold.decimals)} ${escapeHtml(threshold.unit)}</td></tr>
      <tr><th>Canal</th><td>${escapeHtml(alert.channel === 'rápido' ? 'Canal rápido' : 'Canal lento (oficial)')}</td></tr>
      <tr><th>Estado</th><td>${escapeHtml(alert.status)}${alert.acknowledged ? ' · reconocida' : ' · sin reconocer'}</td></tr>
    </table>

    <h2>Lecturas de la estación al generar el reporte</h2>
    ${station
      ? `<table>
          <tr><th>Gas</th><th class="num">Último valor</th><th class="num">Promedio 40 s</th><th>Nivel</th></tr>
          ${gasRows}
        </table>
        <table>
          <tr><th>Temperatura</th><td class="num">${fmt(station.climate.tempC, 1)} °C</td></tr>
          <tr><th>Humedad relativa (medida)</th><td class="num">${fmt(station.climate.rh, 0)} %</td></tr>
          <tr><th>Temperatura húmeda (calculada)</th><td class="num">${fmt(station.climate.wetBulbC, 1)} °C</td></tr>
        </table>`
      : '<p>Estación no encontrada en el estado actual.</p>'}

    <h2>Mineros enlazados a la estación</h2>
    ${workers.length
      ? `<table>
          <tr><th>Minero</th><th>MX6</th><th class="num">CH₄</th><th class="num">CO</th><th class="num">H₂S</th><th class="num">O₂</th><th>Nivel del punto</th></tr>
          ${workers
            .map(
              (w) => `<tr><td>${escapeHtml(w.name)}</td><td>${escapeHtml(w.mx6)}</td>
                <td class="num">${fmt(w.reading.CH4, thresholds.CH4.decimals)}</td>
                <td class="num">${fmt(w.reading.CO, thresholds.CO.decimals)}</td>
                <td class="num">${fmt(w.reading.H2S, thresholds.H2S.decimals)}</td>
                <td class="num">${fmt(w.reading.O2, thresholds.O2.decimals)}</td>
                <td>${escapeHtml(LEVEL_META[w.level].mineLabel)}</td></tr>`,
            )
            .join('')}
        </table>`
      : '<p>Ningún minero está enlazado a esta estación en este momento.</p>'}

    <h2>Eventos en los ${CONTEXT_S} s alrededor de la alerta</h2>
    ${timeline.length
      ? `<table><tr><th>Hora</th><th>Evento</th></tr>${timeline
          .map((e) => `<tr><td>${escapeHtml(e.time)}</td><td>${escapeHtml(e.text)}</td></tr>`)
          .join('')}</table>`
      : '<p>Sin eventos registrados en ese intervalo.</p>'}

    <h2>Otras alertas en el mismo intervalo</h2>
    ${others.length
      ? `<table><tr><th>Hora</th><th>Estación</th><th>Gas</th><th>Nivel</th><th>Estado</th></tr>${others
          .map(
            (a) =>
              `<tr><td>${escapeHtml(a.time)}</td><td>${escapeHtml(a.stationId)}</td><td>${escapeHtml(thresholds[a.gas].label)}</td><td>${escapeHtml(LEVEL_META[a.level].mineLabel)}</td><td>${escapeHtml(a.status)}</td></tr>`,
          )
          .join('')}</table>`
      : '<p>Ninguna.</p>'}
  `;
  return page(`Incidente #${alert.id} · VIGIA`, body);
}

/** Reporte del turno: totales por nivel, alertas sin reconocer y la línea de tiempo completa. */
export function turnReportHtml(snapshot: MineSnapshot, thresholds: Thresholds): string {
  const active = snapshot.alerts.filter((a) => a.status === 'activa');
  const byLevel = [1, 2, 3].map((level) => ({
    level,
    total: snapshot.alerts.filter((a) => a.level === level).length,
    active: active.filter((a) => a.level === level).length,
  }));
  const unacknowledged = active.filter((a) => !a.acknowledged).length;

  const body = `
    <h1>Reporte del turno</h1>
    <p class="meta">Generado ${escapeHtml(stamp())} · ${escapeHtml(scenarioLabel(snapshot))}</p>

    <h2>Resumen</h2>
    <table>
      <tr><th>Estado general</th><td><span class="badge">${escapeHtml(LEVEL_META[snapshot.mineLevel].label)}</span></td></tr>
      <tr><th>Alertas en total</th><td>${snapshot.alerts.length}</td></tr>
      <tr><th>Alertas activas sin reconocer</th><td>${unacknowledged}</td></tr>
      <tr><th>Mineros con MX6 en recorrido</th><td>${snapshot.workers.length}</td></tr>
    </table>

    <h2>Alertas por nivel</h2>
    <table>
      <tr><th>Nivel</th><th class="num">Total</th><th class="num">Activas</th></tr>
      ${byLevel
        .map((r) => `<tr><td>${escapeHtml(LEVEL_META[r.level as 1 | 2 | 3].label)}</td><td class="num">${r.total}</td><td class="num">${r.active}</td></tr>`)
        .join('')}
    </table>

    <h2>Alertas</h2>
    ${snapshot.alerts.length
      ? `<table>
          <tr><th>#</th><th>Hora</th><th>Estación</th><th>Gas</th><th>Nivel</th><th class="num">Valor</th><th>Canal</th><th>Estado</th></tr>
          ${snapshot.alerts
            .map(
              (a) => `<tr><td>${a.id}</td><td>${escapeHtml(a.time)}</td><td>${escapeHtml(a.stationId)}</td><td>${escapeHtml(thresholds[a.gas].label)}</td><td>${escapeHtml(LEVEL_META[a.level].mineLabel)}</td><td class="num">${fmt(a.value, thresholds[a.gas].decimals)} ${escapeHtml(thresholds[a.gas].unit)}</td><td>${escapeHtml(a.channel)}</td><td>${escapeHtml(a.status)}${a.acknowledged ? ' · reconocida' : ''}</td></tr>`,
            )
            .join('')}
        </table>`
      : '<p>Sin alertas en este turno.</p>'}

    <h2>Línea de tiempo</h2>
    ${snapshot.timeline.length
      ? `<table><tr><th>Hora</th><th>Evento</th></tr>${snapshot.timeline
          .map((e) => `<tr><td>${escapeHtml(e.time)}</td><td>${escapeHtml(e.text)}</td></tr>`)
          .join('')}</table>`
      : '<p>Sin eventos.</p>'}
  `;
  return page('Reporte del turno · VIGIA', body);
}

const csvCell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;

/** Alertas en CSV, para análisis en hojas de cálculo. */
export function alertsCsv(snapshot: MineSnapshot, thresholds: Thresholds): string {
  const header = ['id', 'hora', 'estacion', 'gas', 'nivel', 'valor', 'unidad', 'canal', 'estado', 'reconocida'];
  const rows = snapshot.alerts.map((a) => {
    const t = thresholds[a.gas];
    return [a.id, a.time, a.stationId, t.label, LEVEL_META[a.level].mineLabel, a.value.toFixed(t.decimals), t.unit, a.channel, a.status, a.acknowledged ? 'sí' : 'no']
      .map(csvCell)
      .join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

/** Descarga un archivo generado en el navegador. */
export function downloadFile(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const fileStamp = (snapshot: MineSnapshot) => snapshot.clock.replace(/:/g, '-');

export function downloadIncidentReport(snapshot: MineSnapshot, alert: AlertRecord, thresholds: Thresholds) {
  downloadFile(`vigia-incidente-${alert.id}-${fileStamp(snapshot)}.html`, 'text/html', incidentReportHtml(snapshot, alert, thresholds));
}

export function downloadTurnReport(snapshot: MineSnapshot, thresholds: Thresholds) {
  downloadFile(`vigia-turno-${fileStamp(snapshot)}.html`, 'text/html', turnReportHtml(snapshot, thresholds));
}

export function downloadAlertsCsv(snapshot: MineSnapshot, thresholds: Thresholds) {
  downloadFile(`vigia-alertas-${fileStamp(snapshot)}.csv`, 'text/csv', alertsCsv(snapshot, thresholds));
}
