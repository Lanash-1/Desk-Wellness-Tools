import { useState } from 'react';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/appStore';

const DISMISS_KEY = 'deskwellness.installBannerDismissed';

/** Offers to install the web app when the browser says it is installable. */
export function InstallBanner() {
  const prompt = useAppStore((s) => s.installPrompt);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!prompt || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-brand-900 dark:bg-brand-900/30">
      <div>
        <p className="font-medium">Install Desk Wellness</p>
        <p className="text-slate-600 dark:text-slate-300">
          Runs in its own window, keeps your data persistent, and shows up in your app list.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button onClick={() => void prompt()}>Install</Button>
        <Button variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
