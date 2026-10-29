-- VIGIA · esquema de registro de simulaciones (Neon Postgres).
-- Idempotente: se puede ejecutar varias veces sin borrar datos.

-- Cada vez que se lanza un escenario (o se reinicia la mina) se crea una sesión.
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario text NOT NULL,
  target text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now()
);

-- Estado de cada alerta. Se actualiza (upsert) cuando cambia de estado, valor o reconocimiento.
CREATE TABLE IF NOT EXISTS alerts (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  alert_no integer NOT NULL,
  sim_elapsed_s integer NOT NULL,
  sim_clock text NOT NULL,
  station_id text NOT NULL,
  gas text NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
  channel text NOT NULL CHECK (channel IN ('rápido', 'lento')),
  value double precision NOT NULL,
  status text NOT NULL CHECK (status IN ('activa', 'escalada', 'resuelta')),
  acknowledged boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, alert_no)
);

-- Línea de tiempo: eventos del motor y etapas del escenario.
CREATE TABLE IF NOT EXISTS timeline_events (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_no integer NOT NULL,
  sim_elapsed_s integer NOT NULL,
  sim_clock text NOT NULL,
  tone smallint NOT NULL CHECK (tone BETWEEN 0 AND 3),
  text text NOT NULL,
  PRIMARY KEY (session_id, event_no)
);

-- Lecturas de cada estación, muestreadas cada 30 s simulados.
CREATE TABLE IF NOT EXISTS station_readings (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sim_elapsed_s integer NOT NULL,
  station_id text NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 3),
  readings jsonb NOT NULL,
  climate jsonb NOT NULL,
  PRIMARY KEY (session_id, sim_elapsed_s, station_id)
);

-- Lecturas de cada MX6, muestreadas cada 30 s simulados.
CREATE TABLE IF NOT EXISTS worker_readings (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sim_elapsed_s integer NOT NULL,
  worker_id text NOT NULL,
  station_id text NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 3),
  reading jsonb NOT NULL,
  PRIMARY KEY (session_id, sim_elapsed_s, worker_id)
);

CREATE INDEX IF NOT EXISTS alerts_by_session_time ON alerts (session_id, sim_elapsed_s);
CREATE INDEX IF NOT EXISTS timeline_by_session_time ON timeline_events (session_id, sim_elapsed_s);
CREATE INDEX IF NOT EXISTS station_readings_by_station ON station_readings (session_id, station_id, sim_elapsed_s);
CREATE INDEX IF NOT EXISTS worker_readings_by_station ON worker_readings (session_id, station_id, sim_elapsed_s);
