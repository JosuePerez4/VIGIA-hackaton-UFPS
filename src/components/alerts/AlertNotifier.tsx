'use client';

import { useEffect, useRef, useState } from 'react';
import { LevelPill, buttonIdle } from '@/components/ui/primitives';
import { downloadIncidentReport } from '@/lib/reports';
import { NODE_BY_ID } from '@/sim/mine';
import type { AlertRecord } from '@/sim/types';
import { useVigia } from '@/store/vigia-store';

const SOUND_SRC = '/sounds/alerta.mp3';
const TOAST_MS = 8000;
const MAX_TOASTS = 3;

interface Toast {
  key: number;
  alert: AlertRecord;
}

/**
 * Avisa de cada alerta nueva: reproduce el sonido y muestra un aviso en pantalla.
 * Se suscribe al store fuera del render, así no provoca renders en cascada.
 */
export function AlertNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [muted, setMuted] = useState(false);
  const thresholds = useVigia((s) => s.thresholds);
  const mutedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(SOUND_SRC);
    audio.preload = 'auto';
    audioRef.current = audio;

    // Los navegadores bloquean el audio hasta el primer gesto del usuario. Se desbloquea en el primer clic o tecla.
    const unlock = () => {
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => undefined);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    let lastSeen = useVigia.getState().alerts.reduce((max, a) => Math.max(max, a.id), 0);
    let nextKey = 0;

    const unsubscribe = useVigia.subscribe((state, previous) => {
      if (state.alerts === previous.alerts) return;
      const fresh = state.alerts.filter((a) => a.id > lastSeen && a.status === 'activa');
      lastSeen = state.alerts.reduce((max, a) => Math.max(max, a.id), lastSeen);
      if (fresh.length === 0) return;

      if (!mutedRef.current) {
        audio.currentTime = 0;
        audio.play().catch(() => undefined);
      }

      const added = fresh.slice(-MAX_TOASTS).map((alert) => ({ key: ++nextKey, alert }));
      setToasts((current) => [...added.reverse(), ...current].slice(0, MAX_TOASTS));
      for (const toast of added) {
        window.setTimeout(() => setToasts((current) => current.filter((t) => t.key !== toast.key)), TOAST_MS);
      }
    });

    return () => {
      unsubscribe();
      audio.pause();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleMuted = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  const dismiss = (key: number) => setToasts((current) => current.filter((t) => t.key !== key));

  return (
    <div className="no-print pointer-events-none fixed bottom-4 right-4 z-40 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <div className="pointer-events-auto flex justify-end">
        <button type="button" onClick={toggleMuted} aria-pressed={muted} className={`${buttonIdle} py-1 text-xs`}>
          {muted ? 'Sonido de alerta: apagado' : 'Sonido de alerta: encendido'}
        </button>
      </div>
      <div aria-live="assertive" role="status" className="flex flex-col gap-2">
        {toasts.map(({ key, alert }) => {
          const station = NODE_BY_ID[alert.stationId];
          const threshold = thresholds[alert.gas];
          return (
            <div key={key} className="pointer-events-auto rounded-md border border-line bg-panel p-4 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <LevelPill level={alert.level} compact />
                  <p className="font-medium text-ink">{threshold.label}</p>
                  <p className="text-sm text-ink-muted">
                    {alert.stationId} · {station?.name.split(' · ')[1]}
                  </p>
                  <p className="tabular-nums text-sm text-ink">
                    {alert.value.toFixed(threshold.decimals)} {threshold.unit} · {alert.time}
                  </p>
                  {alert.level >= 2 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const s = useVigia.getState();
                        downloadIncidentReport(s, alert, s.thresholds);
                      }}
                      className={`${buttonIdle} mt-1 self-start py-1 text-xs`}
                    >
                      Descargar reporte
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(key)}
                  aria-label="Cerrar aviso de alerta"
                  className="rounded-sm px-2 py-1 text-ink-muted hover:text-ink"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
