'use client';

import { useState } from 'react';
import { buttonActive, buttonIdle } from '@/components/ui/primitives';

const DEVICES = [
  { id: 'sentro8', label: 'Trolex Sentro 8', src: '/devices/sentro8.html', title: 'Vista explosionada de la estación Trolex Sentro 8' },
  { id: 'mx6', label: 'MX6 iBrid', src: '/devices/mx6.html', title: 'Vista del dispositivo MX6 iBrid, explosionado y puesto en el cuerpo' },
] as const;

export function DevicesView() {
  const [selected, setSelected] = useState<(typeof DEVICES)[number]['id']>('sentro8');
  const device = DEVICES.find((d) => d.id === selected) ?? DEVICES[0];

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Dispositivo" className="flex flex-wrap gap-2">
        {DEVICES.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === selected}
            onClick={() => setSelected(d.id)}
            className={d.id === selected ? buttonActive : buttonIdle}
          >
            {d.label}
          </button>
        ))}
      </div>
      <iframe
        key={device.id}
        src={device.src}
        title={device.title}
        loading="lazy"
        sandbox="allow-scripts"
        className="h-[calc(100dvh-12rem)] min-h-[32rem] w-full rounded-md border border-line bg-canvas"
      />
    </div>
  );
}
