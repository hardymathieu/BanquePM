// Two or more mutually exclusive buttons (aria-pressed), e.g. Dépôt / Retrait, Banque / Gardée.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; class?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" class={o.class} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
