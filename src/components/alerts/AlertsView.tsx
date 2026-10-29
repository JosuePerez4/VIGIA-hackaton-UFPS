'use client';

import { useState } from 'react';
import { LevelPill, Metric, Panel, buttonActive, buttonIdle } from '@/components/ui/primitives';
import { gasThreshold, type Level } from '@/config/thresholds';
import { downloadAlertsCsv, downloadIncidentReport, downloadTurnReport } from '@/lib/reports';
import { NODE_BY_ID } from '@/sim/mine';
import { useVigia } from '@/store/vigia-store';

/** Snapshot completo del store en el momento del clic (no se suscribe a cada tick). */
const current = () => useVigia.getState();

type LevelFilter = 'todos' | '1' | '2' | '3';
type StatusFilter = 'todos' | 'activa' | 'escalada' | 'resuelta';

export function AlertsView() {
  const alerts = useVigia((s) => s.alerts);
  const thresholds = useVigia((s) => s.thresholds);
  const acknowledge = useVigia((s) => s.acknowledge);
  const acknowledgeAll = useVigia((s) => s.acknowledgeAll);

  const [levelFilter, setLevelFilter] = useState<LevelFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  const rows = [...alerts]
    .reverse()
    .filter((a) => levelFilter === 'todos' || a.level === Number(levelFilter))
    .filter((a) => statusFilter === 'todos' || a.status === statusFilter);

  const active = alerts.filter((a) => a.status === 'activa');
  const pendingCount = active.filter((a) => !a.acknowledged).length;
  const countAt = (level: Level) => active.filter((a) => a.level === level).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Alertas de Nivel 1 activas" value={countAt(1)} tone={countAt(1) > 0 ? 1 : 0} />
        <Metric label="Alertas de Nivel 2 activas" value={countAt(2)} tone={countAt(2) > 0 ? 2 : 0} />
        <Metric label="Alertas de Nivel 3 activas" value={countAt(3)} tone={countAt(3) > 0 ? 3 : 0} />
      </div>

      <Panel
        title="Alertas"
        description={`${pendingCount} sin reconocer`}
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
            <button type="button" onClick={() => downloadTurnReport(current(), current().thresholds)} className={buttonIdle}>
              Reporte del turno (PDF)
            </button>
            <button type="button" onClick={() => downloadAlertsCsv(current(), current().thresholds)} className={buttonIdle}>
              CSV de alertas
            </button>
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
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <caption className="sr-only">Alertas de la mina, de la más reciente a la más antigua</caption>
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Hora</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Nivel</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Ubicación</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Gas</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Canal</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Estado</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((alert) => {
                  const threshold = gasThreshold(alert.gas, thresholds);
                  const canAck = alert.status === 'activa' && !alert.acknowledged;
                  return (
                    <tr key={alert.id} className="align-middle">
                      <td className="py-3 pr-4 tabular-nums text-ink-muted">{alert.time}</td>
                      <td className="py-3 pr-4"><LevelPill level={alert.level} compact /></td>
                      <td className="py-3 pr-4 text-ink">
                        <span className="font-medium">{alert.stationId}</span>
                        <span className="block text-xs text-ink-muted">{NODE_BY_ID[alert.stationId]?.name.split(' · ')[1]}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink">{alert.kind === 'equipo' ? alert.detail : threshold.label}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-ink">
                        {alert.kind === 'equipo' ? '—' : alert.value.toFixed(threshold.decimals)} <span className="text-ink-muted">{threshold.unit}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink-muted">{alert.channel === 'rápido' ? 'Rápido' : 'Lento (oficial)'}</td>
                      <td className="py-3 pr-4 capitalize text-ink-muted">{alert.status}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => downloadIncidentReport(current(), alert, current().thresholds)}
                            className={buttonIdle}
                          >
                            Reporte PDF
                          </button>
                          {canAck ? (
                            <button type="button" onClick={() => acknowledge(alert.id)} className={buttonActive}>
                              Reconocer
                            </button>
                          ) : (
                            <span className="self-center text-ink-muted">{alert.acknowledged ? 'Reconocida' : '—'}</span>
                          )}
                        </div>
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
