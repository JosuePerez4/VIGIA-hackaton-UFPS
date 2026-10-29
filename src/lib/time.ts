export function currentDaySeconds(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return value('hour') * 3600 + value('minute') * 60 + value('second');
}
