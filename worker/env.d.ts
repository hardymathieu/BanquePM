// Secrets and optional vars, which `wrangler types` can't see.
interface BpmSecrets {
  /** Instance owner's token, 32+ characters. Admin calls are disabled without it. */
  ADMIN_TOKEN?: string;
  /** Optional contact shown on the privacy page. */
  INSTANCE_CONTACT?: string;
}

interface Env extends BpmSecrets {}

declare namespace Cloudflare {
  interface Env extends BpmSecrets {}
  interface GlobalProps {
    mainModule: typeof import('./index');
  }
}
