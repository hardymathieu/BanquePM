// Add or edit a move (SPEC §9.3): live preview, backdating note, overdraft errors.
import { useMemo, useState } from 'preact/hooks';
import { randomId } from '../../crypto/random';
import { addMove, deleteMove, updateMove } from '../../engine/ops';
import { allowanceOn } from '../../engine/schedule';
import type { KidDoc, Move } from '../../engine/types';
import { checkMove, findOverdraft, type Overdraft } from '../../engine/validate';
import { ChangeRejected } from '../../family/session';
import { useI18n } from '../../i18n';
import { Rich } from '../shared/Rich';
import { Segmented } from '../shared/Segmented';
import { type KidCtx, onKid } from './kidContext';
import { deletePreview, lastScheduled, movePreview, parseAmount } from './model';

const CHIPS = [2, 5, 10, 20];

/** Applies a move edit and re-checks it, so a change that no longer fits after a reload is rejected. */
function guarded(today: string, edit: (d: KidDoc) => KidDoc, move: Pick<Move, 'date' | 'amount'> | null) {
  return (d: KidDoc) => {
    const problem = move && checkMove(d, move, today);
    if (problem) throw new ChangeRejected(problem);
    const next = edit(d);
    if (findOverdraft(next, today)) throw new ChangeRejected('overdraft');
    return next;
  };
}

export function MoveForm({ ctx, editing, onDone }: { ctx: KidCtx; editing: Move | null; onDone: (message: string) => void }) {
  const { t, f } = useI18n();
  const { doc, today } = ctx;
  const [kind, setKind] = useState<'dep' | 'wd'>(editing && editing.amount < 0 ? 'wd' : 'dep');
  const [amountText, setAmountText] = useState(editing ? f.money(Math.abs(editing.amount)).replace(/[^\d,.]/g, '') : '');
  const [date, setDate] = useState(editing?.date ?? today);
  const [kidNote, setKidNote] = useState(editing?.kidNote ?? '');
  const [privateNote, setPrivateNote] = useState(editing?.privateNote ?? '');
  const [busy, setBusy] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<Overdraft | null>(null);

  const amount = parseAmount(amountText);
  const signed = amount === null ? null : kind === 'wd' ? -amount : amount;
  const preview = useMemo(
    () => (signed === null ? null : movePreview(doc, { amount: signed, date }, editing?.id ?? null, today)),
    [doc, signed, date, editing, today],
  );
  const last = lastScheduled(doc, today);
  const day = f.weekdayName(allowanceOn(doc, today)?.weekday ?? 0);
  const id = editing ? 'edit' : 'add';

  const overdraftText = (o: Overdraft) =>
    o.date === today ? t.parent.overdraftToday(f.money(o.available)) : t.parent.overdraftPast(f.dateWithDay(o.date), f.money(o.available));
  const error = preview?.problem ? t.parent.moveProblem[preview.problem] : preview?.overdraft ? overdraftText(preview.overdraft) : null;
  const ready = signed !== null && preview !== null && !error && !busy;

  async function submit(e: Event) {
    e.preventDefault();
    if (!ready || signed === null) return;
    const move: Move = { id: editing?.id ?? randomId(), date, amount: signed, kidNote: kidNote.trim(), privateNote: privateNote.trim() };
    setBusy(true);
    const res = await ctx.save(onKid(ctx.slot, guarded(today, (d) => (editing ? updateMove(d, move) : addMove(d, move)), move)));
    setBusy(false);
    if (!ctx.report(res)) return;
    if (!editing) {
      setAmountText('');
      setDate(today);
      setKidNote('');
      setPrivateNote('');
    }
    onDone(editing ? t.parent.toastEdited : signed < 0 ? t.parent.toastWithdrawal : t.parent.toastDeposit);
  }

  async function remove() {
    if (!editing) return;
    const check = deletePreview(doc, editing.id, today);
    setDeleteBlocked(check.overdraft);
    if (check.overdraft) return;
    setBusy(true);
    const res = await ctx.save(onKid(ctx.slot, guarded(today, (d) => deleteMove(d, editing.id), null)));
    setBusy(false);
    if (ctx.report(res)) onDone(t.parent.toastDeleted);
  }

  const shown = amount === null ? null : f.money(amount);
  return (
    <form onSubmit={(e) => void submit(e)} autocomplete="off" noValidate>
      <Segmented
        label={t.parent.typeGroup}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'dep', label: t.parent.deposit, class: 'dep' },
          { value: 'wd', label: t.parent.withdrawal, class: 'wd' },
        ]}
      />
      <div class="row2">
        <div class="field">
          <label for={`${id}-amt`}>{t.parent.amountLabel}</label>
          <input id={`${id}-amt`} type="text" inputMode="decimal" placeholder={t.parent.amountPlaceholder} value={amountText} onInput={(e) => setAmountText(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for={`${id}-date`}>{t.parent.dateLabel}</label>
          <input id={`${id}-date`} type="date" min={doc.ledgerStart} max={today} value={date} onInput={(e) => setDate(e.currentTarget.value)} />
        </div>
      </div>
      <div class="chips">
        {CHIPS.map((c) => (
          <button key={c} type="button" class="chip" onClick={() => setAmountText(String(c))}>{f.moneyWhole(c)}</button>
        ))}
        {last && <button type="button" class="chip" onClick={() => setDate(last)}>{t.parent.lastDayChip(day)}</button>}
      </div>
      <div class="field">
        <label for={`${id}-kn`}>{t.parent.kidNoteLabel(doc.name)}</label>
        <input id={`${id}-kn`} type="text" class="hand" maxLength={120} placeholder={t.parent.kidNotePlaceholder} value={kidNote} onInput={(e) => setKidNote(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label for={`${id}-pn`} class="lock">{t.parent.privateNoteLabel}</label>
        <input id={`${id}-pn`} type="text" maxLength={200} placeholder={t.parent.privateNotePlaceholder} value={privateNote} onInput={(e) => setPrivateNote(e.currentTarget.value)} />
      </div>
      {preview && !error && (
        <p class="preview" role="status">
          <Rich text={t.parent.newBalance(f.money(preview.newBalance))} />
          {preview.backdatedInterest !== 0 && (
            <>
              <br />
              <Rich text={t.parent.backdated(f.signedMoney(preview.backdatedInterest))} />
            </>
          )}
        </p>
      )}
      {error && <p class="err" role="alert">{error}</p>}
      {deleteBlocked && <p class="err" role="alert">{overdraftText(deleteBlocked)}</p>}
      {editing ? (
        <div class="dlg-actions">
          <button type="button" class="btn danger" disabled={busy} onClick={() => void remove()}>{t.parent.delete}</button>
          <button type="submit" class="btn" disabled={!ready}>{t.parent.save}</button>
        </div>
      ) : (
        <button type="submit" class="btn" disabled={!ready}>
          {kind === 'wd' ? t.parent.submitWithdrawal(shown) : t.parent.submitDeposit(shown)}
        </button>
      )}
    </form>
  );
}
