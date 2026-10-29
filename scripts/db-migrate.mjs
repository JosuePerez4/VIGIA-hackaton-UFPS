// Aplica db/schema.sql a la base indicada por DATABASE_URL.
// Uso: node --env-file=.env.local scripts/db-migrate.mjs
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no está definida. Revisa .env.local.');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  await pool.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  console.log('Esquema aplicado.');
} finally {
  await pool.end();
}
