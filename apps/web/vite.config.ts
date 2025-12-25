import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true, // Needed for Docker hot reload
    },
  },
  resolve: {
    alias: {
      '@emekteb/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@emekteb/shared-utils': path.resolve(__dirname, '../../packages/shared-utils/src'),
    },
  },
  optimizeDeps: {
    include: ['react-pdf', 'pdf-lib'],
    exclude: ['@react-pdf/renderer'],
  },
});

