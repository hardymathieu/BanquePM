// Bottom sheet on a native <dialog>: focus trap, Escape and backdrop close for free.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useI18n } from '../../i18n';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div class="sheet-head">
        <h3 id="sheet-title">{title}</h3>
        <button type="button" class="sheet-close" aria-label={t.parent.close} onClick={() => ref.current?.close()}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
