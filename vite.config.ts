import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { PROXY_PATH, handleProxy } from './server/proxy-core.mjs';

function aetherProxy(): Plugin {
  return {
    name: 'aether-proxy',
    configureServer(server) {
      server.middlewares.use(PROXY_PATH, (req, res) => {
        void handleProxy(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(PROXY_PATH, (req, res) => {
        void handleProxy(req, res);
      });
    },
  };
}

export default defineConfig({
  // Relative base keeps the build portable (static hosting, Capacitor file:// webview).
  base: './',
  plugins: [react(), tailwindcss(), aetherProxy()],
  server: { host: true },
  preview: { host: true },
  build: { chunkSizeWarningLimit: 1500 },
});
