// JSON responses and body reading. Error bodies carry a code and nothing else.

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: HEADERS });
}

/** Thrown anywhere in a handler; the router turns it into `{ error: code, ...extra }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export const fail = (status: number, code: string, extra: Record<string, unknown> = {}): never => {
  throw new HttpError(status, code, extra);
};

/** Reads at most `limit` bytes; 413 beyond. An empty body is `undefined`; bad JSON is 400. */
export async function readJson(req: Request, limit: number): Promise<unknown> {
  const declared = Number(req.headers.get('Content-Length') ?? 0);
  if (declared > limit) fail(413, 'too_large');
  if (!req.body) return undefined;

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      fail(413, 'too_large');
    }
    chunks.push(value);
  }
  if (size === 0) return undefined;

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return fail(400, 'bad_request');
  }
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
