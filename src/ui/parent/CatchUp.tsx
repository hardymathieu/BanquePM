// "Dimanches à rattraper" (SPEC §9.2): the most-used screen.
import { useMemo, useState } from 'preact/hooks';
import { applySundayDraft, type SundayAnswer } from '../../engine/ops';
import { allowanceOn } from '../../engine/schedule';
import type { IsoDate } from '../../engine/types';
import { useI18n } from '../../i18n';
import { Rich } from '../shared/Rich';
import { Segmented } from '../shared/Segmented';
import { useToast } from '../shared/Toast';
import { type KidCtx, onKid } from './kidContext';
import { type Ago, catchUpPreview, nextScheduled, pendingRows } from './model';

const FIRST_ROWS = 6;

export function CatchUp({ ctx }: { ctx: KidCtx }) {
  const { t, f } = useI18n();
  const toast = useToast();
  const { doc, today } = ctx;
  const [draft, setDraft] = useState<Record<IsoDate, SundayAnswer>>({});
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => pendingRows(doc, today), [doc, today]);
  const preview = useMemo(() => (Object.keys(draft).length ? catchUpPreview(doc, draft, today) : null), [doc, draft, today]);
  const day = f.weekdayName(allowanceOn(doc, today)?.weekday ?? 0);
  const n = Object.keys(draft).length;

  const agoText = (a: Ago) => (a.kind === 'today' ? t.parent.agoToday : a.kind === 'this_week' ? t.parent.agoThisWeek : t.parent.agoWeeks(a.n));
  const toggle = (d: IsoDate, v: SundayAnswer) =>
    setDraft((cur) => {
      const next = { ...cur };
      if (next[d] === v) delete next[d];
      else next[d] = v;
      return next;
    });
  const fillAll = (v: SundayAnswer) => setDraft(Object.fromEntries(rows.map((r) => [r.date, v])));

  async function commit() {
    setBusy(true);
    const res = await ctx.save(onKid(ctx.slot, (d) => applySundayDraft(d, draft)));
    setBusy(false);
    if (ctx.report(res)) {
      setDraft({});
      toast(t.parent.savedDays(doc.name));
    }
  }

  if (!rows.length) {
    const next = nextScheduled(doc, today);
    return (
      <section aria-labelledby="h-catch">
        <h2 id="h-catch">{t.parent.catchUpTitle(day)}</h2>
        <div class="card">
          <p class="empty">{t.parent.upToDate(day, next && f.dayMonth(next))}</p>
        </div>
      </section>
    );
  }

  const visible = all ? rows : rows.slice(0, FIRST_ROWS);
  const thisYear = today.slice(0, 4);
  return (
    <section aria-labelledby="h-catch">
      <h2 id="h-catch">
        {t.parent.catchUpTitle(day)} <span class="count">{rows.length}</span>
      </h2>
      <p class="sub">{t.parent.catchUpSub(doc.name, day)}</p>
      <div class="card">
        <div class="bulk">
          <button type="button" class="btn small" onClick={() => fillAll('banked')}>{t.parent.allBank}</button>
          <button type="button" class="btn small ghosty" onClick={() => fillAll('kept')}>{t.parent.allKept}</button>
        </div>
        <ul class="suns">
          {visible.map((r) => (
            <li key={r.date} class="sun">
              <p class="d">
                {t.parent.pendingDay(f.weekdayName(r.weekday), f.dayMonth(r.date), r.date.startsWith(thisYear) ? null : r.date.slice(0, 4))}
                <small>{agoText(r.ago)}</small>
              </p>
              <Segmented
                label={t.parent.pendingDay(f.weekdayName(r.weekday), f.dayMonth(r.date), r.date.slice(0, 4))}
                value={draft[r.date] ?? null}
                onChange={(v) => toggle(r.date, v)}
                options={[
                  { value: 'banked', label: t.parent.bank, class: 'bank' },
                  { value: 'kept', label: t.parent.kept, class: 'kept' },
                ]}
              />
            </li>
          ))}
        </ul>
        {rows.length > FIRST_ROWS && (
          <button type="button" class="linkbtn" onClick={() => setAll(!all)}>
            {all ? t.parent.showLess : t.parent.showOthers(rows.length - FIRST_ROWS)}
          </button>
        )}
        {preview && (
          <p class="preview" role="status">
            <Rich text={t.parent.catchUpPreview(preview.banked, preview.kept, f.money(preview.coins), f.money(preview.interest), f.money(preview.newBalance))} />
          </p>
        )}
        <button type="button" class="btn" disabled={!n || busy} onClick={() => void commit()}>
          {t.parent.saveDays(n, day)}
        </button>
      </div>
    </section>
  );
}
