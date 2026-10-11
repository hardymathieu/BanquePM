// "+ Ajouter un enfant" (SPEC §9.4): defaults 2 € on Sundays at 12 %, ledger starts today.
import { useState } from 'preact/hooks';
import { isIsoDate } from '../../engine/dates';
import { addKid, newKidDoc } from '../../engine/family';
import type { FamilyDoc, IsoDate, KidDoc, Weekday } from '../../engine/types';
import type { Change, SaveResult } from '../../family/session';
import { ChangeRejected } from '../../family/session';
import { useI18n } from '../../i18n';
import { MAX_KIDS } from '../../limits';
import { Sheet } from '../shared/Sheet';
import { useToast } from '../shared/Toast';
import { Segmented } from '../shared/Segmented';
import { parseAmount, parsePercent } from './model';
import { SheetImport } from './SheetImport';
import { WeekdaySelect } from './WeekdaySelect';

type Props = {
  family: FamilyDoc;
  today: IsoDate;
  save: (change: Change, opts?: { count?: boolean }) => Promise<SaveResult>;
  report: (res: SaveResult) => boolean;
  onClose: () => void;
  onAdded: (slot: number) => void;
};

export function AddKidSheet({ family, today, save, report, onClose, onAdded }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [amountText, setAmountText] = useState('2');
  const [weekday, setWeekday] = useState<Weekday>(0);
  const [rateText, setRateText] = useState('12');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'new' | 'sheet'>('new');
  const [imported, setImported] = useState<KidDoc | null>(null);
  const allowance = parseAmount(amountText);
  const apr = parsePercent(rateText);
  const ok =
    name.trim() !== '' &&
    (mode === 'sheet' ? imported !== null : allowance !== null && apr !== null) &&
    (birthday === '' || (isIsoDate(birthday) && birthday <= today));

  async function create(e: Event) {
    e.preventDefault();
    if (!ok) return;
    const kid =
      mode === 'sheet' && imported
        ? { ...imported, name: name.trim(), birthday: birthday || null }
        : newKidDoc({ name: name.trim(), birthday: birthday || null, allowance: allowance!, weekday, apr: apr! }, today);
    let slot = -1;
    setBusy(true);
    const res = await save((f) => {
      if (f.kids.length >= MAX_KIDS) throw new ChangeRejected('too_many_kids');
      const added = addKid(f, kid);
      slot = added.slot;
      return added.family;
    });
    setBusy(false);
    if (!res.ok && res.error === 'rejected') return toast(t.parent.tooManyKids);
    if (!report(res)) return;
    toast(t.parent.toastKidAdded(kid.name));
    onAdded(slot);
    onClose();
  }

  return (
    <Sheet title={t.parent.addKidTitle} onClose={onClose}>
      <form onSubmit={(e) => void create(e)} autocomplete="off">
        <Segmented
          label={t.sheet.modeGroup}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'new', label: t.sheet.modeNew, class: 'dep' },
            { value: 'sheet', label: t.sheet.modeSheet, class: 'dep' },
          ]}
        />
        <div class="field">
          <label for="new-name">{t.parent.nameLabel}</label>
          <input id="new-name" type="text" maxLength={40} value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="new-bday">{t.parent.birthdayOptional}</label>
          <input id="new-bday" type="date" max={today} value={birthday} onInput={(e) => setBirthday(e.currentTarget.value)} />
        </div>
        {mode === 'sheet' ? (
          <SheetImport today={today} onReady={setImported} />
        ) : (
          <>
        <div class="row2">
          <div class="field">
            <label for="new-amt">{t.parent.allowanceAmount}</label>
            <input id="new-amt" type="text" inputMode="decimal" value={amountText} onInput={(e) => setAmountText(e.currentTarget.value)} />
          </div>
          <div class="field">
            <label for="new-day">{t.parent.weekdayLabel}</label>
            <WeekdaySelect id="new-day" value={weekday} onChange={setWeekday} />
          </div>
        </div>
        <div class="field">
          <label for="new-rate">{t.parent.rateInput}</label>
          <input id="new-rate" type="text" inputMode="decimal" value={rateText} onInput={(e) => setRateText(e.currentTarget.value)} />
        </div>
          </>
        )}
        <button type="submit" class="btn" disabled={!ok || busy}>{t.parent.createKid(name.trim())}</button>
      </form>
    </Sheet>
  );
}
