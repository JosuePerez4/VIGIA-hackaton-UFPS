import { connection, type NextRequest } from 'next/server';
import { getPool } from '@/lib/db';
import { isWriteAuthorized, json, serverError, unauthorized } from '@/lib/api';

const SCENARIOS = [
  'normal',
  'fuga-metano',
  'alerta-en-trabajo',
  'aumento-co',
  'falla-ventilacion',
  'minero-critico',
  'caida-oxigeno',
];

/** Crea una sesión: un escenario lanzado o una mina reiniciada. */
export async function POST(request: NextRequest) {
  if (!isWriteAuthorized(request)) return unauthorized();
  try {
    const body = (await request.json().catch(() => null)) as { scenario?: unknown; target?: unknown } | null;
    if (!body || typeof body.scenario !== 'string' || !SCENARIOS.includes(body.scenario)) {
      return json({ error: 'scenario inválido' }, 400);
    }
    const target = typeof body.target === 'string' && /^EST-\d{2}$/.test(body.target) ? body.target : 'EST-08';
    const { rows } = await getPool().query<{ id: string }>(
      'INSERT INTO sessions (scenario, target) VALUES ($1, $2) RETURNING id',
      [body.scenario, target],
    );
    return json({ id: rows[0].id }, 201);
  } catch (error) {
    return serverError(error);
  }
}

/** Últimas sesiones con conteo de alertas, para elegir cuál reportar. */
export async function GET() {
  await connection();
  try {
    const { rows } = await getPool().query(
      `SELECT s.id, s.scenario, s.target, s.started_at,
              (SELECT count(*)::int FROM alerts a WHERE a.session_id = s.id) AS alert_count
       FROM sessions s
       ORDER BY s.started_at DESC
       LIMIT 50`,
    );
    return json({ sessions: rows });
  } catch (error) {
    return serverError(error);
  }
}
