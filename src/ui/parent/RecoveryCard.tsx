// The recovery card (SPEC §10.4): 12 words on screen, a printable card, and a
// 3-word check. The wordlists load only here. No kid name anywhere on the card.
import { createPortal } from 'preact/compat';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { parentLink } from '../../crypto/links';
import type { IsoDate } from '../../engine/types';
import { useI18n } from '../../i18n';
import { pickPositions } from '../onboarding/model';
import { QrCode } from '../shared/QrCode';

const CHECKED = 3;

function useWords(root: Uint8Array, locale: 'fr' | 'en'): string[] | null {
  const [words, setWords] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void import('../../crypto/words').then((m) => alive && setWords(m.rootToWords(root, locale)));
    return () => {
      alive = false;
    };
  }, [root, locale]);
  return words;
}

function WordGrid({ words }: { words: string[] }) {
  const { t } = useI18n();
  return (
    <ol class="words" aria-label={t.recovery.wordsAria}>
      {words.map((w, i) => (
        <li key={i}>{w}</li>
      ))}
    </ol>
  );
}

/** Rendered into <body>, shown only when printing (see the print rules in base.css). */
function PrintCard({ words, root, today }: { words: string[]; root: Uint8Array; today: IsoDate }) {
  const { t, f } = useI18n();
  return createPortal(
    <section class="print-card" aria-hidden="true">
      <h1>{t.recovery.cardHeading}</h1>
      <p>{t.recovery.cardHost(location.host)}</p>
      <ol class="print-words">
        {words.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ol>
      <div class="print-qr">
        <QrCode text={parentLink(location.origin, root)} label={t.recovery.cardQrAria} />
        <p>{t.recovery.cardQrHelp}</p>
      </div>
      <p>{t.recovery.cardDate(f.dateLong(today))}</p>
      <p class="print-keep">{t.recovery.cardKeep}</p>
    </section>,
    document.body,
  );
}

function WordCheck({ words, onOk, onBack }: { words: string[]; onOk: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const positions = useMemo(() => pickPositions(CHECKED, words.length, () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32), [words]);
  const [typed, setTyped] = useState<string[]>(positions.map(() => ''));
  const [wrong, setWrong] = useState(false);
  const [sameWord, setSameWord] = useState<((a: string, b: string) => boolean) | null>(null);
  useEffect(() => {
    void import('../../crypto/words').then((m) => setSameWord(() => m.sameWord));
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const ok = sameWord !== null && positions.every((p, i) => sameWord(words[p]!, typed[i]!));
        setWrong(!ok);
        if (ok) onOk();
      }}
      autocomplete="off"
    >
      <h2>{t.recovery.checkTitle}</h2>
      <p class="sub">{t.recovery.checkSub}</p>
      {positions.map((p, i) => (
        <div class="field" key={p}>
          <label for={`check-${p}`}>{t.recovery.wordN(p + 1)}</label>
          <input
            id={`check-${p}`}
            type="text"
            autocapitalize="none"
            spellcheck={false}
            value={typed[i]}
            onInput={(e) => {
              const v = e.currentTarget.value;
              setTyped((cur) => cur.map((x, j) => (j === i ? v : x)));
            }}
          />
        </div>
      ))}
      {wrong && <p class="err" role="alert">{t.recovery.checkWrong}</p>}
      <button type="submit" class="btn" disabled={typed.some((x) => !x.trim())}>{t.recovery.check}</button>
      <button type="button" class="linkbtn" onClick={onBack}>{t.recovery.back}</button>
    </form>
  );
}

type FlowProps = {
  root: Uint8Array;
  locale: 'fr' | 'en';
  today: IsoDate;
  onConfirmed: () => void | Promise<void>;
  /** Onboarding only: "Je le ferai plus tard". */
  onLater?: () => void;
};

export function RecoveryFlow({ root, locale, today, onConfirmed, onLater }: FlowProps) {
  const { t } = useI18n();
  const words = useWords(root, locale);
  const [checking, setChecking] = useState(false);
  if (!words) return null;
  return (
    <div class="recovery">
      <PrintCard words={words} root={root} today={today} />
      {checking ? (
        <WordCheck words={words} onOk={() => void onConfirmed()} onBack={() => setChecking(false)} />
      ) : (
        <>
          <p class="sub">{t.recovery.explain}</p>
          <WordGrid words={words} />
          <button type="button" class="btn ghosty" onClick={() => print()}>{t.recovery.print}</button>
          <button type="button" class="btn" onClick={() => setChecking(true)}>{t.recovery.noted}</button>
          {onLater && <button type="button" class="linkbtn" onClick={onLater}>{t.recovery.later}</button>}
        </>
      )}
    </div>
  );
}
