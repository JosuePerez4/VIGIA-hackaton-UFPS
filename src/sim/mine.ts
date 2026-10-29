/** Geometría estática de la mina simulada. Unidades: metros. */

export type GalleryId = 'principal' | 'norte' | 'sur' | 'este';

export const GALLERY_NAMES: Record<GalleryId, string> = {
  principal: 'Galería principal',
  norte: 'Ramal norte',
  sur: 'Ramal sur',
  este: 'Ramal este',
};

export interface MineNode {
  id: string;
  name: string;
  gallery: GalleryId | 'entrada';
  x: number;
  z: number;
}

export const ENTRY_ID = 'ENT-00';

const nodes: MineNode[] = [
  { id: ENTRY_ID, name: 'Entrada · dispositivo de procesamiento', gallery: 'entrada', x: 0, z: 0 },
];

function addStation(gallery: GalleryId, x: number, z: number) {
  const index = nodes.length;
  nodes.push({
    id: `EST-${String(index).padStart(2, '0')}`,
    name: `Estación ${String(index).padStart(2, '0')} · ${GALLERY_NAMES[gallery]}`,
    gallery,
    x,
    z,
  });
}

// Galería principal: 9 estaciones cada 40 m desde la entrada.
for (let i = 1; i <= 9; i++) addStation('principal', 40 * i, 0);
// Ramales: 3 + 3 + 2 estaciones, también cada 40 m.
for (let j = 1; j <= 3; j++) addStation('norte', 160, -40 * j);
for (let j = 1; j <= 3; j++) addStation('sur', 240, 40 * j);
for (let j = 1; j <= 2; j++) addStation('este', 360, -40 * j);

export const NODES: MineNode[] = nodes;
export const STATION_IDS = nodes.filter((n) => n.id !== ENTRY_ID).map((n) => n.id);
export const NODE_BY_ID: Record<string, MineNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));

/** Adyacencia por distancia (≤ 40 m): sirve para propagación de gas y rutas de evacuación. */
export const ADJACENCY: Record<string, string[]> = Object.fromEntries(
  nodes.map((a) => [
    a.id,
    nodes
      .filter((b) => b.id !== a.id && Math.hypot(a.x - b.x, a.z - b.z) <= 40.5)
      .map((b) => b.id),
  ]),
);

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

/** Ruta más corta entre dos nodos (incluye origen y destino). */
export function shortestPath(from: string, to: string): string[] {
  const prev: Record<string, string | null> = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const current = queue.shift() as string;
    if (current === to) break;
    for (const next of ADJACENCY[current] ?? []) {
      if (!(next in prev)) {
        prev[next] = current;
        queue.push(next);
      }
    }
  }
  if (!(to in prev)) return [];
  const path: string[] = [];
  for (let node: string | null = to; node !== null; node = prev[node]) path.unshift(node);
  return path;
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
  { id: 'MIN-06', name: 'Paula Cárdenas', role: 'Electricista', mx6: 'MX6-1006', start: 'EST-11' },
  { id: 'MIN-07', name: 'Mauricio Peña', role: 'Operador de ventilación', mx6: 'MX6-1007', start: 'EST-13' },
  { id: 'MIN-08', name: 'Sandra Quintero', role: 'Supervisora de SST', mx6: 'MX6-1008', start: 'EST-15' },
  { id: 'MIN-09', name: 'Hernán Londoño', role: 'Mecánico', mx6: 'MX6-1009', start: 'EST-16' },
  { id: 'MIN-10', name: 'Yeison Ramírez', role: 'Topógrafo', mx6: 'MX6-1010', start: 'EST-17' },
];

/** Batería inicial y calibración por estación (datos simulados). */
export const STATION_BATTERY_START: Record<string, number> = { 'EST-05': 18 };
export const LAST_CALIBRATION = ['2026-10-02', '2026-10-09', '2026-10-14', '2026-10-21'];
