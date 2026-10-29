import type { GasKey } from '@/config/thresholds';

export type ScenarioId =
  | 'normal'
  | 'fuga-metano'
  | 'aumento-co'
  | 'falla-ventilacion'
  | 'minero-critico'
  | 'alerta-en-trabajo';

export interface ScenarioStep {
  /** Segundos desde el inicio del escenario. */
  at: number;
  text: (target: string) => string;
  tone: 0 | 1 | 2 | 3;
}

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  description: string;
  /** Tecla de atajo durante la presentación. */
  shortcut: string;
  needsTarget: boolean;
  steps: ScenarioStep[];
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'normal',
    name: 'Operación normal',
    description: 'Turno sin eventos. Los mineros caminan por la mina y su MX6 mide el gas en cada punto.',
    shortcut: '1',
    needsTarget: false,
    steps: [{ at: 0, text: () => 'Inicio de turno. Operación normal y mineros en recorrido.', tone: 0 }],
  },
  {
    id: 'fuga-metano',
    name: 'Fuga de metano',
    description: 'Fuga de CH₄ en una estación que se propaga a sus vecinas. Muestra los tres niveles.',
    shortcut: '2',
    needsTarget: true,
    steps: [
      { at: 0, text: (t) => `Inicio de escenario: fuga de metano en ${t}.`, tone: 0 },
      { at: 8, text: (t) => `Canal rápido: aumento de CH₄ detectado en ${t}.`, tone: 1 },
      { at: 30, text: (t) => `Promedio móvil de CH₄ en Nivel 1 en ${t}.`, tone: 1 },
      { at: 45, text: () => 'Propagación del gas a estaciones adyacentes.', tone: 2 },
      { at: 68, text: (t) => `CH₄ alcanza Nivel 2 en ${t}.`, tone: 2 },
      { at: 85, text: (t) => `CH₄ alcanza Nivel 3 en ${t}.`, tone: 3 },
    ],
  },
  {
    id: 'alerta-en-trabajo',
    name: 'Alerta durante el trabajo',
    description: 'Mientras los mineros siguen trabajando, una estación sube a Nivel 2 y el MX6 de quien pasa por ahí lo registra.',
    shortcut: '3',
    needsTarget: true,
    steps: [
      { at: 0, text: () => 'Inicio: mineros trabajando, MX6 midiendo en recorrido.', tone: 0 },
      { at: 15, text: (t) => `Inicio de elevación de CH₄ en ${t}.`, tone: 0 },
      { at: 18, text: (t) => `Canal rápido dispara alerta en ${t}.`, tone: 1 },
      { at: 50, text: (t) => `CH₄ en Nivel 1 (promedio móvil) en ${t}.`, tone: 1 },
      { at: 90, text: (t) => `Alerta de Nivel 2 en ${t}.`, tone: 2 },
    ],
  },
  {
    id: 'aumento-co',
    name: 'Aumento rápido de CO',
    description: 'Pico de monóxido de carbono. El canal rápido reacciona antes que el registro oficial.',
    shortcut: '4',
    needsTarget: true,
    steps: [
      { at: 0, text: (t) => `Inicio de escenario: aumento rápido de CO en ${t}.`, tone: 0 },
      { at: 5, text: (t) => `Canal rápido dispara alerta por tasa de cambio de CO en ${t}.`, tone: 1 },
      { at: 25, text: (t) => `Promedio móvil de CO supera Nivel 2 en ${t}.`, tone: 2 },
      { at: 50, text: (t) => `CO supera Nivel 3 en ${t}.`, tone: 3 },
    ],
  },
  {
    id: 'falla-ventilacion',
    name: 'Falla de ventilación',
    description: 'La velocidad del aire cae en toda la mina y los gases se acumulan.',
    shortcut: '5',
    needsTarget: false,
    steps: [
      { at: 0, text: () => 'Inicio de escenario: falla de ventilación principal.', tone: 0 },
      { at: 24, text: () => 'Velocidad del aire por debajo de Nivel 1 en varias galerías.', tone: 1 },
      { at: 40, text: () => 'Velocidad del aire en Nivel 3.', tone: 3 },
      { at: 90, text: () => 'Acumulación de CH₄ y CO en galerías de cabecera.', tone: 2 },
    ],
  },
  {
    id: 'minero-critico',
    name: 'Minero en zona crítica',
    description: 'Exposición a H₂S y CO en la estación elegida, donde hay mineros trabajando.',
    shortcut: '6',
    needsTarget: true,
    steps: [
      { at: 0, text: (t) => `Inicio de escenario: zona crítica en ${t}.`, tone: 0 },
      { at: 8, text: (t) => `H₂S y CO en aumento en ${t}.`, tone: 1 },
      { at: 22, text: (t) => `Minero en ${t} supera Nivel 2 de exposición.`, tone: 2 },
      { at: 35, text: (t) => `Nivel 3 en ${t}.`, tone: 3 },
    ],
  },
];

export const SCENARIO_BY_ID: Record<ScenarioId, ScenarioDef> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
) as Record<ScenarioId, ScenarioDef>;

export interface EffectContext {
  scenario: ScenarioId;
  target: string;
  elapsed: number;
  hopsFromTarget: number;
  hopsFromEntry: number;
}

const ramp = (t: number, start: number, span: number, amount: number) =>
  amount * Math.min(Math.max((t - start) / span, 0), 1);

/** Aporte adicional de un escenario a un gas en una estación (se suma a la línea base). */
export function gasEffect(ctx: EffectContext, gas: GasKey): number {
  const { scenario, elapsed: t, hopsFromTarget: h, hopsFromEntry: e } = ctx;

  if (scenario === 'fuga-metano') {
    const intensity = [1, 0.5, 0.25][h] ?? 0;
    const delay = h * 15;
    if (gas === 'CH4') return intensity * ramp(t, 5 + delay, 90, 2.6);
    if (gas === 'O2') return -intensity * ramp(t, 10 + delay, 90, 1.2);
  }

  if (scenario === 'alerta-en-trabajo') {
    // Sube hasta Nivel 2 (1.5 % con la línea base) sin llegar a Nivel 3.
    const intensity = [1, 0.4, 0.1][h] ?? 0;
    if (gas === 'CH4') return intensity * ramp(t, 15 + h * 10, 60, 1.45);
  }

  if (scenario === 'aumento-co') {
    const intensity = [1, 0.35, 0.1][h] ?? 0;
    if (gas === 'CO') return intensity * ramp(t, 3 + h * 10, 20, 180);
  }

  if (scenario === 'falla-ventilacion') {
    const far = Math.min(e / 6, 1);
    if (gas === 'AIR') return -ramp(t, 0, 40, 1.0);
    if (gas === 'CH4') return ramp(t, 10, 200, 1.1) * (0.4 + 0.6 * far);
    if (gas === 'CO') return ramp(t, 10, 200, 30) * (0.4 + 0.6 * far);
  }

  if (scenario === 'minero-critico') {
    const intensity = [1, 0.3, 0.1][h] ?? 0;
    if (gas === 'H2S') return intensity * ramp(t, 3, 30, 22);
    if (gas === 'CO') return intensity * ramp(t, 3, 30, 120);
  }

  return 0;
}
