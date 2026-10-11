// Page: "Crée la banque de ton enfant" (SPEC §10.2). The root is generated here, in the
// browser; the family and kid blobs go up encrypted; then the recovery card, then the link.
import { useState } from 'preact/hooks';
import { toBase64url } from '../../crypto/base64url';
import { generateRoot } from '../../crypto/keys';
import { familyFromBackup } from '../../engine/backup';
import { confirmRecovery, newFamily, newKidDoc } from '../../engine/family';
import { isIsoDate } from '../../engine/dates';
import type { ExportFile, Weekday } from '../../engine/types';
import { FamilySession } from '../../family/session';
import { deviceLocale, useI18n } from '../../i18n';
import { formatInviteCode, normalizeInviteCode } from '../../inviteCode';
import { setParent } from '../../store/device';
import { useNav } from '../nav';
import { RecoveryFlow } from '../parent/RecoveryCard';
import { parseAmount, parsePercent } from '../parent/model';
import { WeekdaySelect } from '../parent/WeekdaySelect';
import { KidLinkCard } from '../shared/KidLinkCard';
import { localToday } from '../shared/today';
import { ToastProvider } from '../shared/Toast';

type Step = { at: 'form' } | { at: 'recovery'; session: FamilySession } | { at: 'ready'; session: FamilySession };

type Props = { invite: string | null; adminToken: string | null; fromBackup: ExportFile | null };

function Create({ invite, adminToken, fromBackup }: Props) {
  const { t, f } = useI18n();
  const go = useNav();
  const today = localToday();
  const locale = fromBackup?.family.prefs.locale ?? deviceLocale();
  const [step, setStep] = useState<Step>({ at: 'form' });
  const [root] = useState(generateRoot);
  const [code, setCode] = useState(invite ?? '');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [amountText, setAmountText] = useState('2');
  const [weekday, setWeekday] = useState<Weekday>(0);
  const [rateText, setRateText] = useState('12');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canonical = adminToken ? null : normalizeInviteCode(code);
  const allowance = parseAmount(amountText);
  const apr = parsePercent(rateText);
  const ok =
    (adminToken !== null || canonical !== null) &&
    (fromBackup !== null || name.trim() !== '') &&
    allowance !== null &&
    apr !== null &&
    (birthday === '' || (isIsoDate(birthday) && birthday <= today));

  async function create(e: Event) {
    e.preventDefault();
    if (!ok || allowance === null || apr === null) return;
    setBusy(true);
    setError(null);
    const family = fromBackup
      ? familyFromBackup(fromBackup.family, today)
      : newFamily(newKidDoc({ name: name.trim(), birthday: birthday || null, allowance, weekday, apr }, today), today, locale);
    const res = await FamilySession.create(root, family, adminToken ?? formatInviteCode(canonical!), today);
    setBusy(false);
    if (!res.ok) {
      setError(res.error === 'bad_invite' ? t.create.badInvite : res.error === 'network' ? t.parent.saveNetwork : t.parent.saveServer);
      return;
    }
    setParent(toBase64url(root));
    setStep({ at: 'recovery', session: res.session });
  }

  if (step.at === 'recovery') {
    const { session } = step;
    return (
      <main class="onboard">
        <h1>{t.recovery.title}</h1>
        <RecoveryFlow
          root={root}
          locale={locale}
          today={today}
          onConfirmed={async () => {
            await session.save((f) => confirmRecovery(f, today), today, { count: false });
            setStep({ at: 'ready', session });
          }}
          onLater={() => setStep({ at: 'ready', session })}
        />
      </main>
    );
  }

  if (step.at === 'ready') {
    const kids = step.session.family.kids;
    const first = kids[0]?.doc.name ?? '';
    return (
      <main class="onboard">
        <h1>{t.create.readyTitle(first)}</h1>
        <p class="sub">{t.create.readySub(first)}</p>
        {kids.map((k) => (
          <div class="card" key={k.slot}>
            <h2>{k.doc.name}</h2>
            <KidLinkCard session={step.session} slot={k.slot} name={k.doc.name} />
          </div>
        ))}
        <button type="button" class="btn" onClick={() => go({ page: 'parent', root })}>{t.create.openParent}</button>
      </main>
    );
  }

  return (
    <main class="onboard">
      <h1>{fromBackup ? t.viewer.createTitle : t.create.title}</h1>
      {fromBackup && <p class="sub">{t.viewer.createSummary(f.names(fromBackup.family.kids.map((k) => k.doc.name)))}</p>}
      <form class="card" onSubmit={(e) => void create(e)} autocomplete="off">
        {!adminToken && (
          <div class="field">
            <label for="cr-code">{t.create.inviteLabel}</label>
            <input id="cr-code" type="text" autocapitalize="characters" spellcheck={false} placeholder={t.create.invitePlaceholder} value={code} onInput={(e) => setCode(e.currentTarget.value)} />
            <p class="hint">{code.trim() && !canonical ? t.create.inviteFormat : t.create.inviteHelp}</p>
          </div>
        )}
        {!fromBackup && (
          <>
        <div class="field">
          <label for="cr-name">{t.parent.nameLabel}</label>
          <input id="cr-name" type="text" maxLength={40} value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="cr-bday">{t.parent.birthdayOptional}</label>
          <input id="cr-bday" type="date" max={today} value={birthday} onInput={(e) => setBirthday(e.currentTarget.value)} />
        </div>
        <div class="row2">
          <div class="field">
            <label for="cr-amt">{t.parent.allowanceAmount}</label>
            <input id="cr-amt" type="text" inputMode="decimal" value={amountText} onInput={(e) => setAmountText(e.currentTarget.value)} />
          </div>
          <div class="field">
            <label for="cr-day">{t.parent.weekdayLabel}</label>
            <WeekdaySelect id="cr-day" value={weekday} onChange={setWeekday} />
          </div>
        </div>
        <div class="field">
          <label for="cr-rate">{t.parent.rateInput}</label>
          <input id="cr-rate" type="text" inputMode="decimal" value={rateText} onInput={(e) => setRateText(e.currentTarget.value)} />
        </div>
          </>
        )}
        {error && <p class="err" role="alert">{error}</p>}
        <button type="submit" class="btn" disabled={!ok || busy}>
          {busy ? t.create.creating : fromBackup ? t.viewer.createSubmit : t.parent.createKid(name.trim())}
        </button>
      </form>
    </main>
  );
}

export default function CreateFamily(props: Props) {
  return (
    <ToastProvider>
      <Create {...props} />
    </ToastProvider>
  );
}
