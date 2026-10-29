import { create } from 'zustand';
import { DEFAULT_THRESHOLDS, type GasKey, type GasThreshold } from '@/config/thresholds';
import { engine } from '@/sim/engine';
import type { ScenarioId } from '@/sim/scenarios';
import type { MineSnapshot } from '@/sim/types';

type Thresholds = Record<GasKey, GasThreshold>;

export interface MapLayers {
  /** Cables de fibra que van de cada estación hasta el receptor y la base. */
  cables: boolean;
  /** Enlaces inalámbricos de cada MX6 con su estación. */
  wireless: boolean;
}

interface UiState {
  layers: MapLayers;
  speed: 1 | 2 | 5;
  paused: boolean;
  /** Estación elegida en el selector antes de lanzar un escenario. */
  pendingTarget: string;
  selectedStationId: string | null;
  selectedWorkerId: string | null;
  selectedGas: GasKey;
  heatGas: GasKey | null;
  thresholds: Thresholds;
  /** Id de la última alerta de Nivel 3 cuyo aviso a pantalla completa fue cerrado. */
  dismissedEmergencyId: number | null;
}

export interface VigiaStore extends MineSnapshot, UiState {
  step: (seconds: number) => void;
  setSpeed: (speed: 1 | 2 | 5) => void;
  togglePause: () => void;
  launch: (scenario: ScenarioId, target?: string) => void;
  reset: () => void;
  setPendingTarget: (id: string) => void;
  acknowledge: (alertId: number) => void;
  acknowledgeAll: () => void;
  dismissEmergency: () => void;
  selectStation: (id: string | null) => void;
  selectWorker: (id: string | null) => void;
  selectGas: (gas: GasKey) => void;
  setHeatGas: (gas: GasKey | null) => void;
  toggleLayer: (layer: keyof MapLayers) => void;
  updateThreshold: (gas: GasKey, patch: Partial<Pick<GasThreshold, 'level1' | 'level2' | 'level3' | 'fastRate'>>) => void;
  restoreThresholds: () => void;
}

const initialThresholds = structuredClone(DEFAULT_THRESHOLDS);

export const useVigia = create<VigiaStore>()((set, get) => ({
  ...engine.snapshot(),
  layers: { cables: true, wireless: false },
  speed: 1,
  paused: false,
  pendingTarget: 'EST-08',
  selectedStationId: null,
  selectedWorkerId: null,
  selectedGas: 'CH4',
  heatGas: null,
  thresholds: initialThresholds,
  dismissedEmergencyId: null,

  step: (seconds) => {
    if (get().paused) return;
    set(engine.advance(seconds));
  },

  setSpeed: (speed) => set({ speed }),

  togglePause: () => set((state) => ({ paused: !state.paused })),

  launch: (scenario, target) => {
    const chosen = target ?? get().pendingTarget;
    engine.reset(scenario, chosen);
    set({ ...engine.snapshot(), paused: false, dismissedEmergencyId: null });
  },

  reset: () => {
    const { scenario, target } = get();
    engine.reset(scenario, target);
    set({ ...engine.snapshot(), paused: false, dismissedEmergencyId: null });
  },

  setPendingTarget: (id) => set({ pendingTarget: id }),

  acknowledge: (alertId) => {
    engine.acknowledge(alertId);
    set({ alerts: engine.snapshot().alerts });
  },

  acknowledgeAll: () => {
    engine.acknowledgeAll();
    set({ alerts: engine.snapshot().alerts });
  },

  dismissEmergency: () => {
    const latest3 = [...get().alerts].reverse().find((a) => a.level === 3);
    set({ dismissedEmergencyId: latest3?.id ?? null });
  },

  selectStation: (id) => set({ selectedStationId: id, selectedWorkerId: null }),

  selectWorker: (id) => set({ selectedWorkerId: id, selectedStationId: null }),

  selectGas: (gas) => set({ selectedGas: gas }),

  setHeatGas: (gas) => set({ heatGas: gas }),

  toggleLayer: (layer) => set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),

  updateThreshold: (gas, patch) => {
    const thresholds = { ...get().thresholds, [gas]: { ...get().thresholds[gas], ...patch } };
    engine.setThresholds(thresholds);
    set({ thresholds });
  },

  restoreThresholds: () => {
    const thresholds = structuredClone(DEFAULT_THRESHOLDS);
    engine.setThresholds(thresholds);
    set({ thresholds });
  },
}));
