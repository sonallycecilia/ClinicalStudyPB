import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    watch: {
      usePolling: loadEnv(mode, '.', 'WATCH_').WATCH_USE_POLLING === 'true',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}));
