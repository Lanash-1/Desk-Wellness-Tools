/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Set VITE_BASE=/Desk-Wellness-Tools/ when deploying to GitHub Pages.
const base = process.env.VITE_BASE ?? '/';
const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    // The PWA service worker is only useful in the browser build.
    ...(isTauri
      ? []
      : [
          VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src/sw',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectRegister: false,
            manifest: {
              name: 'Desk Wellness',
              short_name: 'Desk Wellness',
              description:
                'Focus timer, hydration and break reminders for people who work at a desk all day.',
              theme_color: '#0f766e',
              background_color: '#f8fafc',
              display: 'standalone',
              scope: base,
              start_url: base,
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: 'icons/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            injectManifest: {
              globPatterns: ['**/*.{js,css,html,svg,png,ico,mp3,ogg,woff2}'],
            },
            devOptions: { enabled: false },
          }),
        ]),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Tauri expects a fixed port and no HMR surprises.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/core/**', 'src/storage/**'] },
  },
});
