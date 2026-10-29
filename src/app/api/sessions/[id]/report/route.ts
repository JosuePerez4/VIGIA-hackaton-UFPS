import { connection } from 'next/server';
import { isUuid, json, serverError } from '@/lib/api';
import { getPool } from '@/lib/db';

/** Reporte del turno o escenario: resumen, alertas por nivel y línea de tiempo completa. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) return json({ error: 'id inválido' }, 400);

  try {
    const pool = getPool();
    const [session, alerts, timeline, peaks] = await Promise.all([
      pool.query('SELECT id, scenario, target, started_at FROM sessions WHERE id = $1', [id]),
      pool.query(
        `SELECT alert_no, sim_elapsed_s, sim_clock, station_id, gas, level, channel, value, status, acknowledged
         FROM alerts WHERE session_id = $1 ORDER BY sim_elapsed_s, alert_no`,
        [id],
      ),
      pool.query(
        `SELECT event_no, sim_elapsed_s, sim_clock, tone, text
         FROM timeline_events WHERE session_id = $1 ORDER BY sim_elapsed_s, event_no`,
        [id],
      ),
      pool.query(
        `SELECT r.station_id,
                max((r.readings -> 'CH4' ->> 'avg')::float) AS ch4_max,
                max((r.readings -> 'CO' ->> 'avg')::float) AS co_max,
                min((r.readings -> 'O2' ->> 'avg')::float) AS o2_min,
                max((r.readings -> 'H2S' ->> 'avg')::float) AS h2s_max,
                max(r.level) AS max_level
         FROM station_readings r WHERE r.session_id = $1 GROUP BY r.station_id ORDER BY r.station_id`,
        [id],
      ),
    ]);

    if (session.rows.length === 0) return json({ error: 'Sesión no encontrada' }, 404);

    const byLevel = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    for (const a of alerts.rows) byLevel[a.level as number] += 1;

    return json({
      session: session.rows[0],
      summary: {
        alerts: alerts.rows.length,
        alertsByLevel: byLevel,
        unacknowledged: alerts.rows.filter((a) => a.status === 'activa' && !a.acknowledged).length,
      },
      peaksByStation: peaks.rows,
      alerts: alerts.rows,
      timeline: timeline.rows,
    });
  } catch (error) {
    return serverError(error);
  }
}
