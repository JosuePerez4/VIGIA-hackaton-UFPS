/**
 * Geometría de la mina tomada de `mapa_mina_estaciones.svg` (viewBox 390 × 660).
 * Coordenadas en unidades del SVG: la cuadrícula del plano avanza 60 px en X y 70 px en Y.
 */

export type Area = 'Galería' | 'Refugio' | 'Bombeo' | 'Frente sur' | 'Sector este' | 'Entrada' | 'Superficie';

export interface MineNode {
  id: string;
  name: string;
  area: Area;
  x: number;
  y: number;
}

export const ENTRY_ID = 'ENT-00';
/** Base en superficie, fuera de la mina: donde está el ingeniero de turno. */
export const BASE_ID = 'BASE-01';

const NODE_DEFS: [id: string, x: number, y: number, area: Area][] = [
  ['EST-01', 190, 100, 'Galería'],
  ['EST-02', 190, 160, 'Galería'],
  ['EST-03', 190, 220, 'Galería'],
  ['EST-04', 190, 290, 'Galería'],
  ['EST-05', 190, 360, 'Galería'],
  ['EST-06', 190, 430, 'Galería'],
  ['EST-07', 190, 500, 'Galería'],
  ['EST-08', 190, 570, 'Frente sur'],
  ['EST-09', 130, 220, 'Galería'],
  ['EST-10', 70, 220, 'Galería'],
  ['EST-11', 70, 290, 'Galería'],
  ['EST-12', 70, 360, 'Bombeo'],
  ['EST-13', 130, 360, 'Galería'],
  ['EST-14', 250, 220, 'Galería'],
  ['EST-15', 310, 220, 'Galería'],
  ['EST-16', 310, 160, 'Galería'],
  ['EST-17', 310, 100, 'Refugio'],
  ['EST-18', 250, 360, 'Galería'],
  ['EST-19', 310, 360, 'Galería'],
  ['EST-20', 310, 430, 'Sector este'],
  ['EST-21', 130, 430, 'Galería'],
];

/** Galerías: pares de nodos conectados (mismo trazo que el mapa). */
const EDGE_DEFS: [string, string][] = [
  [ENTRY_ID, 'EST-01'],
  ['EST-01', 'EST-02'],
  ['EST-02', 'EST-03'],
  ['EST-03', 'EST-04'],
  ['EST-04', 'EST-05'],
  ['EST-05', 'EST-06'],
  ['EST-06', 'EST-07'],
  ['EST-07', 'EST-08'],
  ['EST-03', 'EST-09'],
  ['EST-09', 'EST-10'],
  ['EST-10', 'EST-11'],
  ['EST-11', 'EST-12'],
  ['EST-12', 'EST-13'],
  ['EST-13', 'EST-05'],
  ['EST-03', 'EST-14'],
  ['EST-14', 'EST-15'],
  ['EST-15', 'EST-16'],
  ['EST-16', 'EST-17'],
  ['EST-05', 'EST-18'],
  ['EST-18', 'EST-19'],
  ['EST-19', 'EST-20'],
  ['EST-06', 'EST-21'],
];

const entry: MineNode = { id: ENTRY_ID, name: 'Entrada · Receptor y procesador de información', area: 'Entrada', x: 190, y: 40 };
const base: MineNode = { id: BASE_ID, name: 'Superficie · Base del ingeniero de turno', area: 'Superficie', x: 190, y: -30 };

export const NODES: MineNode[] = [
  entry,
  base,
  ...NODE_DEFS.map(([id, x, y, area]) => ({
    id,
    name: `Estación ${id.slice(4)} · ${area}`,
    area,
    x,
    y,
  })),
];

export const STATION_IDS = NODE_DEFS.map(([id]) => id);
export const NODE_BY_ID: Record<string, MineNode> = Object.fromEntries(NODES.map((n) => [n.id, n]));

/** Zonas del mapa (rectángulos del SVG). Son referencia visual, no afectan la simulación. */
export const ZONES = [
  { name: 'Refugio', x: 264, y: 64, w: 92, h: 64, color: '#4d5a1a' },
  { name: 'Bombeo', x: 24, y: 334, w: 84, h: 52, color: '#1f4057' },
  { name: 'Frente sur', x: 124, y: 534, w: 132, h: 66, color: '#4d5a1a' },
  { name: 'Sector este', x: 264, y: 404, w: 92, h: 54, color: '#2c3b4d' },
] as const;

/** Cable de superficie: une la base del ingeniero con el receptor de la entrada. */
const SURFACE_EDGE: [string, string] = [BASE_ID, ENTRY_ID];

/** Galerías (trazo oscuro de la mina). */
export const EDGES: [string, string][] = EDGE_DEFS;
/** Cables de fibra: siguen las galerías hasta la entrada y continúan hasta la base en superficie. */
export const CABLES: [string, string][] = [...EDGE_DEFS, SURFACE_EDGE];

export const ADJACENCY: Record<string, string[]> = Object.fromEntries(NODES.map((n) => [n.id, [] as string[]]));
for (const [a, b] of CABLES) {
  ADJACENCY[a].push(b);
  ADJACENCY[b].push(a);
}

export function hopDistances(from: string): Record<string, number> {
  const dist: Record<string, number> = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const next of ADJACENCY[current] ?? []) {
      if (dist[next] === undefined) {
        dist[next] = dist[current] + 1;
        queue.push(next);
      }
    }
  }
  return dist;
}

export interface WorkerSeed {
  id: string;
  name: string;
  role: string;
  mx6: string;
  start: string;
}

export const WORKER_SEEDS: WorkerSeed[] = [
  { id: 'MIN-01', name: 'Andrés Ruiz', role: 'Perforista', mx6: 'MX6-1001', start: 'EST-02' },
  { id: 'MIN-02', name: 'Diana Mosquera', role: 'Operadora de cargue', mx6: 'MX6-1002', start: 'EST-04' },
  { id: 'MIN-03', name: 'Luis Herrera', role: 'Sostenedor', mx6: 'MX6-1003', start: 'EST-06' },
  { id: 'MIN-04', name: 'Carmen Ospina', role: 'Ingeniera de turno', mx6: 'MX6-1004', start: 'EST-08' },
  { id: 'MIN-05', name: 'Jorge Valencia', role: 'Ayudante de galería', mx6: 'MX6-1005', start: 'EST-10' },
  { id: 'MIN-06', name: 'Paula Cárdenas', role: 'Electricista', mx6: 'MX6-1006', start: 'EST-12' },
  { id: 'MIN-07', name: 'Mauricio Peña', role: 'Operador de ventilación', mx6: 'MX6-1007', start: 'EST-14' },
  { id: 'MIN-08', name: 'Sandra Quintero', role: 'Supervisora de SST', mx6: 'MX6-1008', start: 'EST-16' },
  { id: 'MIN-09', name: 'Hernán Londoño', role: 'Mecánico', mx6: 'MX6-1009', start: 'EST-18' },
  { id: 'MIN-10', name: 'Yeison Ramírez', role: 'Topógrafo', mx6: 'MX6-1010', start: 'EST-21' },
];

/** Batería inicial de estaciones (una baja para mostrar alertas de mantenimiento). */
export const STATION_BATTERY_START: Record<string, number> = { 'EST-05': 18 };
export const LAST_CALIBRATION = ['2026-10-02', '2026-10-09', '2026-10-14', '2026-10-21'];
