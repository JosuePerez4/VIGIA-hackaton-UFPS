'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GasKey } from '@/config/thresholds';
import { clockFromElapsed } from '@/sim/engine';
import { useVigia } from '@/store/vigia-store';

export function LiveChart({ gas }: { gas: GasKey }) {
  const series = useVigia((s) => s.series[gas]);
  const startSeconds = useVigia((s) => s.startSeconds);
  const threshold = useVigia((s) => s.thresholds[gas]);
  const { decimals, unit, label } = threshold;

  return (
    <div className="h-72 w-full" role="img" aria-label={`Gráfica en vivo de ${label}: canal rápido y canal lento`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1f2b37" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value) => clockFromElapsed(Number(value), startSeconds)}
            stroke="#8a9aab"
            tick={{ fontSize: 12, fill: '#8a9aab' }}
            minTickGap={48}
          />
          <YAxis
            stroke="#8a9aab"
            tick={{ fontSize: 12, fill: '#8a9aab' }}
            width={64}
            domain={['auto', 'auto']}
            tickFormatter={(value) => Number(value).toFixed(decimals)}
          />
          <Tooltip
            contentStyle={{ background: '#111820', border: '1px solid #1f2b37', borderRadius: 4, color: '#e8eef4' }}
            labelFormatter={(value) => clockFromElapsed(Number(value), startSeconds)}
            formatter={(value, name) => [`${Number(value).toFixed(decimals)} ${unit}`, String(name)]}
          />
          <ReferenceLine y={threshold.level1} stroke="#facc15" strokeDasharray="2 4" />
          <ReferenceLine y={threshold.level2} stroke="#fb923c" strokeDasharray="2 4" />
          <ReferenceLine y={threshold.level3} stroke="#f43f5e" strokeDasharray="2 4" />
          <Line
            type="monotone"
            dataKey="fast"
            name="Canal rápido"
            stroke="#8a9aab"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="slow"
            name="Canal lento (oficial)"
            stroke="#e8eef4"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
