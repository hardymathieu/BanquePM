// "Réglages" (SPEC §9.1.7): name, birthday, dated allowance and rate changes, forget this device.
import { useState } from 'preact/hooks';
import { isIsoDate } from '../../engine/dates';
import { changeAllowance, changeRate } from '../../engine/ops';
import { allowanceOn } from '../../engine/schedule';
import type { Weekday } from '../../engine/types';
import { checkAllowanceChange, checkRateChange, type DatedChangeProblem } from '../../engine/validate';
import { ChangeRejected } from '../../family/session';
import { i18nFor, type Locale, useI18n } from '../../i18n';
import { forgetDevice } from '../../store/device';
import { Sheet } from '../shared/Sheet';
import { ConfirmDelete } from './ConfirmDelete';
import { Segmented } from '../shared/Segmented';
import { useToast } from '../shared/Toast';
import { type KidCtx, onKid } from './kidContext';
import { nextScheduled, parseAmount, parsePercent } from './model';
import { WeekdaySelect } from './WeekdaySelect';

type Panel = null | 'kid' | 'allowance' | 'rate' | 'forget' | 'delete-kid' | 'delete-all';

type Danger = { download: () => Promise<void>; deleteKid: () => Promise<void>; deleteAll: () => Promise<void> };

export function Settings({ ctx, danger, locale }: { ctx: KidCtx; danger: Danger; locale: Locale }) {
  const { t, f } = useI18n();
  const toast = useToast();
  const { doc, today } = ctx;
  const [panel, setPanel] = useState<Panel>(null);
  const current = allowanceOn(doc, today);
  const futureAllowance = doc.allowance.filter((a) => a.from > today);
  const allowanceText = (amount: number, w: Weekday) => (amount > 0 ? t.parent.allowanceValue(f.money(amount), f.weekdayName(w)) : t.parent.allowancePaused);

  return (
    <section>
      <details class="card fold">
        <summary>{t.parent.settingsTitle}</summary>
        <div class="language">
          <p class="lbl" id="lang-label">{t.parent.languageLabel}</p>
          <Segmented
            label={t.parent.languageLabel}
            value={locale}
            onChange={async (next) => {
              if (next === locale) return;
              const res = await ctx.save((f) => ({ ...f, prefs: { ...f.prefs, locale: next } }), { count: false });
              if (ctx.report(res)) toast(i18nFor(next).t.parent.toastLanguage);
            }}
            options={[
              { value: 'fr', label: 'Français', class: 'dep' },
              { value: 'en', label: 'English', class: 'dep' },
            ]}
          />
          <p class="hint">{t.parent.languageHint}</p>
        </div>
        <dl class="kv">
          <dt>{t.parent.nameLabel}</dt>
          <dd>{doc.name}</dd>
          <dt>{t.parent.birthdayLabel}</dt>
          <dd>{doc.birthday ? f.dateLong(doc.birthday) : t.parent.birthdayNone}</dd>
          <dt />
          <dd><button type="button" class="linkbtn" onClick={() => setPanel(panel === 'kid' ? null : 'kid')}>{t.parent.editKid}</button></dd>
          <dt>{t.parent.allowanceLabel}</dt>
          <dd>
            {current ? allowanceText(current.amount, current.weekday) : t.parent.allowancePaused}
            {futureAllowance.map((a) => (
              <span key={a.from} class="later">{t.parent.allowanceFrom(allowanceText(a.amount, a.weekday), f.dateLong(a.from))}</span>
            ))}
          </dd>
          <dt />
          <dd><button type="button" class="linkbtn" onClick={() => setPanel(panel === 'allowance' ? null : 'allowance')}>{t.parent.changeAllowance}</button></dd>
          <dt>{t.parent.rateLabel}</dt>
          <dd>
            {doc.rates.map((r) => (
              <span key={r.from} class="later">
                {r.from > today ? t.parent.rateFrom(f.percent(r.apr), f.dateLong(r.from)) : t.parent.rateSince(f.percent(r.apr), f.dateLong(r.from))}
              </span>
            ))}
          </dd>
          <dt />
          <dd><button type="button" class="linkbtn" onClick={() => setPanel(panel === 'rate' ? null : 'rate')}>{t.parent.changeRate}</button></dd>
        </dl>
        {panel === 'kid' && <KidForm ctx={ctx} onDone={() => { setPanel(null); toast(t.parent.toastKidSaved); }} />}
        {panel === 'allowance' && <AllowanceForm ctx={ctx} onDone={(msg) => { setPanel(null); toast(msg); }} />}
        {panel === 'rate' && <RateForm ctx={ctx} onDone={(msg) => { setPanel(null); toast(msg); }} />}
        <button type="button" class="btn ghosty" onClick={() => setPanel('forget')}>{t.parent.forgetDevice}</button>
        <button type="button" class="btn danger" onClick={() => setPanel('delete-kid')}>{t.danger.deleteKid(doc.name)}</button>
        <button type="button" class="btn danger" onClick={() => setPanel('delete-all')}>{t.danger.deleteAll}</button>
      </details>
      {panel === 'delete-kid' && (
        <ConfirmDelete
          title={t.danger.deleteKid(doc.name)}
          text={t.danger.deleteKidText(doc.name)}
          word={doc.name}
          onDownload={() => void danger.download()}
          onConfirm={danger.deleteKid}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'delete-all' && (
        <ConfirmDelete
          title={t.danger.deleteAll}
          text={t.danger.deleteAllText}
          word={t.danger.confirmWord}
          onDownload={() => void danger.download()}
          onConfirm={danger.deleteAll}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'forget' && (
        <Sheet title={t.parent.forgetDevice} onClose={() => setPanel(null)}>
          <p class="sub">{t.parent.forgetHint}</p>
          <div class="dlg-actions">
            <button type="button" class="btn ghosty" onClick={() => setPanel(null)}>{t.parent.cancel}</button>
            <button
              type="button"
              class="btn danger"
              onClick={() => {
                forgetDevice();
                location.replace('/');
              }}
            >
              {t.parent.forgetConfirm}
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

function useSubmit(ctx: KidCtx) {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async run(change: Parameters<typeof onKid>[1]): Promise<boolean> {
      setBusy(true);
      const res = await ctx.save(onKid(ctx.slot, change));
      setBusy(false);
      return ctx.report(res);
    },
  };
}

function KidForm({ ctx, onDone }: { ctx: KidCtx; onDone: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(ctx.doc.name);
  const [birthday, setBirthday] = useState(ctx.doc.birthday ?? '');
  const { busy, run } = useSubmit(ctx);
  const ok = name.trim() !== '' && (birthday === '' || (isIsoDate(birthday) && birthday <= ctx.today));
  return (
    <form
      class="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) void run((d) => ({ ...d, name: name.trim(), birthday: birthday || null })).then((done) => done && onDone());
      }}
    >
      <div class="field">
        <label for="set-name">{t.parent.nameLabel}</label>
        <input id="set-name" type="text" maxLength={40} value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label for="set-bday">{t.parent.birthdayOptional}</label>
        <input id="set-bday" type="date" max={ctx.today} value={birthday} onInput={(e) => setBirthday(e.currentTarget.value)} />
      </div>
      {name.trim() === '' && <p class="err">{t.parent.nameRequired}</p>}
      <button type="submit" class="btn" disabled={!ok || busy}>{t.parent.save}</button>
    </form>
  );
}

function datedError(problem: DatedChangeProblem | null, t: ReturnType<typeof useI18n>['t']) {
  return problem ? <p class="err" role="alert">{t.parent.datedProblem[problem]}</p> : null;
}

function AllowanceForm({ ctx, onDone }: { ctx: KidCtx; onDone: (msg: string) => void }) {
  const { t, f } = useI18n();
  const current = allowanceOn(ctx.doc, ctx.today);
  const [amountText, setAmountText] = useState(current ? String(current.amount).replace('.', ',') : '2');
  const [weekday, setWeekday] = useState<Weekday>(current?.weekday ?? 0);
  const [from, setFrom] = useState(nextScheduled(ctx.doc, ctx.today) ?? ctx.today);
  const { busy, run } = useSubmit(ctx);
  const amount = amountText.trim() === '0' ? 0 : parseAmount(amountText);
  const entry = { from, weekday, amount: amount ?? Number.NaN };
  const problem = checkAllowanceChange(ctx.doc, entry, ctx.today);
  return (
    <form
      class="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (problem) return;
        void run((d) => {
          const p = checkAllowanceChange(d, entry, ctx.today);
          if (p) throw new ChangeRejected(p);
          return changeAllowance(d, entry);
        }).then((done) => done && onDone(t.parent.toastAllowance(f.dateLong(from))));
      }}
    >
      <div class="row2">
        <div class="field">
          <label for="al-amt">{t.parent.allowanceAmountLabel}</label>
          <input id="al-amt" type="text" inputMode="decimal" value={amountText} onInput={(e) => setAmountText(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="al-day">{t.parent.weekdayLabel}</label>
          <WeekdaySelect id="al-day" value={weekday} onChange={setWeekday} />
        </div>
      </div>
      <div class="field">
        <label for="al-from">{t.parent.fromLabel}</label>
        <input id="al-from" type="date" min={ctx.today} value={from} onInput={(e) => setFrom(e.currentTarget.value)} />
      </div>
      <p class="hint">{t.parent.allowanceHint}</p>
      {datedError(problem, t)}
      <button type="submit" class="btn" disabled={!!problem || busy}>{t.parent.changeAllowance}</button>
    </form>
  );
}

function RateForm({ ctx, onDone }: { ctx: KidCtx; onDone: (msg: string) => void }) {
  const { t, f } = useI18n();
  const [rateText, setRateText] = useState('');
  const [from, setFrom] = useState(nextScheduled(ctx.doc, ctx.today) ?? ctx.today);
  const { busy, run } = useSubmit(ctx);
  const apr = parsePercent(rateText);
  const entry = { from, apr: apr ?? Number.NaN };
  const problem = rateText.trim() === '' ? null : checkRateChange(ctx.doc, entry, ctx.today);
  return (
    <form
      class="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (apr === null || problem) return;
        void run((d) => {
          const p = checkRateChange(d, entry, ctx.today);
          if (p) throw new ChangeRejected(p);
          return changeRate(d, entry);
        }).then((done) => done && onDone(t.parent.toastRate(f.percent(apr), f.dateLong(from))));
      }}
    >
      <div class="row2">
        <div class="field">
          <label for="rate-new">{t.parent.newRateLabel}</label>
          <input id="rate-new" type="text" inputMode="decimal" value={rateText} onInput={(e) => setRateText(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="rate-from">{t.parent.fromLabel}</label>
          <input id="rate-from" type="date" min={ctx.today} value={from} onInput={(e) => setFrom(e.currentTarget.value)} />
        </div>
      </div>
      <p class="hint">{t.parent.rateHint}</p>
      {datedError(problem, t)}
      <button type="submit" class="btn" disabled={apr === null || !!problem || busy}>{t.parent.changeRate}</button>
    </form>
  );
}
