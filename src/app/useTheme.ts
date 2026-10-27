import { useEffect } from 'react';
import { useSettings } from './useSettings';

/** Applies the `dark` class on <html> according to the theme setting. */
export function useTheme(): void {
  const theme = useSettings()?.theme ?? 'system';
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
