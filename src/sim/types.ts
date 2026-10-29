import type { GasKey, Level } from '@/config/thresholds';
import type { ScenarioId } from './scenarios';

export interface GasReading {
  /** Último valor crudo (canal rápido). */
  raw: number;
  /** Promedio móvil de 40 s (canal lento, registro oficial). */
  avg: number;
  /** Tasa de cambio en unidad/s sobre 2 s (dC/dt). */
  rate: number;
  level: Level;
  /** Canal que disparó el nivel actual, si hay alerta. */
  channel: 'rápido' | 'lento' | null;
}

export interface StationSnapshot {
  id: string;
  name: string;
  gallery: string;
  x: number;
  z: number;
  online: boolean;
  battery: number;
  lastCalibration: string;
  latencyMs: number;
  readings: Record<GasKey, GasReading>;
  level: Level;
}

export interface WorkerSnapshot {
  id: string;
  name: string;
  role: string;
  mx6: string;
  battery: number;
  stationId: string;
  x: number;
  z: number;
  level: Level;
  /** Exposición promedio por gas desde el inicio del turno (tipo TWA, unidad del gas). */
  twa: Record<GasKey, number>;
  evacuating: boolean;
  exited: boolean;
  /** Ruta de evacuación hasta la entrada (ids de nodo). */
  route: string[];
}

export interface AlertRecord {
  id: number;
  time: string;
  stationId: string;
  gas: GasKey;
  level: Level;
  value: number;
  channel: 'rápido' | 'lento';
  action: string;
  status: 'activa' | 'escalada' | 'resuelta';
  acknowledged: boolean;
}

export interface TimelineEntry {
  id: number;
  time: string;
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
  latched: { powerCut: boolean; fansMax: boolean; evacuation: boolean };
  system: {
    connection: 'Conectado';
    broker: 'Activo';
    queueLength: number;
    processingMs: number;
    offlineStations: number;
  };
}
