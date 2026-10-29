import { DEFAULT_THRESHOLDS, GAS_ORDER, levelFor, type GasKey, type GasThreshold, type Level } from '@/config/thresholds';
import { ADJACENCY, ENTRY_ID, LAST_CALIBRATION, NODE_BY_ID, STATION_IDS, WORKER_SEEDS, hopDistances } from './mine';
import { DEVICE_EVENT_S, SCENARIO_BY_ID, TIME_SCALE, gasEffect, type ScenarioId } from './scenarios';
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

const NOISE: Record<GasKey, number> = {
  CH4: 0.003,
  CO: 0.5,
  O2: 0.04,
  H2S: 0.08,
  CO2: 0.01,
  NO2: 0.03,
  TEMP: 0.12,
  AIR: 0.04,
};

const SLOW_WINDOW = 40;
const FAST_LAG = 2;
const SERIES_LENGTH = 300;
const TIMELINE_LENGTH = 200;
const ALERT_LENGTH = 300;
const DEFAULT_START_SECONDS = 14 * 3600 + 20 * 60;
const TRACE_EVERY_S = 5;
const TRACE_LENGTH = 2400;

export interface TracePoint {
  t: number;
  v: number;
}
const WALK_SECONDS = 10;
const BATTERY_DRAIN_PER_S = 0.02;
const MX6_MIN_BATTERY = 90;

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

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

export function clockFromElapsed(elapsed: number, startSeconds = DEFAULT_START_SECONDS): string {
  const total = startSeconds + Math.floor(elapsed);
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
  rh: number;
  onBattery: boolean;
  online: boolean;
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
  failed: boolean;
  exposure: Record<GasKey, number>;
}

export class SimEngine {
  private seed: number;
  private rng!: Rng;
  private elapsed = 0;
  private startSeconds = DEFAULT_START_SECONDS;
  private deviceEventDone = false;
  private traces: Record<string, Record<GasKey, TracePoint[]>> = {};
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

  reset(scenario: ScenarioId, target: string, startSeconds = this.startSeconds) {
    this.rng = new Rng(this.seed);
    this.elapsed = 0;
    this.startSeconds = startSeconds;
    this.traces = {};
    this.deviceEventDone = false;
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
        onBattery: false,
        online: true,
        battery: 100,
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
        battery: 90 + this.rng.next() * 10,
        from: seed.start,
        to: first,
        prev: null,
        progress: this.rng.next() * 0.5,
        samples: 0,
        failed: false,
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
      online: st.online,
      onBattery: st.onBattery,
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
        failed: w.failed,
      };
    });

    return {
      elapsed: this.elapsed,
      clock: clockFromElapsed(this.elapsed, this.startSeconds),

      startSeconds: this.startSeconds,
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
    this.deviceEvents();
    this.sample();
    this.analyze();
    this.updateAlerts();
    for (const w of this.workers) this.walk(w);
    this.updateSeries();
    this.recordTrace();
    this.updateSystem();
  }

  private sample() {
    for (const st of this.stations) {
      const hopsFromTarget = this.hopsTarget[st.id] ?? 99;
      const hopsFromEntry = this.hopsEntry[st.id] ?? 99;
      if (st.onBattery) st.battery = Math.max(0, st.battery - BATTERY_DRAIN_PER_S);
      if (!st.online) continue;
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

    }
  }

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
          time: clockFromElapsed(this.elapsed, this.startSeconds),

          elapsed: this.elapsed,
          stationId: st.id,
          gas,
          kind: 'gas',
          detail: '',
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

  private linkedStation(w: WorkerRuntime): StationRuntime {
    const candidate = w.progress < 0.5 ? w.from : w.to;
    const id = candidate === ENTRY_ID ? w.from : candidate;
    return this.stationById[id] ?? this.stations[0];
  }

  private walk(w: WorkerRuntime) {
    w.battery = Math.max(MX6_MIN_BATTERY, w.battery - 0.003);
    const linked = this.linkedStation(w);
    if (!w.failed) for (const gas of GAS_ORDER) w.exposure[gas] += linked.raw[gas];
    w.samples += 1;

    w.progress += 1 / WALK_SECONDS;
    if (w.progress < 1) return;

    w.progress = 0;
    w.prev = w.from;
    w.from = w.to;
    w.to = this.pickNeighbor(w.from, w.prev);
  }

  private pickNeighbor(node: string, previous: string | null): string {
    const options = (ADJACENCY[node] ?? []).filter((id) => id !== ENTRY_ID && id !== previous);
    const pool = options.length > 0 ? options : (ADJACENCY[node] ?? []).filter((id) => id !== ENTRY_ID);
    return pool[Math.floor(this.rng.next() * pool.length)] ?? node;
  }

  private recordTrace() {
    if (this.elapsed % TRACE_EVERY_S !== 0) return;
    for (const st of this.stations) {
      const perGas = (this.traces[st.id] ??= gasRecord(() => []));
      for (const gas of GAS_ORDER) {
        const list = perGas[gas];
        list.push({ t: this.elapsed, v: st.avg[gas] });
        if (list.length > TRACE_LENGTH) list.shift();
      }
    }
  }

  stationTrace(stationId: string, gas: GasKey, from: number, to: number): TracePoint[] {
    return (this.traces[stationId]?.[gas] ?? []).filter((p) => p.t >= from && p.t <= to);
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

  private deviceEvents() {
    const at = DEVICE_EVENT_S[this.scenario];
    if (at === undefined || this.deviceEventDone || this.elapsed < at * TIME_SCALE) return;
    this.deviceEventDone = true;
    if (this.scenario === 'corte-luz') {
      for (const st of this.stations) st.onBattery = true;
      this.raiseEquipment(this.target, 'Corte de energía: estaciones en batería', 2);
      return;
    }
    const station = this.stationById[this.target];
    if (station) {
      station.online = false;
      this.raiseEquipment(station.id, `Falla del sensor ${station.id}: sin datos`, 2);
    }
    const worker = this.workers.find((w) => this.linkedStation(w).id === this.target) ?? this.workers[0];
    if (worker) {
      worker.failed = true;
      this.raiseEquipment(this.target, `Falla del MX6 ${worker.mx6} (${worker.name})`, 2);
    }
  }

  private raiseEquipment(stationId: string, detail: string, level: 1 | 2 | 3) {
    this.alerts.push({
      id: ++this.alertId,
      time: clockFromElapsed(this.elapsed, this.startSeconds),
      elapsed: this.elapsed,
      kind: 'equipo',
      detail,
      stationId,
      gas: 'EQUIPO',
      level,
      value: 0,
      channel: 'lento',
      status: 'activa',
      acknowledged: false,
    });
    if (this.alerts.length > ALERT_LENGTH) this.alerts.shift();
    this.pushTimeline(`${stationId} · ${detail}`, level);
  }

  private fireScenarioSteps() {
    const definition = SCENARIO_BY_ID[this.scenario];
    definition.steps.forEach((step, index) => {
      if (this.firedSteps.has(index) || this.elapsed < step.at * TIME_SCALE) return;
      this.firedSteps.add(index);
      this.pushTimeline(step.text(this.target), step.tone);
    });
  }

  private pushTimeline(text: string, tone: Level) {
    this.timeline.push({ id: ++this.timelineId, elapsed: this.elapsed, time: clockFromElapsed(this.elapsed, this.startSeconds), text, tone });
    if (this.timeline.length > TIMELINE_LENGTH) this.timeline.shift();
  }
}

export const engine = new SimEngine();
