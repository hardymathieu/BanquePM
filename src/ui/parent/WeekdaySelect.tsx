import type { Weekday } from '../../engine/types';
import { useI18n } from '../../i18n';

const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]; // Monday first, as in a French calendar

export function WeekdaySelect({ id, value, onChange }: { id: string; value: Weekday; onChange: (w: Weekday) => void }) {
  const { f } = useI18n();
  return (
    <select id={id} value={value} onChange={(e) => onChange(Number(e.currentTarget.value) as Weekday)}>
      {ORDER.map((w) => (
        <option key={w} value={w}>{f.weekdayName(w)}</option>
      ))}
    </select>
  );
}
