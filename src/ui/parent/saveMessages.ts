import type { SaveResult } from '../../family/session';
import type { Messages } from '../../i18n';

/** Toast text for a failed save; null for success or a rejection the form shows inline. */
export function saveFailure(res: SaveResult, t: Messages): string | null {
  if (res.ok || res.error === 'rejected') return null;
  return { conflict: t.parent.conflict, network: t.parent.saveNetwork, server: t.parent.saveServer, too_large: t.parent.saveTooLarge }[res.error];
}
