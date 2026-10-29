// Calculada: ningún dispositivo mide la temperatura húmeda.
export function wetBulbFromTempRh(tempC: number, rh: number): number {
  const r = Math.min(Math.max(rh, 1), 100);
  const tw =
    tempC * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) +
    Math.atan(tempC + r) -
    Math.atan(r - 1.676331) +
    0.00391838 * Math.pow(r, 1.5) * Math.atan(0.023101 * r) -
    4.686035;
  return Math.round(tw * 10) / 10;
}
