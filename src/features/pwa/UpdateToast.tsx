import { Button } from '@/components/Button';
import { useAppStore } from '@/store/appStore';

/** Shown when a new version of the web app has been downloaded by the service worker. */
export function UpdateToast() {
  const ready = useAppStore((s) => s.updateReady);
  const apply = useAppStore((s) => s.applyUpdate);
  if (!ready || !apply) return null;
  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-lg md:bottom-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <span>A new version is ready.</span>
      <Button className="px-3 py-1 text-xs" onClick={() => void apply()}>
        Reload
      </Button>
    </div>
  );
}
