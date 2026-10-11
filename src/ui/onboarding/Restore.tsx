// Page: "Restaurer avec mes 12 mots" (SPEC §10.5). Suggestions from both wordlists;
// pasting the 12 words into any box fills them all.
import { useEffect, useState } from 'preact/hooks';
import { toBase64url } from '../../crypto/base64url';
import { useI18n } from '../../i18n';
import { setParent } from '../../store/device';
import { useNav } from '../nav';

const N = 12;
type WordsModule = typeof import('../../crypto/words');

export default function Restore() {
  const { t } = useI18n();
  const go = useNav();
  const [words, setWords] = useState<string[]>(Array(N).fill(''));
  const [focused, setFocused] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mod, setMod] = useState<WordsModule | null>(null);
  useEffect(() => {
    void import('../../crypto/words').then(setMod);
  }, []);

  const focus = (i: number) => document.getElementById(`w-${Math.min(i, N - 1)}`)?.focus();
  const fill = (from: number, text: string) => {
    const parts = text.trim().split(/\s+/).filter(Boolean);
    setWords((cur) => cur.map((w, i) => (i >= from && i < from + parts.length ? parts[i - from]! : w)));
    focus(from + parts.length);
  };
  const suggestions = mod && words[focused] ? mod.suggestWords(words[focused]!, 4).filter((w) => w !== words[focused]) : [];

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { restoreFromWords } = await import('../../family/restore');
    const res = await restoreFromWords(words.join(' '));
    setBusy(false);
    if (res.ok) {
      setParent(toBase64url(res.root));
      go({ page: 'parent', root: res.root });
      return;
    }
    setError(
      res.error === 'count' ? t.restore.count(res.count)
        : res.error === 'unknown_words' ? t.restore.unknown(res.positions.map((p) => p + 1))
          : res.error === 'checksum' ? t.restore.checksum
            : res.error === 'not_found' ? t.restore.notFound
              : res.error === 'damaged' ? t.parent.damaged
                : t.parent.loadNetwork,
    );
  }

  return (
    <main class="onboard">
      <h1>{t.restore.title}</h1>
      <p class="sub">{t.restore.sub}</p>
      <form class="card" onSubmit={(e) => void submit(e)} autocomplete="off">
        <ol class="word-inputs">
          {words.map((w, i) => (
            <li key={i}>
              <input
                id={`w-${i}`}
                type="text"
                aria-label={t.restore.wordAria(i + 1)}
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
                value={w}
                onFocus={() => setFocused(i)}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  if (/\s/.test(v.trim())) fill(i, v);
                  else setWords((cur) => cur.map((x, j) => (j === i ? v.trim() : x)));
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || (e.key === 'Enter' && i < N - 1)) {
                    e.preventDefault();
                    focus(i + 1);
                  }
                }}
              />
            </li>
          ))}
        </ol>
        {suggestions.length > 0 && (
          <div class="chips" role="group" aria-label={t.restore.suggestions}>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                class="chip"
                onClick={() => {
                  setWords((cur) => cur.map((x, j) => (j === focused ? s : x)));
                  focus(focused + 1);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p class="err" role="alert">{error}</p>}
        <button type="submit" class="btn" disabled={busy || words.some((w) => !w)}>{busy ? t.restore.searching : t.restore.submit}</button>
      </form>
    </main>
  );
}
