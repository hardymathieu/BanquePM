// Vitest setup for the Worker project: a fresh D1 with the real migrations.
import { applyD1Migrations, env } from 'cloudflare:test';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
