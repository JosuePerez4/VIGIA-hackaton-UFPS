'use client';

import { Panel, buttonIdle } from '@/components/ui/primitives';
import { GAS_ORDER, type GasKey } from '@/config/thresholds';
import { useVigia } from '@/store/vigia-store';

type NumericField = 'level1' | 'level2' | 'level3' | 'fastRate';

export function ThresholdsView() {
  const thresholds = useVigia((s) => s.thresholds);
  const updateThreshold = useVigia((s) => s.updateThreshold);
  const restore = useVigia((s) => s.restoreThresholds);

  const onChange = (gas: GasKey, field: NumericField, raw: string) => {
    const value = Number(raw);
    if (raw.trim() === '' || Number.isNaN(value)) return;
    updateThreshold(gas, { [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-lvl1/40 bg-panel p-5 text-sm text-ink">
        <p className="font-medium">Valores de ejemplo, no son valores legales.</p>
        <p className="mt-1 text-ink-muted">
          Estos umbrales se ajustarán con el Decreto 1886 de 2015 y el Decreto 944 de 2022. Los cambios se aplican en vivo al
          motor de simulación. Los valores también están en <code className="font-mono">src/config/thresholds.ts</code>.
        </p>
      </div>

      <Panel
        title="Umbrales por gas"
        description="Nivel 1: precaución. Nivel 2: alerta. Nivel 3: emergencia. El canal rápido dispara una alerta temprana cuando la tasa de cambio supera el valor indicado."
        actions={
          <button type="button" onClick={restore} className={buttonIdle}>
            Restaurar valores por defecto
          </button>
        }
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[50rem] border-collapse text-left text-sm">
            <caption className="sr-only">Umbrales de alerta por gas y nivel</caption>
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Gas</th>
                <th scope="col" className="py-2 pr-4 font-medium">Sentido de peligro</th>
                <th scope="col" className="py-2 pr-4 font-medium">Nivel 1</th>
                <th scope="col" className="py-2 pr-4 font-medium">Nivel 2</th>
                <th scope="col" className="py-2 pr-4 font-medium">Nivel 3</th>
                <th scope="col" className="py-2 font-medium">Canal rápido (tasa / s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {GAS_ORDER.map((gas) => {
                const t = thresholds[gas];
                return (
                  <tr key={gas}>
                    <td className="py-3 pr-4">
                      <span className="block font-medium text-ink">{t.label}</span>
                      <span className="text-xs text-ink-muted">{t.unit}</span>
                    </td>
                    <td className="py-3 pr-4 text-ink-muted">{t.direction === 'above' ? 'Sube' : 'Baja'}</td>
                    <NumberCell label={`${t.label} nivel 1`} value={t.level1} step={Math.pow(10, -t.decimals)} onChange={(v) => onChange(gas, 'level1', v)} />
                    <NumberCell label={`${t.label} nivel 2`} value={t.level2} step={Math.pow(10, -t.decimals)} onChange={(v) => onChange(gas, 'level2', v)} />
                    <NumberCell label={`${t.label} nivel 3`} value={t.level3} step={Math.pow(10, -t.decimals)} onChange={(v) => onChange(gas, 'level3', v)} />
                    <NumberCell label={`${t.label} canal rápido`} value={t.fastRate} step={0.01} onChange={(v) => onChange(gas, 'fastRate', v)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function NumberCell({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (raw: string) => void;
}) {
  return (
    <td className="py-3 pr-4">
      <input
        type="number"
        aria-label={label}
        value={value}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="w-28 rounded-sm border border-line bg-panel-2 px-2.5 py-1.5 tabular-nums text-ink"
      />
    </td>
  );
}
