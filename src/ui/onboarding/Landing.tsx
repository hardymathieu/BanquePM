// Page: "/" when this device remembers no kid (SPEC §2).
import { useState } from 'preact/hooks';
import { parseExportFile } from '../../engine/backup';
import { useI18n } from '../../i18n';
import { getParent } from '../../store/device';
import { useNav } from '../nav';
import { readJsonFile } from '../shared/files';

export default function Landing() {
  const { t } = useI18n();
  const go = useNav();
  const hasParent = getParent() !== null;
  const [bad, setBad] = useState(false);
  return (
    <main class="onboard">
      <h1>{t.app.name}</h1>
      <p class="lede">{t.landing.lede}</p>
      <p class="promise">{t.landing.promise}</p>
      <div class="actions">
        {hasParent && <button type="button" class="btn" onClick={() => go({ page: 'parent', root: null })}>{t.landing.openParent}</button>}
        <button type="button" class={hasParent ? 'btn ghosty' : 'btn'} onClick={() => go({ page: 'create', invite: null })}>{t.landing.invite}</button>
        <button type="button" class="btn ghosty" onClick={() => go({ page: 'restore' })}>{t.landing.restore}</button>
        <label class="btn ghosty file-btn">
          {t.viewer.openBackup}
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const input = e.currentTarget;
              const picked = input.files?.[0];
              input.value = '';
              if (!picked) return;
              const file = parseExportFile(await readJsonFile(picked));
              setBad(!file);
              if (file) go({ page: 'backup', file });
            }}
          />
        </label>
        {bad && <p class="err" role="alert">{t.backup.notABackup}</p>}
      </div>
      <p class="hint">{t.landing.kidHint}</p>
    </main>
  );
}
