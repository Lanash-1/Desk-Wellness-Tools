export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 180,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-20 rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-right tabular-nums dark:border-slate-700"
        />
        {suffix && <span className="w-8 text-slate-500">{suffix}</span>}
      </span>
    </label>
  );
}
