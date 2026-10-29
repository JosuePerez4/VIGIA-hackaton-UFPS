'use client';

import { useEffect, useRef, useState } from 'react';
import { LevelPill, buttonIdle } from '@/components/ui/primitives';
import { gasThreshold } from '@/config/thresholds';
import { downloadIncidentReport } from '@/lib/reports';
import { NODE_BY_ID } from '@/sim/mine';
import type { AlertRecord } from '@/sim/types';
import { useVigia } from '@/store/vigia-store';

const SOUND_SRC = '/sounds/alerta.mp3';
const TOAST_MS = 8000;
const MAX_TOASTS = 3;

interface Toast {
  key: number;
  /** Un caso = una estación y un gas. Varias alertas del mismo caso se muestran en un solo aviso. */
  episode: string;
  alert: AlertRecord;
}

const episodeOf = (alert: AlertRecord) => `${alert.stationId}|${alert.gas}`;

/**
 * Avisa de cada caso nuevo: reproduce el sonido y muestra un aviso en pantalla.
 * Si el mismo caso escala de nivel, el aviso se actualiza en lugar de repetirse.
 */
export function AlertNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [muted, setMuted] = useState(false);
  const thresholds = useVigia((s) => s.thresholds);
  const mutedRef = useRef(false);
  const toastsRef = useRef<Toast[]>([]);
  const timersRef = useRef(new Map<number, number>());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(SOUND_SRC);
    audio.preload = 'auto';
    audioRef.current = audio;
    const timers = timersRef.current;

    // Los navegadores bloquean el audio hasta el primer gesto del usuario.
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

    const commit = (list: Toast[]) => {
      toastsRef.current = list;
      setToasts(list);
    };

    const schedule = (key: number) => {
      const previous = timers.get(key);
      if (previous !== undefined) window.clearTimeout(previous);
      timers.set(
        key,
        window.setTimeout(() => {
          timers.delete(key);
          commit(toastsRef.current.filter((t) => t.key !== key));
        }, TOAST_MS),
      );
    };

    let lastSeen = useVigia.getState().alerts.reduce((max, a) => Math.max(max, a.id), 0);
    let nextKey = 0;

    const unsubscribe = useVigia.subscribe((state, previous) => {
      if (state.alerts === previous.alerts) return;
      const fresh = state.alerts.filter((a) => a.id > lastSeen && a.status === 'activa');
      lastSeen = state.alerts.reduce((max, a) => Math.max(max, a.id), lastSeen);
      if (fresh.length === 0) return;

      // Por caso, solo cuenta la alerta más reciente.
      const newest = new Map<string, AlertRecord>();
      for (const alert of fresh) newest.set(episodeOf(alert), alert);

      let sound = false;
      let list = [...toastsRef.current];
      for (const [episode, alert] of newest) {
        const index = list.findIndex((t) => t.episode === episode);
        if (index >= 0) {
          const existing = list[index];
          if (alert.level > existing.alert.level) sound = true;
          list[index] = { ...existing, alert };
          schedule(existing.key);
        } else {
          sound = true;
          const key = ++nextKey;
          list = [{ key, episode, alert }, ...list];
          schedule(key);
        }
      }

      for (const dropped of list.slice(MAX_TOASTS)) {
        const pending = timers.get(dropped.key);
        if (pending !== undefined) window.clearTimeout(pending);
        timers.delete(dropped.key);
      }
      commit(list.slice(0, MAX_TOASTS));

      if (sound && !mutedRef.current) {
        audio.currentTime = 0;
        audio.play().catch(() => undefined);
      }
    });

    return () => {
      unsubscribe();
      audio.pause();
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleMuted = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  const dismiss = (key: number) => {
    const pending = timersRef.current.get(key);
    if (pending !== undefined) window.clearTimeout(pending);
    timersRef.current.delete(key);
    const list = toastsRef.current.filter((t) => t.key !== key);
    toastsRef.current = list;
    setToasts(list);
  };

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
          const threshold = gasThreshold(alert.gas, thresholds);
          return (
            <div key={key} className="pointer-events-auto rounded-md border border-line bg-panel p-4 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <LevelPill level={alert.level} compact />
                  <p className="font-medium text-ink">{alert.kind === 'equipo' ? alert.detail : threshold.label}</p>
                  <p className="text-sm text-ink-muted">
                    {alert.stationId} · {station?.name.split(' · ')[1]}
                  </p>
                  <p className="tabular-nums text-sm text-ink">
                    {alert.kind === 'equipo' ? alert.time : `${alert.value.toFixed(threshold.decimals)} ${threshold.unit} · ${alert.time}`}
                  </p>
                  {alert.level >= 2 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const s = useVigia.getState();
                        void downloadIncidentReport(s, alert, s.thresholds);
                      }}
                      className={`${buttonIdle} mt-1 self-start py-1 text-xs`}
                    >
                      Descargar PDF
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
