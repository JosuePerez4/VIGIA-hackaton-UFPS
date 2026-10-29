import { LEVEL_META, gasThreshold, type GasKey, type GasThreshold } from '@/config/thresholds';
import { incidentPdf, turnPdf } from '@/lib/pdf/reports-pdf';
import type { AlertRecord, MineSnapshot } from '@/sim/types';

type Thresholds = Record<GasKey, GasThreshold>;

const csvCell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;

/** Alertas en CSV, para análisis en hojas de cálculo. */
export function alertsCsv(snapshot: MineSnapshot, thresholds: Thresholds): string {
  const header = ['id', 'hora', 'estacion', 'gas', 'nivel', 'valor', 'unidad', 'canal', 'estado', 'reconocida'];
  const rows = snapshot.alerts.map((a) => {
    const t = gasThreshold(a.gas, thresholds);
    return [a.id, a.time, a.stationId, t.label, LEVEL_META[a.level].mineLabel, a.value.toFixed(t.decimals), t.unit, a.channel, a.status, a.acknowledged ? 'sí' : 'no']
      .map(csvCell)
      .join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

/** Descarga un archivo generado en el navegador. */
export function downloadFile(name: string, mime: string, content: string | Uint8Array) {
  const blob = new Blob([content as BlobPart], { type: mime });
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

export async function downloadIncidentReport(snapshot: MineSnapshot, alert: AlertRecord, thresholds: Thresholds) {
  const pdf = await incidentPdf(snapshot, alert, thresholds);
  downloadFile(`vigia-incidente-${alert.id}-${fileStamp(snapshot)}.pdf`, 'application/pdf', pdf);
}

export async function downloadTurnReport(snapshot: MineSnapshot, thresholds: Thresholds) {
  const pdf = await turnPdf(snapshot, thresholds);
  downloadFile(`vigia-turno-${fileStamp(snapshot)}.pdf`, 'application/pdf', pdf);
}

export function downloadAlertsCsv(snapshot: MineSnapshot, thresholds: Thresholds) {
  downloadFile(`vigia-alertas-${fileStamp(snapshot)}.csv`, 'text/csv', alertsCsv(snapshot, thresholds));
}
