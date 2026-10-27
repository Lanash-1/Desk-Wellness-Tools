import type { Platform } from './types';

/**
 * Shared HTMLAudioElement-based sound player used by both platforms.
 * Browsers block audio until a user gesture; unlock() plays a silent clip once to lift that.
 */
export function createAudio(baseUrl: string): Platform['audio'] {
  const cache = new Map<string, HTMLAudioElement>();
  let unlocked = false;

  function element(soundId: string): HTMLAudioElement {
    let el = cache.get(soundId);
    if (!el) {
      el = new Audio(`${baseUrl}sounds/${soundId}.wav`);
      el.preload = 'auto';
      cache.set(soundId, el);
    }
    return el;
  }

  return {
    unlock() {
      if (unlocked) return;
      unlocked = true;
      // A tiny silent WAV; playing it inside a gesture unlocks the audio context.
      const silent = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
      );
      silent.volume = 0;
      silent.play().catch(() => {
        unlocked = false;
      });
    },
    async play(soundId, volume) {
      const el = element(soundId);
      el.volume = Math.min(1, Math.max(0, volume));
      el.currentTime = 0;
      try {
        await el.play();
      } catch {
        // Autoplay blocked or file missing – reminders still show visually.
      }
    },
  };
}
