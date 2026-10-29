import { getPool } from './db';

const MAX_ROWS = 1000;
const GASES = ['CH4', 'CO', 'O2', 'H2S', 'CO2', 'NO2', 'TEMP', 'AIR'];
const STATION = /^EST-\d{2}$/;
const WORKER = /^MIN-\d{2}$/;

export interface AlertRow {
  alertNo: number;
  simElapsedS: number;
  simClock: string;
  stationId: string;
  gas: string;
  level: number;
  channel: 'rápido' | 'lento';
  value: number;
  status: 'activa' | 'escalada' | 'resuelta';
  acknowledged: boolean;
}

export interface TimelineRow {
  eventNo: number;
  simElapsedS: number;
  simClock: string;
  tone: number;
  text: string;
}

export interface StationRow {
  simElapsedS: number;
  stationId: string;
  level: number;
  readings: Record<string, unknown>;
  climate: Record<string, unknown>;
}

export interface WorkerRow {
  simElapsedS: number;
  workerId: string;
  stationId: string;
  level: number;
  reading: Record<string, unknown>;
}

export interface IngestBatch {
  sessionId: string;
  alerts: AlertRow[];
  timeline: TimelineRow[];
  stations: StationRow[];
  workers: WorkerRow[];
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Valida un lote y devuelve el error del primer registro inválido, o null si todo está bien. */
export function validateBatch(body: unknown): string | null {
  if (!isObj(body)) return 'El cuerpo debe ser un objeto JSON';
  if (!isStr(body.sessionId, 36)) return 'sessionId es obligatorio';

  const arrays = ['alerts', 'timeline', 'stations', 'workers'] as const;
  for (const key of arrays) {
    const list = body[key] ?? [];
    if (!Array.isArray(list)) return `${key} debe ser una lista`;
    if (list.length > MAX_ROWS) return `${key} supera ${MAX_ROWS} registros por lote`;
  }

  for (const a of (body.alerts ?? []) as unknown[]) {
    if (!isObj(a) || !isInt(a.alertNo, 1, 2 ** 31 - 1) || !isInt(a.simElapsedS, 0, 1e9)) return 'alerta inválida';
    if (!isStr(a.simClock, 8) || !isStr(a.stationId, 16) || !STATION.test(a.stationId as string)) return 'alerta: estación inválida';
    if (!GASES.includes(a.gas as string) || !isInt(a.level, 1, 3) || !isNum(a.value)) return 'alerta: gas, nivel o valor inválido';
    if (!['rápido', 'lento'].includes(a.channel as string) || !['activa', 'escalada', 'resuelta'].includes(a.status as string)) return 'alerta: canal o estado inválido';
    if (typeof a.acknowledged !== 'boolean') return 'alerta: acknowledged debe ser booleano';
  }
  for (const t of (body.timeline ?? []) as unknown[]) {
    if (!isObj(t) || !isInt(t.eventNo, 1, 2 ** 31 - 1) || !isInt(t.simElapsedS, 0, 1e9)) return 'evento inválido';
    if (!isStr(t.simClock, 8) || !isInt(t.tone, 0, 3) || !isStr(t.text, 500)) return 'evento: texto o tono inválido';
  }
  for (const s of (body.stations ?? []) as unknown[]) {
    if (!isObj(s) || !isInt(s.simElapsedS, 0, 1e9) || !isStr(s.stationId, 16) || !STATION.test(s.stationId as string)) return 'lectura de estación inválida';
    if (!isInt(s.level, 0, 3) || !isObj(s.readings) || !isObj(s.climate)) return 'lectura de estación: nivel o datos inválidos';
  }
  for (const w of (body.workers ?? []) as unknown[]) {
    if (!isObj(w) || !isInt(w.simElapsedS, 0, 1e9) || !isStr(w.workerId, 16) || !WORKER.test(w.workerId as string)) return 'lectura de MX6 inválida';
    if (!isStr(w.stationId, 16) || !isInt(w.level, 0, 3) || !isObj(w.reading)) return 'lectura de MX6: datos inválidos';
  }
  return null;
}

/**
 * Escribe un lote en una transacción. Cada tabla usa una sola sentencia con jsonb_to_recordset;
 * las alertas se actualizan (upsert) porque cambian de estado y de valor a lo largo de su vida.
 */
export async function writeBatch(batch: IngestBatch) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    if (batch.alerts.length) {
      await client.query(
        `INSERT INTO alerts (session_id, alert_no, sim_elapsed_s, sim_clock, station_id, gas, level, channel, value, status, acknowledged, updated_at)
         SELECT $1::uuid, x.alert_no, x.sim_elapsed_s, x.sim_clock, x.station_id, x.gas, x.level, x.channel, x.value, x.status, x.acknowledged, now()
         FROM jsonb_to_recordset($2::jsonb) AS x(alert_no int, sim_elapsed_s int, sim_clock text, station_id text, gas text, level smallint, channel text, value double precision, status text, acknowledged boolean)
         ON CONFLICT (session_id, alert_no) DO UPDATE SET
           status = EXCLUDED.status, value = EXCLUDED.value, level = EXCLUDED.level,
           channel = EXCLUDED.channel, acknowledged = EXCLUDED.acknowledged, updated_at = now()`,
        [batch.sessionId, JSON.stringify(batch.alerts.map((a) => ({
          alert_no: a.alertNo, sim_elapsed_s: a.simElapsedS, sim_clock: a.simClock, station_id: a.stationId,
          gas: a.gas, level: a.level, channel: a.channel, value: a.value, status: a.status, acknowledged: a.acknowledged,
        })))],
      );
    }

    if (batch.timeline.length) {
      await client.query(
        `INSERT INTO timeline_events (session_id, event_no, sim_elapsed_s, sim_clock, tone, text)
         SELECT $1::uuid, x.event_no, x.sim_elapsed_s, x.sim_clock, x.tone, x.text
         FROM jsonb_to_recordset($2::jsonb) AS x(event_no int, sim_elapsed_s int, sim_clock text, tone smallint, text text)
         ON CONFLICT (session_id, event_no) DO NOTHING`,
        [batch.sessionId, JSON.stringify(batch.timeline.map((t) => ({
          event_no: t.eventNo, sim_elapsed_s: t.simElapsedS, sim_clock: t.simClock, tone: t.tone, text: t.text,
        })))],
      );
    }

    if (batch.stations.length) {
      await client.query(
        `INSERT INTO station_readings (session_id, sim_elapsed_s, station_id, level, readings, climate)
         SELECT $1::uuid, x.sim_elapsed_s, x.station_id, x.level, x.readings, x.climate
         FROM jsonb_to_recordset($2::jsonb) AS x(sim_elapsed_s int, station_id text, level smallint, readings jsonb, climate jsonb)
         ON CONFLICT (session_id, sim_elapsed_s, station_id) DO NOTHING`,
        [batch.sessionId, JSON.stringify(batch.stations.map((s) => ({
          sim_elapsed_s: s.simElapsedS, station_id: s.stationId, level: s.level, readings: s.readings, climate: s.climate,
        })))],
      );
    }

    if (batch.workers.length) {
      await client.query(
        `INSERT INTO worker_readings (session_id, sim_elapsed_s, worker_id, station_id, level, reading)
         SELECT $1::uuid, x.sim_elapsed_s, x.worker_id, x.station_id, x.level, x.reading
         FROM jsonb_to_recordset($2::jsonb) AS x(sim_elapsed_s int, worker_id text, station_id text, level smallint, reading jsonb)
         ON CONFLICT (session_id, sim_elapsed_s, worker_id) DO NOTHING`,
        [batch.sessionId, JSON.stringify(batch.workers.map((w) => ({
          sim_elapsed_s: w.simElapsedS, worker_id: w.workerId, station_id: w.stationId, level: w.level, reading: w.reading,
        })))],
      );
    }

    await client.query('COMMIT');
    return {
      alerts: batch.alerts.length,
      timeline: batch.timeline.length,
      stations: batch.stations.length,
      workers: batch.workers.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
