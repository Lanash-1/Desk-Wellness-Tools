import { create } from 'zustand';

/** Small UI-level state that doesn't belong to a feature: PWA update and install prompts. */
interface AppStore {
  updateReady: boolean;
  applyUpdate: (() => Promise<void>) | null;
  installPrompt: (() => Promise<boolean>) | null;
  setUpdate(apply: () => Promise<void>): void;
  setInstallPrompt(prompt: (() => Promise<boolean>) | null): void;
}

export const useAppStore = create<AppStore>((set) => ({
  updateReady: false,
  applyUpdate: null,
  installPrompt: null,
  setUpdate(apply) {
    set({ updateReady: true, applyUpdate: apply });
  },
  setInstallPrompt(prompt) {
    set({ installPrompt: prompt });
  },
}));
