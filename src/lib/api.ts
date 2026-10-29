import { NextResponse, type NextRequest } from 'next/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Protección opcional de escritura: si INGEST_TOKEN está definido, las escrituras deben enviar
 * el encabezado x-ingest-token con ese valor. Sin la variable, la API queda abierta (solo prototipo).
 */
export function isWriteAuthorized(request: NextRequest): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return true;
  return request.headers.get('x-ingest-token') === expected;
}

export function unauthorized() {
  return json({ error: 'No autorizado' }, 401);
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  return json({ error: message }, 500);
}
