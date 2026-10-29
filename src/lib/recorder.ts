import { GAS_ORDER } from '@/config/thresholds';
import type { AlertRow, IngestBatch, StationRow, TimelineRow, WorkerRow } from '@/lib/ingest';
import type { MineSnapshot } from '@/sim/types';

const SAMPLE_EVERY_S = 30;
const FLUSH_MS = 5000;
interface Pending {
  alerts: AlertRow[];
  timeline: TimelineRow[];
  stations: StationRow[];
  workers: WorkerRow[];
}

const emptyPending = (): Pending => ({ alerts: [], timeline: [], stations: [], workers: [] });

interface Session {
  scenario: string;
  target: string;
  serverId: string | null;
  creating: boolean;
  pending: Pending;
  sentAlerts: Map<number, string>;
  lastEventNo: number;
  nextSampleAt: number;
}

export class SessionRecorder {
  private sessions: Session[] = [];
  private current: Session | null = null;
  private lastElapsed = -1;
  private timer: number | null = null;

  start() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => void this.flush(), FLUSH_MS);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  observe(snapshot: MineSnapshot) {
    const startsNewSession =
      !this.current ||
      snapshot.elapsed < this.lastElapsed ||
      snapshot.scenario !== this.current.scenario ||
      snapshot.target !== this.current.target;
    if (startsNewSession) this.openSession(snapshot);
    const session = this.current as Session;
    this.lastElapsed = snapshot.elapsed;

    for (const alert of snapshot.alerts) {
      const signature = `${alert.status}|${alert.acknowledged}|${alert.level}|${alert.value.toFixed(3)}`;
      if (session.sentAlerts.get(alert.id) === signature) continue;
      session.sentAlerts.set(alert.id, signature);
      session.pending.alerts.push({
        alertNo: alert.id,
        simElapsedS: alert.elapsed,
        simClock: alert.time,
        stationId: alert.stationId,
        gas: alert.gas,
        level: alert.level,
        channel: alert.channel,
        kind: alert.kind,
        detail: alert.detail,
        value: alert.value,
        status: alert.status,
        acknowledged: alert.acknowledged,
      });
    }

    for (const entry of snapshot.timeline) {
      if (entry.id <= session.lastEventNo) continue;
      session.lastEventNo = entry.id;
      session.pending.timeline.push({
        eventNo: entry.id,
        simElapsedS: entry.elapsed,
        simClock: entry.time,
        tone: entry.tone,
        text: entry.text,
      });
    }

    if (snapshot.elapsed >= session.nextSampleAt) {
      this.sample(session, snapshot);
      session.nextSampleAt = (Math.floor(snapshot.elapsed / SAMPLE_EVERY_S) + 1) * SAMPLE_EVERY_S;
    }
  }

  private openSession(snapshot: MineSnapshot) {
    const session: Session = {
      scenario: snapshot.scenario,
      target: snapshot.target,
      serverId: null,
      creating: false,
      pending: emptyPending(),
      sentAlerts: new Map(),
      lastEventNo: 0,
      nextSampleAt: 0,
    };
    this.sessions.push(session);
    this.current = session;
    void this.createRemote(session);
  }

  private sample(session: Session, snapshot: MineSnapshot) {
    const time = snapshot.elapsed;
    for (const station of snapshot.stations) {
      session.pending.stations.push({
        simElapsedS: time,
        stationId: station.id,
        level: station.level,
        readings: Object.fromEntries(
          GAS_ORDER.map((gas) => [gas, { raw: station.readings[gas].raw, avg: station.readings[gas].avg, level: station.readings[gas].level }]),
        ),
        climate: { ...station.climate },
      });
    }
    for (const worker of snapshot.workers) {
      session.pending.workers.push({
        simElapsedS: time,
        workerId: worker.id,
        stationId: worker.linkedStationId,
        level: worker.level,
        reading: { ...worker.reading },
      });
    }
  }

  private async createRemote(session: Session) {
    if (session.serverId !== null || session.creating) return;
    session.creating = true;
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ scenario: session.scenario, target: session.target }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { id } = (await response.json()) as { id: string };
      session.serverId = id;
    } catch {
    } finally {
      session.creating = false;
    }
  }

  async flush() {
    for (const session of this.sessions) {
      if (session.serverId === null) {
        await this.createRemote(session);
        if (session.serverId === null) continue;
      }
      const sent = session.pending;
      const hasRows = sent.alerts.length + sent.timeline.length + sent.stations.length + sent.workers.length > 0;
      if (!hasRows) continue;
      session.pending = emptyPending();

      const batch: IngestBatch = { sessionId: session.serverId, ...sent };
      try {
        const response = await fetch('/api/ingest', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(batch),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch {
        session.pending = {
          alerts: [...sent.alerts, ...session.pending.alerts],
          timeline: [...sent.timeline, ...session.pending.timeline],
          stations: [...sent.stations, ...session.pending.stations],
          workers: [...sent.workers, ...session.pending.workers],
        };
      }
    }
    this.sessions = this.sessions.filter((s) => s === this.current || s.serverId === null || hasPending(s));
  }
}

const hasPending = (s: Session) =>
  s.pending.alerts.length + s.pending.timeline.length + s.pending.stations.length + s.pending.workers.length > 0;

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = process.env.NEXT_PUBLIC_INGEST_TOKEN;
  if (token) headers['x-ingest-token'] = token;
  return headers;
}
