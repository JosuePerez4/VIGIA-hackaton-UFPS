'use client';

import { LevelPill, Metric, Panel } from '@/components/ui/primitives';
import {
  GAS_ORDER,
  LEVEL_META,
  levelFor,
  type GasKey,
  type GasThreshold,
  type Level,
} from '@/config/thresholds';
import { useVigia } from '@/store/vigia-store';
import { LiveChart } from './LiveChart';

export function PanelView() {
  const stations = useVigia((s) => s.stations);
  const workers = useVigia((s) => s.workers);
  const alerts = useVigia((s) => s.alerts);
  const mineLevel = useVigia((s) => s.mineLevel);
  const timeline = useVigia((s) => s.timeline);
  const representative = useVigia((s) => s.representative);
  const thresholds = useVigia((s) => s.thresholds);
  const selectedGas = useVigia((s) => s.selectedGas);
  const selectGas = useVigia((s) => s.selectGas);

  const online = stations.filter((s) => s.online).length;
  const activeAlerts = alerts.filter((a) => a.status === 'activa').length;

  const recent = [...timeline].reverse().slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Estado general de la mina" value={LEVEL_META[mineLevel].mineLabel} tone={mineLevel} />
        <Metric label="Mineros en recorrido" value={workers.length} footnote="Cada uno con su MX6 midiendo" />
        <Metric label="Alertas activas" value={activeAlerts} tone={activeAlerts > 0 ? maxActiveLevel(alerts) : 0} />
        <Metric label="Estaciones en línea" value={online} unit={`de ${stations.length}`} />
      </div>

      <Panel title="Gases en vivo" description="Valor representativo de toda la mina: la estación con mayor concentración (o menor, para O₂ y velocidad del aire).">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {GAS_ORDER.map((gas) => (
            <GasCard
              key={gas}
              gas={gas}
              avg={representative[gas]?.avg ?? 0}
              raw={representative[gas]?.raw ?? 0}
              stationId={representative[gas]?.stationId ?? ''}
              thresholds={thresholds}
              selected={gas === selectedGas}
              onSelect={() => selectGas(gas)}
            />
          ))}
        </div>
      </Panel>

      <Panel
        title={`Canal rápido y canal lento · ${thresholds[selectedGas].label}`}
        description="Línea discontinua: canal rápido (dC/dt, alerta en menos de 2 s). Línea continua: promedio móvil de 40 s, registro oficial."
      >
        <LiveChart gas={selectedGas} />
      </Panel>

      <Panel title="Eventos recientes" description="Últimos eventos de la mina. El detalle completo está en el centro de alertas.">
        {recent.length === 0 ? (
          <p className="text-ink-muted">Sin eventos todavía.</p>
        ) : (
          <ol className="divide-y divide-line">
            {recent.map((entry) => (
              <li key={entry.id} className="grid grid-cols-[auto_auto_1fr] items-center gap-4 py-3">
                <time className="font-mono text-sm tabular-nums text-ink-muted">{entry.time}</time>
                <LevelPill level={entry.tone} compact />
                <span className="text-ink">{entry.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function maxActiveLevel(alerts: { status: string; level: Level }[]): Level {
  return alerts.reduce<Level>((max, a) => (a.status === 'activa' && a.level > max ? a.level : max), 0);
}

function GasCard({
  gas,
  avg,
  raw,
  stationId,
  thresholds,
  selected,
  onSelect,
}: {
  gas: GasKey;
  avg: number;
  raw: number;
  stationId: string;
  thresholds: Record<GasKey, GasThreshold>;
  selected: boolean;
  onSelect: () => void;
}) {
  const threshold = thresholds[gas];
  const level = levelFor(avg, threshold);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col gap-2 rounded-md border p-4 text-left transition-colors ${
        selected ? 'border-ink bg-panel-2' : 'border-line bg-panel hover:border-ink-muted'
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink-muted">{threshold.label}</span>
      </span>
      <span className="font-display text-4xl font-semibold leading-none tabular-nums text-ink">
        {avg.toFixed(threshold.decimals)}
        <span className="ml-1 text-base font-medium text-ink-muted">{threshold.unit}</span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <LevelPill level={level} compact />
        <span className="tabular-nums">
          rápido {raw.toFixed(threshold.decimals)} · {stationId}
        </span>
      </span>
    </button>
  );
}
