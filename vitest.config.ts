import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'worker/**/*.node.test.ts'],
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                ADMIN_TOKEN: 'test-admin-token-0123456789-abcdefghij',
                TEST_MIGRATIONS: await readD1Migrations('./migrations'),
              },
            },
          })),
        ],
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
          exclude: ['worker/**/*.node.test.ts'],
          setupFiles: ['./worker/apply-migrations.ts'],
        },
      },
    ],
  },
});
