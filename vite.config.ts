import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:5276',
        changeOrigin: true,
        secure: false,
      },
      '/hubs': {
        target: 'http://localhost:5276',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
