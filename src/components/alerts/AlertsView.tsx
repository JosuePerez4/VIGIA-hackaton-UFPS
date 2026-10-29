'use client';

import { useState } from 'react';
import { LevelPill, Panel, buttonActive, buttonIdle } from '@/components/ui/primitives';
import { LEVEL_ACTIONS, type Level } from '@/config/thresholds';
import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

type LevelFilter = 'todos' | '1' | '2' | '3';
type StatusFilter = 'todos' | 'activa' | 'escalada' | 'resuelta';

export function AlertsView() {
  const alerts = useVigia((s) => s.alerts);
  const latched = useVigia((s) => s.latched);
  const thresholds = useVigia((s) => s.thresholds);
  const acknowledge = useVigia((s) => s.acknowledge);
  const acknowledgeAll = useVigia((s) => s.acknowledgeAll);

  const [levelFilter, setLevelFilter] = useState<LevelFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  const rows = [...alerts]
    .reverse()
    .filter((a) => levelFilter === 'todos' || a.level === Number(levelFilter))
    .filter((a) => statusFilter === 'todos' || a.status === statusFilter);

  const activeLevel = (min: Level) => alerts.some((a) => a.status === 'activa' && a.level >= min);
  const pendingCount = alerts.filter((a) => a.status === 'activa' && !a.acknowledged).length;

  const actionStates: { level: 1 | 2 | 3; active: boolean; detail: string }[] = [
    { level: 1, active: activeLevel(1), detail: 'Se activa con cualquier alerta activa de Nivel 1 o superior.' },
    { level: 2, active: activeLevel(2), detail: 'Se activa con alertas de Nivel 2 o superior.' },
    {
      level: 3,
      active: latched.powerCut,
      detail: `Corte eléctrico: ${latched.powerCut ? 'sí' : 'no'} · Ventiladores: ${latched.fansMax ? 'máximo' : 'normal'} · Evacuación: ${latched.evacuation ? 'iniciada' : 'no'}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {actionStates.map((item) => (
          <div key={item.level} className="rounded-md border border-line bg-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <LevelPill level={item.level} />
              <span className={`text-sm font-medium ${item.active ? 'text-ink' : 'text-ink-muted'}`}>
                {item.active ? 'Acción ejecutada' : 'En espera'}
              </span>
            </div>
            <p className="mt-3 font-medium text-ink">{LEVEL_ACTIONS[item.level]}</p>
            <p className="mt-1 text-sm text-ink-muted">{item.detail}</p>
          </div>
        ))}
      </div>

      <Panel
        title="Alertas"
        description={`${pendingCount} sin reconocer. Cada cambio de nivel queda registrado con su hora, ubicación y valor.`}
        actions={
          <>
            <FilterGroup
              label="Nivel"
              value={levelFilter}
              onChange={(v) => setLevelFilter(v as LevelFilter)}
              options={[
                ['todos', 'Todos'],
                ['1', 'Nivel 1'],
                ['2', 'Nivel 2'],
                ['3', 'Nivel 3'],
              ]}
            />
            <FilterGroup
              label="Estado"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                ['todos', 'Todos'],
                ['activa', 'Activas'],
                ['escalada', 'Escaladas'],
                ['resuelta', 'Resueltas'],
              ]}
            />
            <button type="button" onClick={acknowledgeAll} disabled={pendingCount === 0} className={buttonIdle}>
              Reconocer todas
            </button>
          </>
        }
      >
        {rows.length === 0 ? (
          <p className="py-8 text-center text-ink-muted">No hay alertas con este filtro.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <caption className="sr-only">Alertas de la mina, de la más reciente a la más antigua</caption>
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Hora</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Nivel</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Ubicación</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Gas</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Canal</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Acción automática</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Estado</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((alert) => {
                  const threshold = thresholds[alert.gas];
                  const canAck = alert.status === 'activa' && !alert.acknowledged;
                  return (
                    <tr key={alert.id} className="align-middle">
                      <td className="py-3 pr-4 tabular-nums text-ink-muted">{alert.time}</td>
                      <td className="py-3 pr-4"><LevelPill level={alert.level} compact /></td>
                      <td className="py-3 pr-4 text-ink">
                        <span className="font-medium">{alert.stationId}</span>
                        <span className="block text-xs text-ink-muted">{NODE_BY_ID[alert.stationId]?.name.split(' · ')[1]}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink">{threshold.label}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-ink">
                        {alert.value.toFixed(threshold.decimals)} <span className="text-ink-muted">{threshold.unit}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink-muted">{alert.channel === 'rápido' ? 'Rápido' : 'Lento (oficial)'}</td>
                      <td className="py-3 pr-4 text-ink-muted">{LEVEL_ACTIONS[alert.level as Exclude<Level, 0>]}</td>
                      <td className="py-3 pr-4 text-ink-muted capitalize">{alert.status}</td>
                      <td className="py-3 text-right">
                        {canAck ? (
                          <button type="button" onClick={() => acknowledge(alert.id)} className={buttonActive}>
                            Reconocer
                          </button>
                        ) : (
                          <span className="text-ink-muted">{alert.acknowledged ? 'Reconocida' : '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={value === key ? buttonActive : buttonIdle}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
