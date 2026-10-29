import { connection } from 'next/server';
import { getPool } from '@/lib/db';
import { json } from '@/lib/api';

export async function GET() {
  await connection();
  const startedAt = Date.now();
  let database: 'ok' | 'error' | 'not-configured' = 'not-configured';
  let databaseError: string | undefined;

  if (process.env.DATABASE_URL) {
    try {
      await getPool().query('SELECT 1');
      database = 'ok';
    } catch (error) {
      database = 'error';
      databaseError = error instanceof Error ? error.message : 'error desconocido';
    }
  }

  return json({
    status: 'ok',
    time: new Date().toISOString(),
    database,
    ...(databaseError ? { databaseError } : {}),
    databaseLatencyMs: Date.now() - startedAt,
  });
}
