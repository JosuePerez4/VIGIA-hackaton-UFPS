import type { NextRequest } from 'next/server';
import { isUuid, isWriteAuthorized, json, serverError, unauthorized } from '@/lib/api';
import { validateBatch, writeBatch, type IngestBatch } from '@/lib/ingest';

const MAX_BODY_BYTES = 2_000_000;

export async function POST(request: NextRequest) {
  if (!isWriteAuthorized(request)) return unauthorized();

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'Lote demasiado grande' }, 413);

  try {
    const body: unknown = await request.json().catch(() => null);
    const problem = validateBatch(body);
    if (problem) return json({ error: problem }, 400);

    const batch = toBatch(body as Record<string, unknown>);
    if (!isUuid(batch.sessionId)) return json({ error: 'sessionId debe ser un UUID' }, 400);

    const written = await writeBatch(batch);
    return json({ ok: true, written });
  } catch (error) {
    return serverError(error);
  }
}

function toBatch(body: Record<string, unknown>): IngestBatch {
  return {
    sessionId: body.sessionId as string,
    alerts: (body.alerts ?? []) as IngestBatch['alerts'],
    timeline: (body.timeline ?? []) as IngestBatch['timeline'],
    stations: (body.stations ?? []) as IngestBatch['stations'],
    workers: (body.workers ?? []) as IngestBatch['workers'],
  };
}
