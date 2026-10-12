// CLAUDE.md rule 2: log nothing. Static checks that run in Node, not in workerd.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe('log nothing', () => {
  it('has no console calls anywhere in worker/', () => {
    const offenders = filesUnder(join(root, 'worker')).filter((f) => readFileSync(f, 'utf8').includes('console' + '.'));
    expect(offenders).toEqual([]);
  });

  it('keeps observability, logpush, wrangler telemetry and preview URLs off in wrangler.jsonc', () => {
    const text = readFileSync(join(root, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const config = JSON.parse(text) as {
      observability?: { enabled?: boolean };
      logpush?: boolean;
      tail_consumers?: unknown;
      send_metrics?: boolean;
      preview_urls?: boolean;
    };
    expect(config.observability).toEqual({ enabled: false });
    expect(config.logpush).toBe(false);
    expect(config.send_metrics).toBe(false);
    expect(config.preview_urls).toBe(false);
    expect(config.tail_consumers).toBeUndefined();
  });

  it('has no runtime dependencies in the Worker', () => {
    const imports = filesUnder(join(root, 'worker'))
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.') && !f.endsWith('.d.ts') && !f.endsWith('apply-migrations.ts'))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]!));
    expect(imports.filter((i) => !i.startsWith('.'))).toEqual([]);
  });
});
