import { DEFAULT_THRESHOLDS, GAS_ORDER, levelFor, type GasKey, type GasThreshold, type Level } from '@/config/thresholds';
import { ADJACENCY, ENTRY_ID, LAST_CALIBRATION, NODE_BY_ID, STATION_BATTERY_START, STATION_IDS, WORKER_SEEDS, hopDistances } from './mine';
import { SCENARIO_BY_ID, gasEffect, type ScenarioId } from './scenarios';
import { wetBulbFromTempRh } from './climate';
import type {
  AlertRecord,
  GasReading,
  MineSnapshot,
  Representative,
  SeriesPoint,
  StationSnapshot,
  TimelineEntry,
  WorkerSnapshot,
} from './types';

/** Línea base por gas (unidades del gas). */
const BASELINE: Record<GasKey, number> = {
  CH4: 0.25,
  CO: 6,
  O2: 20.8,
  H2S: 0.6,
  CO2: 0.35,
  NO2: 0.4,
  TEMP: 24,
  AIR: 1.1,
};

/** Cuánto varía la línea base entre estaciones (O₂ y temperatura casi no varían). */
const VARIATION: Record<GasKey, number> = {
  CH4: 1,
  CO: 1,
  O2: 0.1,
  H2S: 1,
  CO2: 1,
  NO2: 1,
  TEMP: 0.3,
  AIR: 0.5,
};

const stationBase = (gas: GasKey, factor: number) => BASELINE[gas] * (1 + (factor - 1) * VARIATION[gas]);

/** Ruido de medición por gas. */
const NOISE: Record<GasKey, number> = {
  CH4: 0.01,
  CO: 0.5,
  O2: 0.04,
  H2S: 0.08,
  CO2: 0.01,
  NO2: 0.03,
  TEMP: 0.12,
  AIR: 0.04,
};

/** Canal lento: promedio móvil de 40 s (dentro del rango de 30 a 45 s). */
const SLOW_WINDOW = 40;
/** Canal rápido: la tasa de cambio dC/dt se calcula sobre 2 s. */
const FAST_LAG = 2;
const SERIES_LENGTH = 300;
const TIMELINE_LENGTH = 200;
const ALERT_LENGTH = 300;
const START_SECONDS = 6 * 3600; // turno inicia a las 06:00
/** Segundos que tarda un minero en recorrer un tramo de galería. */
const WALK_SECONDS = 10;

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  /** mulberry32: determinista; mismo escenario = misma secuencia (demo repetible). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const gasRecord = <T,>(fn: (gas: GasKey) => T): Record<GasKey, T> =>
  Object.fromEntries(GAS_ORDER.map((gas) => [gas, fn(gas)])) as Record<GasKey, T>;

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

export function clockFromElapsed(elapsed: number): string {
  const total = START_SECONDS + Math.floor(elapsed);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

interface StationRuntime {
  id: string;
  name: string;
  area: string;
  x: number;
  y: number;
  factor: number;
  /** Humedad relativa (%) medida por el módulo de humedad de la estación. */
  rh: number;
  battery: number;
  latencyMs: number;
  lastCalibration: string;
  samples: Record<GasKey, number[]>;
  raw: Record<GasKey, number>;
  avg: Record<GasKey, number>;
  rate: Record<GasKey, number>;
  gasLevel: Record<GasKey, Level>;
  gasChannel: Record<GasKey, 'rápido' | 'lento' | null>;
  level: Level;
}

/** Minero que camina por las galerías con su MX6. */
interface WorkerRuntime {
  id: string;
  name: string;
  role: string;
  mx6: string;
  battery: number;
  from: string;
  to: string;
  prev: string | null;
  progress: number;
  samples: number;
  exposure: Record<GasKey, number>;
}

export class SimEngine {
  private seed: number;
  private rng!: Rng;
  private elapsed = 0;
  private scenario: ScenarioId = 'normal';
  private target = 'EST-08';
  private thresholds: Record<GasKey, GasThreshold> = DEFAULT_THRESHOLDS;
  private stations: StationRuntime[] = [];
  private stationById: Record<string, StationRuntime> = {};
  private workers: WorkerRuntime[] = [];
  private alerts: AlertRecord[] = [];
  private activeByKey = new Map<string, AlertRecord>();
  private timeline: TimelineEntry[] = [];
  private firedSteps = new Set<number>();
  private series: Record<GasKey, SeriesPoint[]> = gasRecord(() => []);
  private representative = {} as Record<GasKey, Representative>;
  private hopsTarget: Record<string, number> = {};
  private hopsEntry: Record<string, number> = {};
  private alertId = 0;
  private timelineId = 0;
  private queue = 0;
  private processingMs = 60;

  constructor(seed = 20261029) {
    this.seed = seed;
    this.reset('normal', this.target);
  }

  /** Reinicia la mina con un escenario. */
  reset(scenario: ScenarioId, target: string) {
    this.rng = new Rng(this.seed);
    this.elapsed = 0;
    this.scenario = scenario;
    this.target = target;
    this.hopsTarget = hopDistances(target);
    this.hopsEntry = hopDistances(ENTRY_ID);

    this.stations = STATION_IDS.map((id, index) => {
      const node = NODE_BY_ID[id];
      const station: StationRuntime = {
        id,
        name: node.name,
        area: node.area,
        x: node.x,
        y: node.y,
        factor: 0.9 + this.rng.next() * 0.2,
        rh: 0,
        battery: STATION_BATTERY_START[id] ?? 70 + this.rng.next() * 25,
        latencyMs: 60,
        lastCalibration: LAST_CALIBRATION[index % LAST_CALIBRATION.length],
        samples: gasRecord(() => []),
        raw: gasRecord(() => 0),
        avg: gasRecord(() => 0),
        rate: gasRecord(() => 0),
        gasLevel: gasRecord(() => 0 as Level),
        gasChannel: gasRecord(() => null),
        level: 0,
      };
      // Humedad relativa de la galería: en el rango típico de minas húmedas (≈ 74–82 %).
      station.rh = 78 + (station.factor - 1) * 40;
      for (const gas of GAS_ORDER) {
        const base = stationBase(gas, station.factor);
        station.raw[gas] = base;
        station.samples[gas] = Array.from({ length: SLOW_WINDOW }, () => base);
      }
      return station;
    });
    this.stationById = Object.fromEntries(this.stations.map((s) => [s.id, s]));

    this.workers = WORKER_SEEDS.map((seed) => {
      const first = this.pickNeighbor(seed.start, null);
      return {
        id: seed.id,
        name: seed.name,
        role: seed.role,
        mx6: seed.mx6,
        battery: 60 + this.rng.next() * 35,
        from: seed.start,
        to: first,
        prev: null,
        progress: this.rng.next() * 0.5,
        samples: 0,
        exposure: gasRecord(() => 0),
      };
    });

    this.alerts = [];
    this.activeByKey.clear();
    this.timeline = [];
    this.firedSteps.clear();
    this.series = gasRecord(() => []);
    this.queue = 0;
    this.processingMs = 60;

    this.analyze();
    this.pushTimeline('Sistema listo. Turno iniciado.', 0);
  }

  setThresholds(thresholds: Record<GasKey, GasThreshold>) {
    this.thresholds = thresholds;
  }

  /** Avanza `seconds` segundos simulados y devuelve la foto completa del estado. */
  advance(seconds: number): MineSnapshot {
    for (let i = 0; i < seconds; i++) this.tick();
    return this.snapshot();
  }

  acknowledge(alertId: number) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) alert.acknowledged = true;
  }

  acknowledgeAll() {
    for (const alert of this.alerts) if (alert.status === 'activa') alert.acknowledged = true;
  }

  snapshot(): MineSnapshot {
    const stations: StationSnapshot[] = this.stations.map((st) => ({
      id: st.id,
      name: st.name,
      area: st.area,
      x: st.x,
      y: st.y,
      online: true,
      battery: Math.round(st.battery * 10) / 10,
      lastCalibration: st.lastCalibration,
      latencyMs: st.latencyMs,
      level: st.level,
      climate: {
        tempC: st.raw.TEMP,
        rh: st.rh,
        wetBulbC: wetBulbFromTempRh(st.raw.TEMP, st.rh),
      },
      readings: gasRecord<GasReading>((g) => ({
        raw: st.raw[g],
        avg: st.avg[g],
        rate: st.rate[g],
        level: st.gasLevel[g],
        channel: st.gasChannel[g],
      })),
    }));

    const workers: WorkerSnapshot[] = this.workers.map((w) => {
      const linked = this.linkedStation(w);
      const from = NODE_BY_ID[w.from];
      const to = NODE_BY_ID[w.to];
      const seconds = Math.max(this.elapsed, 1);
      return {
        id: w.id,
        name: w.name,
        role: w.role,
        mx6: w.mx6,
        battery: Math.round(w.battery),
        linkedStationId: linked.id,
        x: from.x + (to.x - from.x) * w.progress,
        y: from.y + (to.y - from.y) * w.progress,
        level: linked.level,
        reading: gasRecord((g) => linked.raw[g]),
        twa: gasRecord((g) => w.exposure[g] / seconds),
        samples: w.samples,
      };
    });

    return {
      elapsed: this.elapsed,
      clock: clockFromElapsed(this.elapsed),
      scenario: this.scenario,
      target: this.target,
      stations,
      workers,
      alerts: [...this.alerts],
      timeline: [...this.timeline],
      series: gasRecord((g) => this.series[g].slice()),
      representative: { ...this.representative },
      mineLevel: Math.max(0, ...this.stations.map((s) => s.level)) as Level,
      emergency: this.alerts.some((a) => a.status === 'activa' && a.level === 3),
      system: {
        connection: 'Conectado',
        broker: 'Activo',
        queueLength: this.queue,
        processingMs: this.processingMs,
        offlineStations: 0,
      },
    };
  }

  private tick() {
    this.elapsed += 1;
    this.fireScenarioSteps();
    this.sample();
    this.analyze();
    this.updateAlerts();
    for (const w of this.workers) this.walk(w);
    this.updateSeries();
    this.updateSystem();
  }

  /** Lecturas crudas: línea base + ruido + aporte del escenario. */
  private sample() {
    for (const st of this.stations) {
      const hopsFromTarget = this.hopsTarget[st.id] ?? 99;
      const hopsFromEntry = this.hopsEntry[st.id] ?? 99;
      for (const gas of GAS_ORDER) {
        const noise = (this.rng.next() * 2 - 1) * NOISE[gas];
        const effect = gasEffect(
          {
            scenario: this.scenario,
            target: this.target,
            elapsed: this.elapsed,
            hopsFromTarget,
            hopsFromEntry,
          },
          gas,
        );
        const value = stationBase(gas, st.factor) + noise + effect;
        st.raw[gas] = gas === 'O2' || gas === 'TEMP' ? value : Math.max(value, 0);
        st.samples[gas].push(st.raw[gas]);
        if (st.samples[gas].length > SLOW_WINDOW) st.samples[gas].shift();
      }
      const baseRh = 78 + (st.factor - 1) * 40;
      st.rh = Math.min(99, Math.max(10, baseRh + (this.rng.next() * 2 - 1) * 1.5));
      st.latencyMs = Math.round(40 + this.rng.next() * 110);
      st.battery = Math.max(0, st.battery - 0.0015);
    }
  }

  /** Canal lento (promedio móvil), canal rápido (dC/dt) y nivel por gas y estación. */
  private analyze() {
    for (const st of this.stations) {
      for (const gas of GAS_ORDER) {
        const samples = st.samples[gas];
        const avg = mean(samples);
        const past = samples[samples.length - 1 - FAST_LAG] ?? samples[0];
        const rate = (st.raw[gas] - past) / FAST_LAG;
        const threshold = this.thresholds[gas];

        const slowLevel = levelFor(avg, threshold);
        const fastHit = threshold.direction === 'above' ? rate >= threshold.fastRate : rate <= -threshold.fastRate;

        let level: Level = slowLevel;
        let channel: 'rápido' | 'lento' | null = slowLevel > 0 ? 'lento' : null;
        if (fastHit && slowLevel === 0) {
          level = 1;
          channel = 'rápido';
        }

        st.avg[gas] = avg;
        st.rate[gas] = rate;
        st.gasLevel[gas] = level;
        st.gasChannel[gas] = channel;
      }
      st.level = Math.max(...GAS_ORDER.map((g) => st.gasLevel[g])) as Level;
    }

    for (const gas of GAS_ORDER) {
      const { direction } = this.thresholds[gas];
      const sorted = [...this.stations].sort((a, b) => (direction === 'above' ? b.avg[gas] - a.avg[gas] : a.avg[gas] - b.avg[gas]));
      const rep = sorted[0];
      this.representative[gas] = { stationId: rep.id, raw: rep.raw[gas], avg: rep.avg[gas] };
    }
  }

  private updateAlerts() {
    for (const st of this.stations) {
      for (const gas of GAS_ORDER) {
        const level = st.gasLevel[gas];
        const key = `${st.id}|${gas}`;
        const current = this.activeByKey.get(key);

        if (level === 0) {
          if (current) {
            current.status = 'resuelta';
            this.activeByKey.delete(key);
          }
          continue;
        }

        const channel = st.gasChannel[gas] ?? 'lento';
        if (current && current.level === level) {
          current.value = st.avg[gas];
          current.channel = channel;
          continue;
        }

        if (current) current.status = level > current.level ? 'escalada' : 'resuelta';

        const alert: AlertRecord = {
          id: ++this.alertId,
          time: clockFromElapsed(this.elapsed),
          stationId: st.id,
          gas,
          level,
          value: st.avg[gas],
          channel,
          status: 'activa',
          acknowledged: false,
        };
        this.alerts.push(alert);
        if (this.alerts.length > ALERT_LENGTH) this.alerts.shift();
        this.activeByKey.set(key, alert);

        const th = this.thresholds[gas];
        const channelLabel = channel === 'rápido' ? 'canal rápido' : 'canal lento';
        this.pushTimeline(
          `${st.id} · ${th.label}: Nivel ${level} por ${channelLabel} (${alert.value.toFixed(th.decimals)} ${th.unit})`,
          level,
        );
      }
    }
  }

  /** Estación enlazada al MX6: la del extremo más cercano del tramo que recorre (nunca la entrada). */
  private linkedStation(w: WorkerRuntime): StationRuntime {
    const candidate = w.progress < 0.5 ? w.from : w.to;
    const id = candidate === ENTRY_ID ? w.from : candidate;
    return this.stationById[id] ?? this.stations[0];
  }

  /** Recorrido continuo: al llegar a un nodo elige un tramo distinto al anterior. */
  private walk(w: WorkerRuntime) {
    w.battery = Math.max(0, w.battery - 0.003);
    const linked = this.linkedStation(w);
    for (const gas of GAS_ORDER) w.exposure[gas] += linked.raw[gas];
    w.samples += 1;

    w.progress += 1 / WALK_SECONDS;
    if (w.progress < 1) return;

    w.progress = 0;
    w.prev = w.from;
    w.from = w.to;
    w.to = this.pickNeighbor(w.from, w.prev);
  }

  /** Vecino elegido al azar, sin entrar a la entrada del mina y evitando volver al tramo anterior. */
  private pickNeighbor(node: string, previous: string | null): string {
    const options = (ADJACENCY[node] ?? []).filter((id) => id !== ENTRY_ID && id !== previous);
    const pool = options.length > 0 ? options : (ADJACENCY[node] ?? []).filter((id) => id !== ENTRY_ID);
    return pool[Math.floor(this.rng.next() * pool.length)] ?? node;
  }

  private updateSeries() {
    for (const gas of GAS_ORDER) {
      const rep = this.representative[gas];
      const points = this.series[gas];
      points.push({ t: this.elapsed, fast: rep.raw, slow: rep.avg });
      if (points.length > SERIES_LENGTH) points.shift();
    }
  }

  private updateSystem() {
    const drift = this.rng.next();
    if (drift < 0.3) this.queue = Math.min(4, this.queue + 1);
    else if (drift > 0.7) this.queue = Math.max(0, this.queue - 1);
    this.processingMs = Math.round(45 + this.rng.next() * 35);
  }

  private fireScenarioSteps() {
    const definition = SCENARIO_BY_ID[this.scenario];
    definition.steps.forEach((step, index) => {
      if (this.firedSteps.has(index) || this.elapsed < step.at) return;
      this.firedSteps.add(index);
      this.pushTimeline(step.text(this.target), step.tone);
    });
  }

  private pushTimeline(text: string, tone: Level) {
    this.timeline.push({ id: ++this.timelineId, time: clockFromElapsed(this.elapsed), text, tone });
    if (this.timeline.length > TIMELINE_LENGTH) this.timeline.shift();
  }
}

/** Instancia única para toda la aplicación. Todas las pestañas leen de su snapshot. */
export const engine = new SimEngine();
