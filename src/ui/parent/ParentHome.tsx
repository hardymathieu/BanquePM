// The parent home (SPEC §9.1), after design/parent-view.html.
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { kidPreviewLink } from '../../crypto/links';
import { balanceOn, computeSeries } from '../../engine/ledger';
import type { FamilyDoc } from '../../engine/types';
import type { Change, FamilySession, SaveResult } from '../../family/session';
import { useI18n } from '../../i18n';
import { localToday } from '../shared/today';
import { useToast } from '../shared/Toast';
import { forgetDevice } from '../../store/device';
import { AddKidSheet } from './AddKidSheet';
import { BackupBanner } from './BackupBanner';
import { useBackup } from './useBackup';
import { PrivacyLink } from '../shared/PrivacyLink';
import { CatchUp } from './CatchUp';
import { History } from './History';
import type { KidCtx } from './kidContext';
import { MoveForm } from './MoveForm';
import { saveFailure } from './saveMessages';
import { Settings } from './Settings';
import { Sharing } from './Sharing';
import { MAX_KIDS } from '../../limits';

type Props = {
  family: FamilyDoc;
  session: FamilySession;
  save: (change: Change, opts?: { count?: boolean }) => Promise<SaveResult>;
  act: <T>(op: (s: FamilySession) => Promise<T>) => Promise<T | null>;
  revoke: (slot: number) => Promise<{ ok: true; slot: number } | { ok: false; error: string }>;
  reload: () => Promise<void>;
};

export function ParentHome({ family, session, save, revoke, act, reload }: Props) {
  const { t, f } = useI18n();
  const toast = useToast();
  const today = localToday();
  const [selected, setSelected] = useState<number | null>(family.kids[0]?.slot ?? null);
  const [adding, setAdding] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [revealWords, setRevealWords] = useState(false);
  const backup = useBackup(family, save);
  const kid = family.kids.find((k) => k.slot === selected) ?? family.kids[0];

  useEffect(() => {
    document.title = t.parent.appTitle;
  }, [t]);

  const report = useCallback(
    (res: SaveResult) => {
      const message = saveFailure(res, t);
      if (message) toast(message, !res.ok && res.error === 'conflict' ? { label: t.parent.reload, run: () => void reload() } : undefined);
      return res.ok;
    },
    [t, toast, reload],
  );

  const balance = useMemo(() => (kid ? balanceOn(computeSeries(kid.doc, today), today) : 0), [kid, today]);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setPreview(null);
    if (kid) void session.kid(kid.slot).then((k) => alive && setPreview(kidPreviewLink(location.origin, k.id, k.rawKey)));
    return () => {
      alive = false;
    };
  }, [kid?.slot, session]);

  const ctx: KidCtx | null = kid ? { slot: kid.slot, doc: kid.doc, today, save, report } : null;

  const failed = (res: { ok: boolean; error?: string } | null) => {
    if (res?.ok) return false;
    toast(res?.error === 'old_links_kept' ? t.parent.oldLinkKept : res?.error === 'network' ? t.parent.saveNetwork : res?.error === 'conflict' ? t.parent.conflict : t.parent.saveServer);
    return true;
  };
  const danger = kid && {
    download: backup.download,
    async deleteKid() {
      const res = await act((s) => s.removeKid(kid.slot, today));
      if (failed(res)) return;
      setSelected(null);
      toast(t.danger.toastKidDeleted(kid.doc.name));
    },
    async deleteAll() {
      const res = await act((s) => s.deleteFamily());
      if (failed(res)) return;
      forgetDevice();
      location.replace('/');
    },
  };

  return (
    <main class="parent">
      <p class="app">{t.parent.appTitle}</p>
      <div class="kids" role="group" aria-label={t.parent.kidsGroup}>
        {family.kids.map((k) => (
          <button key={k.slot} type="button" class="kid-tab" aria-pressed={k.slot === kid?.slot} onClick={() => setSelected(k.slot)}>
            {k.doc.name}
          </button>
        ))}
        {family.kids.length < MAX_KIDS && (
          <button type="button" class="kid-tab add" onClick={() => setAdding(true)}>
            {t.parent.addKid}
          </button>
        )}
      </div>

      {!kid || !ctx ? (
        <p class="notice">{t.parent.noKids}</p>
      ) : (
        <>
          <div class="sum">
            <div>
              <p class="lbl">{t.parent.balanceOf(kid.doc.name)}</p>
              <p class="val">{f.money(balance)}</p>
            </div>
            {preview && (
              <a href={preview} target="_blank" rel="noopener noreferrer">
                {t.parent.seeAs(kid.doc.name)}
              </a>
            )}
          </div>
          <BackupBanner
            family={family}
            today={today}
            onDownload={() => void backup.download()}
            onShare={() => void backup.share()}
            onCheckWords={() => {
              setShareOpen(true);
              setRevealWords(true);
              requestAnimationFrame(() => document.getElementById('sharing')?.scrollIntoView());
            }}
          />
          <CatchUp key={`c${kid.slot}`} ctx={ctx} />
          <section aria-labelledby="h-add">
            <h2 id="h-add">{t.parent.addMoveTitle}</h2>
            <div class="card">
              <MoveForm key={`m${kid.slot}`} ctx={ctx} editing={null} onDone={(msg) => toast(msg)} />
            </div>
          </section>
          <History key={`h${kid.slot}`} ctx={ctx} />
          <Settings key={`s${kid.slot}`} ctx={ctx} danger={danger!} />
          <div id="sharing">
            <Sharing
              key={`l${kid.slot}`}
              ctx={ctx}
              family={family}
              session={session}
              save={save}
              revoke={revoke}
              replaceWith={async (file) => !failed(await act((s) => s.replaceWith(file.family, today)))}
              backup={backup}
              open={shareOpen}
              onToggle={setShareOpen}
              revealWords={revealWords}
            />
          </div>
        </>
      )}

      <footer class="parent-footer"><PrivacyLink /></footer>

      {adding && (
        <AddKidSheet
          family={family}
          today={today}
          save={save}
          report={report}
          onClose={() => setAdding(false)}
          onAdded={(slot) => {
            setSelected(slot);
            setShareOpen(true);
          }}
        />
      )}
    </main>
  );
}
