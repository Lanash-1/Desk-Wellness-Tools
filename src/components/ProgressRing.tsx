import type { ReactNode } from 'react';

export function ProgressRing({
  progress,
  size = 240,
  stroke = 12,
  children,
  label,
}: {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="stroke-brand-600 transition-[stroke-dashoffset] duration-500 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
