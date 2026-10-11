// Tap an answered day in the livret: switch banked ⇄ kept, or back to catch-up (SPEC §9.2).
import { useState } from 'preact/hooks';
import { weekday } from '../../engine/dates';
import { setSunday, type SundayAnswer } from '../../engine/ops';
import { sundayStatus } from '../../engine/schedule';
import type { Overdraft } from '../../engine/validate';
import { findOverdraft } from '../../engine/validate';
import { ChangeRejected } from '../../family/session';
import { useI18n } from '../../i18n';
import { Sheet } from '../shared/Sheet';
import { useToast } from '../shared/Toast';
import { type KidCtx, onKid } from './kidContext';
import { sundayChangePreview } from './model';

export function SundaySheet({ ctx, date, onClose }: { ctx: KidCtx; date: string; onClose: () => void }) {
  const { t, f } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<Overdraft | null>(null);
  const status = sundayStatus(ctx.doc, date);

  async function set(next: SundayAnswer | 'pending') {
    const check = sundayChangePreview(ctx.doc, date, next, ctx.today);
    setBlocked(check.overdraft);
    if (check.overdraft) return;
    setBusy(true);
    const res = await ctx.save(
      onKid(ctx.slot, (d) => {
        const after = setSunday(d, date, next);
        if (findOverdraft(after, ctx.today)) throw new ChangeRejected('overdraft');
        return after;
      }),
    );
    setBusy(false);
    if (ctx.report(res)) {
      toast(t.parent.toastEdited);
      onClose();
    }
  }

  return (
    <Sheet title={t.parent.sundayTitle(f.weekdayName(weekday(date)), f.dateLong(date))} onClose={onClose}>
      <p class="sub">{status === 'banked' ? t.parent.currentlyBanked : t.parent.currentlyKept(ctx.doc.name)}</p>
      {blocked && (
        <p class="err" role="alert">
          {blocked.date === ctx.today
            ? t.parent.overdraftToday(f.money(blocked.available))
            : t.parent.overdraftPast(f.dateWithDay(blocked.date), f.money(blocked.available))}
        </p>
      )}
      <div class="dlg-actions">
        <button type="button" class="btn ghosty" disabled={busy} onClick={() => void set(status === 'banked' ? 'kept' : 'banked')}>
          {status === 'banked' ? t.parent.markKept : t.parent.markBanked}
        </button>
        <button type="button" class="btn danger" disabled={busy} onClick={() => void set('pending')}>
          {t.parent.resetDay}
        </button>
      </div>
    </Sheet>
  );
}
