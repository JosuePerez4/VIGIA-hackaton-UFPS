export type GasKey = 'CH4' | 'CO' | 'O2' | 'H2S' | 'CO2' | 'NO2' | 'TEMP' | 'AIR';

/** 'above': peligro cuando el valor sube. 'below': peligro cuando el valor baja (O₂, velocidad del aire). */
export type Direction = 'above' | 'below';

export interface GasThreshold {
  label: string;
  unit: string;
  decimals: number;
  direction: Direction;
  level1: number;
  level2: number;
  level3: number;
  /** Canal rápido: tasa de cambio absoluta (unidad/s) que dispara una alerta temprana de Nivel 1. */
  fastRate: number;
}

export type Level = 0 | 1 | 2 | 3;

/**
 * Valores de EJEMPLO para el prototipo. NO son valores legales.
 * Se ajustarán con la normativa aplicable.
 */
// TODO: reemplazar con los valores del Decreto 1886 de 2015 / Decreto 944 de 2022
export const DEFAULT_THRESHOLDS: Record<GasKey, GasThreshold> = {
  CH4: { label: 'Metano (CH₄)', unit: '% vol', decimals: 2, direction: 'above', level1: 1.0, level2: 1.5, level3: 2.0, fastRate: 0.02 },
  CO: { label: 'Monóxido de carbono (CO)', unit: 'ppm', decimals: 0, direction: 'above', level1: 25, level2: 50, level3: 100, fastRate: 3 },
  O2: { label: 'Oxígeno (O₂)', unit: '% vol', decimals: 1, direction: 'below', level1: 19.5, level2: 18, level3: 16, fastRate: 0.1 },
  H2S: { label: 'Sulfuro de hidrógeno (H₂S)', unit: 'ppm', decimals: 1, direction: 'above', level1: 5, level2: 10, level3: 15, fastRate: 0.6 },
  CO2: { label: 'Dióxido de carbono (CO₂)', unit: '% vol', decimals: 2, direction: 'above', level1: 0.5, level2: 1.0, level3: 1.5, fastRate: 0.02 },
  NO2: { label: 'Dióxido de nitrógeno (NO₂)', unit: 'ppm', decimals: 1, direction: 'above', level1: 3, level2: 5, level3: 10, fastRate: 0.3 },
  // TODO: reemplazar con los valores del Decreto 1886 de 2015 / Decreto 944 de 2022
  TEMP: { label: 'Temperatura', unit: '°C', decimals: 1, direction: 'above', level1: 30, level2: 33, level3: 36, fastRate: 0.5 },
  // TODO: reemplazar con los valores del Decreto 1886 de 2015 / Decreto 944 de 2022
  AIR: { label: 'Velocidad del aire', unit: 'm/s', decimals: 2, direction: 'below', level1: 0.5, level2: 0.3, level3: 0.15, fastRate: 0.2 },
};

export const GAS_ORDER: GasKey[] = ['CH4', 'CO', 'O2', 'H2S', 'CO2', 'NO2', 'TEMP', 'AIR'];

export const LEVEL_META: Record<Level, { label: string; mineLabel: string }> = {
  0: { label: 'Normal', mineLabel: 'Normal' },
  1: { label: 'Nivel 1 · Precaución', mineLabel: 'Precaución' },
  2: { label: 'Nivel 2 · Alerta', mineLabel: 'Alerta' },
  3: { label: 'Nivel 3 · Emergencia', mineLabel: 'Emergencia' },
};

export function levelFor(value: number, threshold: GasThreshold): Level {
  const { direction, level1, level2, level3 } = threshold;
  if (direction === 'above') {
    return value >= level3 ? 3 : value >= level2 ? 2 : value >= level1 ? 1 : 0;
  }
  return value <= level3 ? 3 : value <= level2 ? 2 : value <= level1 ? 1 : 0;
}
