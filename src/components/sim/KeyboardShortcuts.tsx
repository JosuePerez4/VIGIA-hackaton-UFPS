'use client';

import { useEffect } from 'react';
import { SCENARIOS } from '@/sim/scenarios';
import { useVigia } from '@/store/vigia-store';

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']);

/** Atajos para la presentación: 1–5 lanzan escenarios, espacio pausa, R reinicia. */
export function KeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag && IGNORED_TAGS.has(tag)) return;

      const state = useVigia.getState();
      if (event.key === ' ') {
        event.preventDefault();
        state.togglePause();
        return;
      }
      if (event.key.toLowerCase() === 'r') {
        state.reset();
        return;
      }
      const scenario = SCENARIOS.find((s) => s.shortcut === event.key);
      if (scenario) state.launch(scenario.id);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
