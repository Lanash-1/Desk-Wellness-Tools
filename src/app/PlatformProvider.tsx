import { useEffect, useState, type ReactNode } from 'react';
import { getPlatform, type Platform } from '@/platform';
import { runStorageMaintenance } from '@/storage/repositories';
import { loadSettings } from '@/storage/settings';
import { PlatformContext } from './platformContext';

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlatform().then((p) => {
      if (!cancelled) setPlatform(p);
    });
    // Ensure the settings row exists, then run housekeeping.
    loadSettings()
      .then(() => runStorageMaintenance())
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Unlock audio on the first user gesture (browser autoplay policy).
  useEffect(() => {
    if (!platform) return;
    const unlock = () => platform.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [platform]);

  if (!platform) {
    return <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>;
  }
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}
