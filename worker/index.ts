// The whole server: a tiny router for /api/v1. Everything else is static assets.
// No logging of any kind (CLAUDE.md rule 2), and no listing endpoints (rule 4).
import { createBlob, deleteBlob, getBlob, putBlob } from './blobs';
import { HttpError, json } from './http';
import { mintInvite } from './invites';

type Handler = (req: Request, env: Env, id: string) => Promise<Response>;

const ROUTES: [RegExp, Partial<Record<string, Handler>>][] = [
  [/^\/api\/v1\/blobs$/, { POST: (req, env) => createBlob(req, env) }],
  [/^\/api\/v1\/blobs\/([^/]+)$/, { GET: (_, env, id) => getBlob(env, id), PUT: putBlob, DELETE: deleteBlob }],
  [/^\/api\/v1\/invites$/, { POST: (req, env) => mintInvite(req, env) }],
];

export async function handle(req: Request, env: Env): Promise<Response> {
  try {
    const path = new URL(req.url).pathname;
    for (const [pattern, methods] of ROUTES) {
      const m = pattern.exec(path);
      if (!m) continue;
      const handler = methods[req.method];
      return handler ? await handler(req, env, m[1] ?? '') : json(405, { error: 'method_not_allowed' });
    }
    return json(404, { error: 'not_found' });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, ...e.extra });
    return json(500, { error: 'internal' });
  }
}

export default {
  fetch: (req, env) => handle(req, env),
} satisfies ExportedHandler<Env>;
