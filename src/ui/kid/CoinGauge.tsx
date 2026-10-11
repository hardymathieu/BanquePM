// "Ta banque te paie aussi": a coin filled clockwise by a week of interest.
import { useI18n } from '../../i18n';
import { Rich } from '../shared/Rich';
import type { KidModel } from './model';
import { centsText, coinLabel } from './text';

const R = 62;
const C = 75;

function sector(fill: number) {
  if (fill >= 0.999) return <circle class="coin-fill" cx={C} cy={C} r={R} />;
  if (fill <= 0) return null;
  const a = fill * 2 * Math.PI;
  const x = (C + R * Math.sin(a)).toFixed(2);
  const y = (C - R * Math.cos(a)).toFixed(2);
  return <path class="coin-fill" d={`M${C},${C} L${C},${C - R} A${R},${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x},${y} Z`} />;
}

export function CoinGauge({ model }: { model: KidModel }) {
  const { t, f } = useI18n();
  const { numbers, allowance } = model;
  if (!allowance) return null;
  const coin = coinLabel(allowance.amount, f);
  const day = f.weekdayName(allowance.weekday);
  const reached = numbers.milestone !== null && numbers.balance >= numbers.milestone;
  const face = coin.replace(/\s/g, '');

  return (
    <section aria-labelledby="h-coin">
      <h2 id="h-coin">{t.kid.coinTitle}</h2>
      <div class="coinwrap">
        <div class="coin">
          <svg viewBox="0 0 150 150" role="img" aria-label={t.kid.coinAria(coin, Math.round(numbers.coinFill * 100))}>
            <circle class="coin-rim" cx={C} cy={C} r={R + 8} />
            <circle class="coin-bg" cx={C} cy={C} r={R} />
            {sector(numbers.coinFill)}
            <circle class="coin-edge" cx={C} cy={C} r={R} />
            <text class="coin-face" x={C} y={C + 16} font-size={face.length > 3 ? 34 : 46}>
              {face}
            </text>
          </svg>
        </div>
        <div class="coinfacts">
          <p>{t.kid.thisWeek}</p>
          <p class="big">{centsText(numbers.interestWeek, t, f)}</p>
          <p>
            <Rich text={t.kid.weekFraction(numbers.fraction, coin, day)} />
          </p>
        </div>
      </div>
      {numbers.milestone !== null && (
        <p class="goal">
          <Rich text={reached ? t.kid.goalReached : t.kid.goal(f.moneyWhole(Math.ceil(numbers.milestone)))} />
        </p>
      )}
    </section>
  );
}
