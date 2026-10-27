import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { useSettings } from '@/app/useSettings';

export function WaterPage() {
  const settings = useSettings();
  return (
    <>
      <PageHeader
        title="Water"
        subtitle="Track your intake and get a nudge when it's been a while."
      />
      <Card>
        <p className="text-3xl font-semibold">0 / {settings?.waterGoalMl ?? '…'} ml</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(settings?.waterQuickAddMl ?? []).map((ml) => (
            <button
              key={ml}
              type="button"
              disabled
              className="rounded-full border border-slate-300 px-4 py-1.5 text-sm opacity-60 dark:border-slate-700"
              title="Coming in the next milestone"
            >
              +{ml} ml
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
