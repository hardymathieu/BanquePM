// Deletion needs the kid's name (or SUPPRIMER) typed, and offers an export first (SPEC §9.5).
import { useState } from 'preact/hooks';
import { useI18n } from '../../i18n';
import { Sheet } from '../shared/Sheet';

type Props = { title: string; text: string; word: string; onDownload: () => void; onConfirm: () => Promise<void>; onClose: () => void };

export function ConfirmDelete({ title, text, word, onDownload, onConfirm, onClose }: Props) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toLocaleLowerCase() === word.toLocaleLowerCase();
  return (
    <Sheet title={title} onClose={onClose}>
      <p class="sub">{text}</p>
      <button type="button" class="btn ghosty" onClick={onDownload}>{t.backup.download}</button>
      <div class="field">
        <label for="del-word">{t.danger.typeToConfirm(word)}</label>
        <input id="del-word" type="text" autocomplete="off" spellcheck={false} value={typed} onInput={(e) => setTyped(e.currentTarget.value)} />
      </div>
      <button
        type="button"
        class="btn danger"
        disabled={!ok || busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
        }}
      >
        {t.danger.delete}
      </button>
    </Sheet>
  );
}
