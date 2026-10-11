// Page: the offline viewer (SPEC §11). Reads an export file in the browser and shows it
// read-only, parent side or kid side. No API call: everything is computed from the file.
import { useState } from 'preact/hooks';
import { balanceOn, computeSeries } from '../../engine/ledger';
import { projectForKid } from '../../engine/project';
import type { ExportFile } from '../../engine/types';
import { useI18n } from '../../i18n';
import { KidScreen } from '../kid/KidScreen';
import { useNav } from '../nav';
import { historyRows } from '../parent/model';
import { Segmented } from '../shared/Segmented';
import { localToday } from '../shared/today';
import Landing from './Landing';

export default function BackupViewer({ file }: { file: ExportFile | null }) {
  const { t, f } = useI18n();
  const go = useNav();
  const today = localToday();
  const [slot, setSlot] = useState(file?.family.kids[0]?.slot ?? 0);
  const [view, setView] = useState<'parent' | 'kid'>('parent');
  if (!file) return <Landing />;
  const kid = file.family.kids.find((k) => k.slot === slot) ?? file.family.kids[0];

  return (
    <main class="onboard viewer">
      <h1>{t.viewer.title}</h1>
      <p class="promise">{t.viewer.readOnly(f.dateLong(file.exportedOn))}</p>
      <div class="kids" role="group" aria-label={t.parent.kidsGroup}>
        {file.family.kids.map((k) => (
          <button key={k.slot} type="button" class="kid-tab" aria-pressed={k.slot === kid?.slot} onClick={() => setSlot(k.slot)}>
            {k.doc.name}
          </button>
        ))}
      </div>
      {kid && (
        <>
          <div class="view-switch">
            <Segmented
              label={t.viewer.viewGroup}
              value={view}
              onChange={setView}
              options={[
                { value: 'parent', label: t.viewer.parentView, class: 'dep' },
                { value: 'kid', label: t.viewer.kidView, class: 'dep' },
              ]}
            />
          </div>
          {view === 'kid' ? (
            <KidScreen doc={projectForKid(kid.doc, file.exportedOn)} today={today} staleSince={null} embedded />
          ) : (
            <>
              <div class="sum">
                <div>
                  <p class="lbl">{t.parent.balanceOf(kid.doc.name)}</p>
                  <p class="val">{f.money(balanceOn(computeSeries(kid.doc, today), today))}</p>
                </div>
              </div>
              <section aria-labelledby="h-vhist">
                <h2 id="h-vhist">{t.parent.historyTitle}</h2>
                <ul class="card hist">
                  {historyRows(kid.doc).map((r) => (
                    <li key={r.key} class={`h${r.kind === 'move' && r.amount < 0 ? ' out' : r.kind === 'kept' ? ' kept' : ''}`}>
                      <span>
                        <span class="kn">
                          {r.kind === 'move' ? r.kidNote || (r.amount < 0 ? t.parent.withdrawal : t.parent.deposit) : r.kind === 'kept' ? t.parent.keptRow : t.parent.coinRow(f.weekdayName(r.weekday))}
                        </span>
                        {r.kind === 'move' && r.privateNote && <span class="pn lock">{r.privateNote}</span>}
                        <span class="dt">{f.dateWithDay(r.date)}</span>
                      </span>
                      <span class="am">{r.kind === 'kept' ? t.parent.keptAmount : f.signedMoney(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
      <section class="card">
        <p class="sub">{t.viewer.createHelp}</p>
        <button type="button" class="btn" onClick={() => go({ page: 'create', invite: null, fromBackup: file })}>{t.viewer.createFromBackup}</button>
        <button type="button" class="btn ghosty" onClick={() => go({ page: 'landing' })}>{t.viewer.close}</button>
      </section>
    </main>
  );
}
