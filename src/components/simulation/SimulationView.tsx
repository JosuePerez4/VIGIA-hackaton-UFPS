'use client';

import { LevelPill, Panel, buttonActive, buttonIdle } from '@/components/ui/primitives';
import { NODE_BY_ID, STATION_IDS } from '@/sim/mine';
import { SCENARIOS, SCENARIO_BY_ID } from '@/sim/scenarios';
import { useVigia } from '@/store/vigia-store';

const formatT = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function SimulationView() {
  const scenario = useVigia((s) => s.scenario);
  const elapsed = useVigia((s) => s.elapsed);
  const target = useVigia((s) => s.target);
  const paused = useVigia((s) => s.paused);
  const speed = useVigia((s) => s.speed);
  const pendingTarget = useVigia((s) => s.pendingTarget);
  const timeline = useVigia((s) => s.timeline);
  const launch = useVigia((s) => s.launch);
  const reset = useVigia((s) => s.reset);
  const togglePause = useVigia((s) => s.togglePause);
  const setSpeed = useVigia((s) => s.setSpeed);
  const setPendingTarget = useVigia((s) => s.setPendingTarget);

  const definition = SCENARIO_BY_ID[scenario];
  const log = [...timeline].reverse().slice(0, 40);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Panel
          title="Escenarios"
          description="Cada escenario actualiza el panel, el mapa, las alertas y el personal a la vez. Atajos durante la presentación: teclas 1 a 5, espacio para pausar, R para reiniciar."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {SCENARIOS.map((item) => {
              const active = item.id === scenario;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => launch(item.id)}
                  aria-pressed={active}
                  className={`flex flex-col gap-2 rounded-md border p-4 text-left transition-colors ${
                    active ? 'border-ink bg-panel-2' : 'border-line bg-panel hover:border-ink-muted'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-xl font-semibold text-ink">{item.name}</span>
                    <kbd className="rounded-sm border border-line px-2 py-0.5 font-mono text-xs text-ink-muted">{item.shortcut}</kbd>
                  </span>
                  <span className="text-sm text-ink-muted">{item.description}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Control" description="Velocidad, pausa y punto del evento.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5 text-sm text-ink-muted">
                Estación donde ocurre el evento
                <select
                  value={pendingTarget}
                  onChange={(event) => setPendingTarget(event.target.value)}
                  className="rounded-sm border border-line bg-panel-2 px-3 py-2 text-ink"
                >
                  {STATION_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id} · {NODE_BY_ID[id].name.split(' · ')[1]}
                    </option>
                  ))}
                </select>
              </label>
              {definition.needsTarget ? (
                <p className="max-w-sm text-sm text-ink-muted">
                  Este escenario usa la estación elegida. Al lanzarlo con una tecla también se usa esta estación.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={togglePause} className={buttonIdle}>
                {paused ? 'Reanudar' : 'Pausar'}
              </button>
              <button type="button" onClick={reset} className={buttonIdle}>
                Reiniciar mina
              </button>
              <div role="group" aria-label="Velocidad de simulación" className="flex items-center gap-1">
                {([1, 2, 5] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSpeed(value)}
                    aria-pressed={speed === value}
                    className={speed === value ? buttonActive : buttonIdle}
                  >
                    {value}x
                  </button>
                ))}
              </div>
              <p className="ml-auto tabular-nums text-ink-muted">
                T+{formatT(elapsed)} · {target}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title={`Línea de tiempo · ${definition.name}`} description="Etapas del escenario según avanza el reloj.">
          <ol className="space-y-3">
            {definition.steps.map((step, index) => {
              const done = elapsed >= step.at;
              return (
                <li key={index} className="grid grid-cols-[auto_1fr] gap-4">
                  <span className="flex flex-col items-center">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-3 rounded-full border ${done ? 'border-ink bg-ink' : 'border-line'}`}
                    />
                    {index < definition.steps.length - 1 ? <span className="mt-1 h-full w-px bg-line" /> : null}
                  </span>
                  <div className="pb-3">
                    <p className="tabular-nums text-sm text-ink-muted">
                      T+{formatT(step.at)} · {done ? 'Completado' : 'Pendiente'}
                    </p>
                    <p className={done ? 'text-ink' : 'text-ink-muted'}>{step.text(target)}</p>
                    <div className="mt-1">
                      <LevelPill level={step.tone} compact />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel title="Registro de eventos" description="Eventos reales generados por el motor (cambios de nivel y acciones).">
          {log.length === 0 ? (
            <p className="text-ink-muted">Sin eventos todavía.</p>
          ) : (
            <ol className="max-h-[28rem] divide-y divide-line overflow-y-auto">
              {log.map((entry) => (
                <li key={entry.id} className="grid grid-cols-[auto_1fr] gap-3 py-2.5 text-sm">
                  <time className="tabular-nums text-ink-muted">{entry.time}</time>
                  <span className="text-ink">{entry.text}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
