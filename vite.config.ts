import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/optimizely-proxy': {
        target: 'https://api.cms.optimizely.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/optimizely-proxy/, ''),
      },
    },
  },
});
