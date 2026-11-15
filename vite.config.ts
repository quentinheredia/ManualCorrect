import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig(({ mode }) => ({
  plugins: [react(), crx({ manifest })],
  // crxjs bundles the IIFE content script in its own pass, which skips Vite's
  // usual NODE_ENV replacement; without this React throws "process is not defined".
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
    // MC_DRY_RUN=1 npm run build: everything except the final send (see src/core/interceptor.ts).
    __MC_DRY_RUN__: JSON.stringify(process.env.MC_DRY_RUN === '1'),
  },
  build: {
    rollupOptions: {
      // popup.html is picked up from the manifest; the demo page is an extra extension page.
      input: { demo: 'demo.html' },
    },
  },
}));
