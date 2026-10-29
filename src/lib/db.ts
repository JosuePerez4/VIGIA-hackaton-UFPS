import { Pool } from '@neondatabase/serverless';

let pool: Pool | null = null;

/** Pool compartido de Neon. Lanza si falta DATABASE_URL, para fallar de forma explícita. */
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definida');
  }
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
