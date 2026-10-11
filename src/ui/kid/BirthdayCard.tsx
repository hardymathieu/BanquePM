// "Le 10 avril, pour tes 10 ans": the two futures (SPEC §6.4, §8.5).
import { useI18n } from '../../i18n';
import type { KidModel } from './model';

export function BirthdayCard({ model }: { model: KidModel }) {
  const { t, f } = useI18n();
  const { target, projections, allowance } = model;
  return (
    <section aria-labelledby="h-bday">
      <div class="bday">
        <h2 id="h-bday">{target.age === null ? t.kid.sixMonthsTitle : t.kid.bdayTitle(f.dayMonth(target.date), target.age)}</h2>
        <p class="when">{t.kid.bdayWhen(target.days)}</p>
        <div class="paths">
          {allowance && (
            <div class="yes">
              <span class="v">{f.money(projections.withCoins)}</span>
              <span class="k">{t.kid.pathYes(f.weekdayName(allowance.weekday))}</span>
            </div>
          )}
          <div>
            <span class="v">{f.money(projections.withNothing)}</span>
            <span class="k">{t.kid.pathNo}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
