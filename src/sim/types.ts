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
  area: string;
  x: number;
  y: number;
  online: boolean;
  battery: number;
  lastCalibration: string;
  latencyMs: number;
  readings: Record<GasKey, GasReading>;
  level: Level;
  /**
   * Clima de la estación. La humedad relativa la mide el módulo de humedad del Trolex Sentro 8;
   * la temperatura húmeda no la mide el dispositivo y se calcula a partir de temperatura y HR.
   */
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
  /** Estación a la que el MX6 está enlazado en este momento (la más cercana). */
  linkedStationId: string;
  /** Posición en unidades del mapa (viewBox 390 × 660). */
  x: number;
  y: number;
  /** Nivel del punto donde está el minero. */
  level: Level;
  /** Lecturas actuales del MX6 en su punto. */
  reading: Record<GasKey, number>;
  /** Exposición promedio por gas desde el inicio del turno (tipo TWA). */
  twa: Record<GasKey, number>;
  /** Número de muestras enviadas por el MX6 en el turno. */
  samples: number;
}

export interface AlertRecord {
  id: number;
  time: string;
  stationId: string;
  gas: GasKey;
  level: Level;
  value: number;
  channel: 'rápido' | 'lento';
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
  system: {
    connection: 'Conectado';
    broker: 'Activo';
    queueLength: number;
    processingMs: number;
    offlineStations: number;
  };
}
