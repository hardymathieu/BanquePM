// "Ton livret": moves, banked coins and monthly interest, newest first (SPEC §8.6).
import { useState } from 'preact/hooks';
import { useI18n } from '../../i18n';
import type { KidModel, PassbookRow } from './model';

const FIRST_ROWS = 7;

export function Passbook({ model }: { model: KidModel }) {
  const { t, f } = useI18n();
  const [all, setAll] = useState(false);
  const rows = all ? model.passbook : model.passbook.slice(0, FIRST_ROWS);

  const label = (r: PassbookRow) =>
    r.kind === 'move'
      ? r.note || (r.amount < 0 ? t.kid.withdrawal : t.kid.deposit)
      : r.kind === 'coin'
        ? t.kid.coinRow(f.weekdayName(r.weekday))
        : t.kid.interestRow(f.monthYear(r.month), r.partial);

  if (!model.passbook.length) return null;
  return (
    <section aria-labelledby="h-book">
      <h2 id="h-book">{t.kid.bookTitle}</h2>
      <ul class="book">
        {rows.map((r) => (
          <li key={r.key} class={`row ${r.kind === 'interest' ? 'int' : r.amount < 0 ? 'out' : 'in'}`}>
            <div class="what">
              {label(r)}
              <span class="date">{r.kind === 'interest' ? t.kid.paidByBank : f.dateShort(r.date)}</span>
            </div>
            <div class="amt">{f.signedMoney(r.amount)}</div>
          </li>
        ))}
      </ul>
      {model.passbook.length > FIRST_ROWS && (
        <button class="more" type="button" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t.kid.bookLess : t.kid.bookMore}
        </button>
      )}
    </section>
  );
}
