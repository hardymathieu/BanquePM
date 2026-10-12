// Import an existing Google Sheet (SPEC §12): pick the CSV, adjust pocket money and rate,
// read the summary, then the form saves. The file is read in the browser only.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { randomId } from '../../crypto/random';
import { columnLabels, guessColumns, importRows, importSummary, readSheetTable, type SheetColumns, sheetRows } from '../../engine/importSheet';
import type { IsoDate, KidDoc, Weekday } from '../../engine/types';
import { useI18n } from '../../i18n';
import { Rich } from '../shared/Rich';
import { parseAmount, parsePercent } from './model';
import { WeekdaySelect } from './WeekdaySelect';

type Props = { today: IsoDate; onReady: (kid: KidDoc | null) => void };

export function SheetImport({ today, onReady }: Props) {
  const { t, f } = useI18n();
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [cols, setCols] = useState<SheetColumns | null>(null);
  const [amountText, setAmountText] = useState('2');
  const [weekday, setWeekday] = useState<Weekday>(0);
  const [rateText, setRateText] = useState('12');
  const allowance = parseAmount(amountText);
  const apr = parsePercent(rateText);

  const read = useMemo(() => (table && cols ? sheetRows(table, cols, today) : null), [table, cols, today]);
  const rows = read?.ok ? read.rows : null;
  const error = read && !read.ok ? read : null;
  const labels = useMemo(() => (table && cols ? columnLabels(table, cols.header) : []), [table, cols]);

  const result = useMemo(() => {
    if (!rows || allowance === null || apr === null) return null;
    const kid = importRows(rows, { name: '', birthday: null, newId: randomId, weekday, allowance, apr });
    return { kid, summary: importSummary(rows, kid, today) };
  }, [rows, allowance, apr, weekday, today]);

  useEffect(() => onReady(result && !result.summary.overdraft ? result.kid : null), [result, onReady]);

  const day = f.weekdayName(weekday);
  const errorText = (e: Exclude<typeof read, null | { ok: true }>) =>
    e.error === 'no_rows'
      ? e.sample !== undefined && cols
        ? t.sheet.noRowsIn(labels[cols.date] ?? '', e.sample)
        : t.sheet.noRows
      : e.error === 'bad_date'
        ? t.sheet.badDate(e.row, e.text)
        : t.sheet.badAmount(e.row, e.text);

  return (
    <div class="sheet-import">
      <p class="hint">{t.sheet.howTo}</p>
      <label class="btn ghosty file-btn">
        {fileName ? t.sheet.picked(fileName) : t.sheet.pick}
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            setFileName(file.name);
            const next = readSheetTable(await file.text());
            setTable(next);
            setCols(guessColumns(next));
          }}
        />
      </label>
      {table && cols && labels.length > 0 && (
        <fieldset class="columns">
          <legend>{t.sheet.columnsTitle}</legend>
          <div class="row3">
            {(
              [
                ['date', t.sheet.dateColumn],
                ['amount', t.sheet.amountColumn],
                ['comment', t.sheet.commentColumn],
              ] as const
            ).map(([key, label]) => (
              <div class="field" key={key}>
                <label for={`sh-col-${key}`}>{label}</label>
                <select id={`sh-col-${key}`} value={cols[key]} onChange={(e) => setCols({ ...cols, [key]: Number(e.currentTarget.value) })}>
                  {key === 'comment' && <option value={-1}>{t.sheet.noColumn}</option>}
                  {labels.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
      )}
      {error && <p class="err" role="alert">{errorText(error)}</p>}
      {rows && (
        <>
          <div class="row2">
            <div class="field">
              <label for="sh-amt">{t.parent.allowanceAmount}</label>
              <input id="sh-amt" type="text" inputMode="decimal" value={amountText} onInput={(e) => setAmountText(e.currentTarget.value)} />
            </div>
            <div class="field">
              <label for="sh-day">{t.parent.weekdayLabel}</label>
              <WeekdaySelect id="sh-day" value={weekday} onChange={setWeekday} />
            </div>
          </div>
          <div class="field">
            <label for="sh-rate">{t.parent.rateInput}</label>
            <input id="sh-rate" type="text" inputMode="decimal" value={rateText} onInput={(e) => setRateText(e.currentTarget.value)} />
          </div>
        </>
      )}
      {result && (
        <div class="preview" role="status">
          <p>
            <Rich
              text={t.sheet.summary(result.summary.lines, result.summary.banked, result.summary.moves, result.summary.pending, day, f.money(result.summary.balance))}
            />
          </p>
          <p>{t.sheet.start(f.dateLong(result.summary.start))}</p>
          {read?.ok && read.future > 0 && <p>{t.sheet.futureIgnored(read.future)}</p>}
          <p>{t.sheet.commentsPrivate}</p>
          {result.summary.pending > 0 && <p>{t.sheet.pendingHint(day)}</p>}
        </div>
      )}
      {result?.summary.overdraft && (
        <p class="err" role="alert">
          {t.sheet.overdraft(f.dateLong(result.summary.overdraft.date), f.money(result.summary.overdraft.available))}
        </p>
      )}
    </div>
  );
}
