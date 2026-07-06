import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Note: GEMINI_API_KEY is intentionally NOT injected into the client.
    // Content generation is proxied through the server (/api/gemini) so the
    // key never ships in the browser bundle.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy libraries into their own chunks so the main bundle
          // stays small and these can be cached independently by the browser.
          manualChunks: {
            charts: ['recharts'],
            markdown: ['react-markdown', 'remark-gfm'],
            motion: ['motion'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
