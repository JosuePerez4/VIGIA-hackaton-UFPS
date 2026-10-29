'use client';

import { useEffect } from 'react';
import { SessionRecorder } from '@/lib/recorder';
import { useVigia } from '@/store/vigia-store';

/** Registra la simulación en Neon: observa el store y envía lotes en segundo plano. */
export function PersistenceDriver() {
  useEffect(() => {
    const recorder = new SessionRecorder();
    recorder.observe(useVigia.getState());
    recorder.start();
    const unsubscribe = useVigia.subscribe((state) => recorder.observe(state));
    return () => {
      unsubscribe();
      recorder.stop();
    };
  }, []);

  return null;
}
