// The kid view itself, top to bottom as in design/kid-view.html (SPEC §8).
import { useMemo } from 'preact/hooks';
import type { IsoDate, KidPublicDoc } from '../../engine/types';
import { useI18n } from '../../i18n';
import { Rich } from '../shared/Rich';
import { BirthdayCard } from './BirthdayCard';
import { CoinGauge } from './CoinGauge';
import { GhostChart } from './GhostChart';
import { kidModel } from './model';
import { Passbook } from './Passbook';
import { PrivacyLink } from '../shared/PrivacyLink';
import { centsText } from './text';

const NOTHING_YET = 0.005;

/** `embedded`: inside another page (the backup viewer), so not a second <main>. */
type Props = {
  doc: KidPublicDoc;
  today: IsoDate;
  staleSince: IsoDate | null;
  embedded?: boolean;
  /** Set when several kids share this phone: "Changer d'enfant". */
  onSwitchKid?: () => void;
};

export function KidScreen({ doc, today, staleSince, embedded = false, onSwitchKid }: Props) {
  const { t, f } = useI18n();
  const model = useMemo(() => kidModel(doc.kid, today), [doc, today]);
  const { numbers, allowance } = model;
  const parts = f.balanceParts(numbers.balance);
  const day = allowance ? f.weekdayName(allowance.weekday) : '';

  const Root = embedded ? 'div' : 'main';
  return (
    <Root class="kid">
      {staleSince && <p class="stale">{t.kid.stale(f.dateLong(staleSince))}</p>}
      {embedded ? <p class="hello">{t.kid.hello(doc.kid.name)}</p> : <h1 class="hello">{t.kid.hello(doc.kid.name)}</h1>}
      <p class="balance" role="img" aria-label={f.money(numbers.balance)}>
        {parts.symbolFirst && <span class="sym first" aria-hidden="true">€</span>}
        <span class="eur" aria-hidden="true">{parts.euros}</span>
        <span class="cts" aria-hidden="true">{parts.decimal}{parts.cents}</span>
        {!parts.symbolFirst && <span class="sym" aria-hidden="true">€</span>}
      </p>
      <p class="where">{t.kid.where}</p>
      <p class="today">
        <Rich
          text={
            numbers.balance < NOTHING_YET && numbers.interestToday < NOTHING_YET
              ? t.kid.todayEmpty
              : t.kid.today(centsText(numbers.interestToday, t, f))
          }
        />
      </p>

      <CoinGauge model={model} />

      <section aria-labelledby="h-chart">
        <h2 id="h-chart">{t.kid.chartTitle}</h2>
        <p class="lede">
          <Rich text={numbers.keptCount > 0 ? t.kid.gapKept(numbers.keptCount, day, f.moneyWhole(numbers.gap)) : t.kid.allBanked} />
        </p>
        <div class="legend" aria-hidden="true">
          <span>
            <svg width="26" height="8"><line class="legend-mine" x1="1" y1="4" x2="25" y2="4" /></svg>
            {t.kid.legendMine}
          </span>
          <span>
            <svg width="26" height="8"><line class="legend-ghost" x1="1" y1="4" x2="25" y2="4" /></svg>
            {t.kid.legendGhost(day)}
          </span>
        </div>
        <GhostChart model={model} showGap={numbers.keptCount > 0} />
        <details>
          <summary>{t.kid.tableToggle}</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.kid.tableMonth}</th>
                <th scope="col">{t.kid.tableMine}</th>
                <th scope="col">{t.kid.tableGhost}</th>
              </tr>
            </thead>
            <tbody>
              {model.months.map((m) => (
                <tr key={m.date}>
                  <td>{f.monthYear(m.date)}</td>
                  <td>{f.money(m.mine)}</td>
                  <td>{f.money(m.ghost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <BirthdayCard model={model} />
      <Passbook model={model} />

      <footer>
        <p>{t.kid.footer}</p>
        {!embedded && (
          <p class="footer-links">
            {onSwitchKid && (
              <button type="button" class="linkbtn" onClick={onSwitchKid}>{t.kid.switchKid}</button>
            )}
            <PrivacyLink />
          </p>
        )}
      </footer>
    </Root>
  );
}
