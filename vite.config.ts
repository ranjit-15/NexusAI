import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/', // Use root path for Vercel
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Forward /api requests to the local Express dev server
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});