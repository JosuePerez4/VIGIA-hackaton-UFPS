import { connection } from 'next/server';
import { isUuid, json, serverError } from '@/lib/api';
import { getPool } from '@/lib/db';

/** Ventana de contexto alrededor de la alerta, en segundos simulados. */
const WINDOW_S = 120;

/** Reporte de incidente: la alerta, lo que midió su estación antes y después, y quién estaba cerca. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; alertNo: string }> }) {
  await connection();
  const { id, alertNo } = await params;
  const no = Number(alertNo);
  if (!isUuid(id) || !Number.isInteger(no) || no < 1) return json({ error: 'parámetros inválidos' }, 400);

  try {
    const pool = getPool();
    const alert = await pool.query(
      `SELECT alert_no, sim_elapsed_s, sim_clock, station_id, gas, level, channel, value, status, acknowledged
       FROM alerts WHERE session_id = $1 AND alert_no = $2`,
      [id, no],
    );
    if (alert.rows.length === 0) return json({ error: 'Alerta no encontrada' }, 404);
    const a = alert.rows[0];
    const from = Math.max(0, a.sim_elapsed_s - WINDOW_S);
    const to = a.sim_elapsed_s + WINDOW_S;

    const [stationContext, workers, timeline, others] = await Promise.all([
      pool.query(
        `SELECT sim_elapsed_s, level, readings, climate FROM station_readings
         WHERE session_id = $1 AND station_id = $2 AND sim_elapsed_s BETWEEN $3 AND $4
         ORDER BY sim_elapsed_s`,
        [id, a.station_id, from, to],
      ),
      pool.query(
        `SELECT sim_elapsed_s, worker_id, level, reading FROM worker_readings
         WHERE session_id = $1 AND station_id = $2 AND sim_elapsed_s BETWEEN $3 AND $4
         ORDER BY sim_elapsed_s, worker_id`,
        [id, a.station_id, from, to],
      ),
      pool.query(
        `SELECT sim_elapsed_s, sim_clock, tone, text FROM timeline_events
         WHERE session_id = $1 AND sim_elapsed_s BETWEEN $2 AND $3 ORDER BY sim_elapsed_s, event_no`,
        [id, from, to],
      ),
      pool.query(
        `SELECT alert_no, sim_clock, station_id, gas, level, status FROM alerts
         WHERE session_id = $1 AND alert_no <> $2 AND sim_elapsed_s BETWEEN $3 AND $4 ORDER BY sim_elapsed_s`,
        [id, no, from, to],
      ),
    ]);

    return json({
      alert: a,
      windowSeconds: WINDOW_S,
      stationContext: stationContext.rows,
      workersNearStation: workers.rows,
      timelineAround: timeline.rows,
      otherAlertsAround: others.rows,
    });
  } catch (error) {
    return serverError(error);
  }
}
