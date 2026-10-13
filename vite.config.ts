/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

/**
 * Serves api/feed.ts during `vite dev`, so local development exercises the
 * same edge code path as production on Vercel.
 */
function edgeFeedInDev(): Plugin {
  return {
    name: 'helioshield-edge-feed',
    configureServer(server) {
      server.middlewares.use('/api/feed', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/feed.ts');
          const response: Response = await mod.default(new Request(`http://localhost${req.originalUrl}`));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    edgeFeedInDev(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'HelioShield',
        short_name: 'HelioShield',
        description: 'Live space weather from NOAA and NASA instruments, with replays of historic storms.',
        lang: 'en',
        theme_color: '#0e0d0b',
        background_color: '#0e0d0b',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Only the scripts Turkish and English need; the 3D chunk is cached on first use.
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,vietnamese}-*', '**/Scene3D-*.js'],
        navigateFallbackDenylist: [/^\/api\//, /^\/archive\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/feed'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'feeds',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 20, maxAgeSeconds: 86_400 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'assets', expiration: { maxEntries: 60 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/archive/'),
            handler: 'CacheFirst',
            options: { cacheName: 'archive', expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    // three.js is one lazy chunk by design; it only loads when the 3D view is on screen.
    chunkSizeWarningLimit: 1000,
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
