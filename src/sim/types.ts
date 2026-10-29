import type { GasKey, Level } from '@/config/thresholds';
import type { ScenarioId } from './scenarios';

export interface GasReading {
  raw: number;
  avg: number;
  rate: number;
  level: Level;
  channel: 'rápido' | 'lento' | null;
}

export interface StationSnapshot {
  id: string;
  name: string;
  area: string;
  x: number;
  y: number;
  online: boolean;
  battery: number;
  lastCalibration: string;
  latencyMs: number;
  readings: Record<GasKey, GasReading>;
  level: Level;
  onBattery: boolean;
  climate: {
    tempC: number;
    rh: number;
    wetBulbC: number;
  };
}

export interface WorkerSnapshot {
  id: string;
  name: string;
  role: string;
  mx6: string;
  battery: number;
  linkedStationId: string;
  x: number;
  y: number;
  level: Level;
  reading: Record<GasKey, number>;
  twa: Record<GasKey, number>;
  samples: number;
  failed: boolean;
}

export interface AlertRecord {
  id: number;
  time: string;
  elapsed: number;
  kind: 'gas' | 'equipo';
  detail: string;
  stationId: string;
  gas: GasKey | 'EQUIPO';
  level: Level;
  value: number;
  channel: 'rápido' | 'lento';
  status: 'activa' | 'escalada' | 'resuelta';
  acknowledged: boolean;
}

export interface TimelineEntry {
  id: number;
  time: string;
  elapsed: number;
  text: string;
  tone: Level;
}

export interface SeriesPoint {
  t: number;
  fast: number;
  slow: number;
}

export interface Representative {
  stationId: string;
  raw: number;
  avg: number;
}

export interface MineSnapshot {
  elapsed: number;
  clock: string;
  startSeconds: number;
  scenario: ScenarioId;
  target: string;
  stations: StationSnapshot[];
  workers: WorkerSnapshot[];
  alerts: AlertRecord[];
  timeline: TimelineEntry[];
  series: Record<GasKey, SeriesPoint[]>;
  representative: Record<GasKey, Representative>;
  mineLevel: Level;
  emergency: boolean;
  system: {
    connection: 'Conectado';
    broker: 'Activo';
    queueLength: number;
    processingMs: number;
    offlineStations: number;
  };
}
