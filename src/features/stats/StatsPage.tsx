import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';

export function StatsPage() {
  return (
    <>
      <PageHeader title="Stats" subtitle="Focus, hydration and breaks over the last weeks." />
      <Card>
        <p className="text-sm text-slate-500">
          Charts and streaks arrive once there is data to show.
        </p>
      </Card>
    </>
  );
}
