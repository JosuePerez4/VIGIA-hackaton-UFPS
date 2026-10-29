// Datos sintéticos: no representan mediciones reales.
import { levelFor, type Direction, type GasKey, type GasThreshold, type Level } from '@/config/thresholds';
import { STATION_IDS } from './mine';


const BASE: Record<GasKey, number> = {
  CH4: 0.25,
  CO: 6,
  O2: 20.8,
  H2S: 0.6,
  CO2: 0.35,
  NO2: 0.4,
  TEMP: 24,
  AIR: 1.1,
};

export const STEP_MINUTES = 5;
const MINUTE_MS = 60_000;

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export interface HistoryPoint {
  t: number;
  value: number;
}

function stationFactor(index: number) {
  return 0.9 + hash(index + 1) * 0.2;
}

export function syntheticValue(gas: GasKey, stationIndex: number, minute: number): number {
  const minuteOfDay = ((minute % 1440) + 1440) % 1440;
  const hour = minuteOfDay / 60;
  const dayCycle = Math.sin(((hour - 6) / 24) * Math.PI * 2);
  const noise = hash(minute * 0.02 + stationIndex * 13.7) * 2 - 1;
  const spike = hash(minute * 7 + stationIndex * 3) > 0.997;
  const base = BASE[gas] * stationFactor(stationIndex);

  let value: number;
  switch (gas) {
    case 'CH4':
      value = base * (1 + 0.25 * dayCycle) + 0.04 * noise + (spike ? 1.2 : 0);
      break;
    case 'CO':
      value = base * (1 + 0.2 * dayCycle) + 1.5 * noise + (spike ? 22 : 0);
      break;
    case 'O2':
      value = BASE.O2 - 0.05 * noise - (spike ? 0.4 : 0);
      break;
    case 'H2S':
      value = Math.max(0, base + 0.3 * noise + (spike ? 6 : 0));
      break;
    case 'CO2':
      value = base * (1 + 0.15 * dayCycle) + 0.02 * noise;
      break;
    case 'NO2':
      value = Math.max(0, base + 0.1 * noise + (spike ? 1.5 : 0));
      break;
    case 'TEMP':
      value = BASE.TEMP + 2 * dayCycle + 0.3 * noise;
      break;
    case 'AIR':
      value = BASE.AIR * (1 + 0.1 * dayCycle) + 0.05 * noise - (spike ? 0.2 : 0);
      break;
  }
  return Math.max(0, value);
}

export function mineValue(gas: GasKey, direction: Direction, minute: number): number {
  const values = STATION_IDS.map((_, i) => syntheticValue(gas, i, minute));
  return direction === 'above' ? Math.max(...values) : Math.min(...values);
}

export function stationValue(gas: GasKey, stationId: string, minute: number): number {
  const index = STATION_IDS.indexOf(stationId);
  return syntheticValue(gas, Math.max(index, 0), minute);
}

export interface SeriesOptions {
  gas: GasKey;
  stationId: string | null;
  direction: Direction;
  endMinute: number;
  minutes: number;
}

export function buildSeries({ gas, stationId, direction, endMinute, minutes }: SeriesOptions): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  const start = endMinute - minutes;
  for (let minute = start; minute <= endMinute; minute += STEP_MINUTES) {
    const value = stationId ? stationValue(gas, stationId, minute) : mineValue(gas, direction, minute);
    points.push({ t: minute * MINUTE_MS, value });
  }
  return points;
}

export interface HistoryEvent {
  start: number;
  peakLevel: Level;
  peakValue: number;
  durationMin: number;
}

export function detectEvents(points: HistoryPoint[], threshold: GasThreshold): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  let current: HistoryEvent | null = null;
  for (const point of points) {
    const level = levelFor(point.value, threshold);
    if (level > 0) {
      if (!current) {
        current = { start: point.t, peakLevel: level, peakValue: point.value, durationMin: 0 };
        events.push(current);
      }
      current.peakLevel = Math.max(current.peakLevel, level) as Level;
      if (
        threshold.direction === 'above' ? point.value > current.peakValue : point.value < current.peakValue
      ) {
        current.peakValue = point.value;
      }
      current.durationMin += STEP_MINUTES;
    } else {
      current = null;
    }
  }
  return events.reverse();
}
