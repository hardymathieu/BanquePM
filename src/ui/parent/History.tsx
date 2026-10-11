// "Livret" (SPEC §9.1.6): every move and answered day, newest first. Tap to edit.
import { useMemo, useState } from 'preact/hooks';
import type { Move } from '../../engine/types';
import { useI18n } from '../../i18n';
import { Sheet } from '../shared/Sheet';
import { useToast } from '../shared/Toast';
import type { KidCtx } from './kidContext';
import { historyRows } from './model';
import { MoveForm } from './MoveForm';
import { SundaySheet } from './SundaySheet';

const FIRST_ROWS = 8;

export function History({ ctx }: { ctx: KidCtx }) {
  const { t, f } = useI18n();
  const toast = useToast();
  const rows = useMemo(() => historyRows(ctx.doc), [ctx.doc]);
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<Move | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const visible = all ? rows : rows.slice(0, FIRST_ROWS);

  return (
    <section aria-labelledby="h-hist">
      <h2 id="h-hist">{t.parent.historyTitle}</h2>
      <div class="card">
        {!rows.length && <p class="empty">{t.parent.historyEmpty}</p>}
        <ul class="hist">
          {visible.map((r) => (
            <li key={r.key}>
              {r.kind === 'move' ? (
                <button type="button" class={`h${r.amount < 0 ? ' out' : ''}`} onClick={() => setEditing(ctx.doc.moves.find((m) => m.id === r.id) ?? null)}>
                  <span>
                    <span class="kn">{r.kidNote || (r.amount < 0 ? t.parent.withdrawal : t.parent.deposit)}</span>
                    {r.privateNote && <span class="pn lock" aria-label={t.parent.privateNoteAria}>{r.privateNote}</span>}
                    <span class="dt">{f.dateWithDay(r.date)}</span>
                  </span>
                  <span class="am">{f.signedMoney(r.amount)}</span>
                </button>
              ) : (
                <button type="button" class={`h${r.kind === 'kept' ? ' kept' : ''}`} onClick={() => setDay(r.date)}>
                  <span>
                    <span class="kn">{r.kind === 'kept' ? t.parent.keptRow : t.parent.coinRow(f.weekdayName(r.weekday))}</span>
                    <span class="dt">{f.dateWithDay(r.date)}</span>
                  </span>
                  <span class="am">{r.kind === 'kept' ? t.parent.keptAmount : f.signedMoney(r.amount)}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {rows.length > FIRST_ROWS && (
        <button type="button" class="btn ghosty" onClick={() => setAll(!all)}>
          {all ? t.parent.showLess : t.parent.historyMore(rows.length)}
        </button>
      )}
      {editing && (
        <Sheet title={t.parent.editTitle} onClose={() => setEditing(null)}>
          <MoveForm
            ctx={ctx}
            editing={editing}
            onDone={(msg) => {
              setEditing(null);
              toast(msg);
            }}
          />
        </Sheet>
      )}
      {day && <SundaySheet ctx={ctx} date={day} onClose={() => setDay(null)} />}
    </section>
  );
}
