'use client';

import { useEffect } from 'react';
import { useVigia } from '@/store/vigia-store';

export function SimulationDriver() {
  useEffect(() => {
    let last = performance.now();
    let carry = 0;

    const id = window.setInterval(() => {
      const now = performance.now();
      const elapsedReal = (now - last) / 1000;
      last = now;

      const { paused, speed, step } = useVigia.getState();
      if (paused) {
        carry = 0;
        return;
      }

      carry += elapsedReal * speed;
      const whole = Math.floor(carry);
      if (whole <= 0) return;
      carry -= whole;
      step(whole);
    }, 250);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
