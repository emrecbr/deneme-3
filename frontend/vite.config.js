import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig(async () => {
  const plugins = [react()];
  const pwaModule = await import('vite-plugin-pwa').catch(() => null);
  const keyPath = 'dev-cert/key.pem';
  const certPath = 'dev-cert/cert.pem';
  const useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);
  const httpsConfig = useHttps
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      }
    : undefined;

  if (pwaModule?.VitePWA) {
    plugins.push(
      pwaModule.VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        manifest: {
          name: 'Telepet',
          short_name: 'Telepet',
          description: 'Telepet mobil B2B RFQ uygulamasi',
          theme_color: '#1e40af',
          background_color: '#0f172a',
          display: 'standalone'
        }
      })
    );
  }

  return {
    plugins,
    server: {
      host: true,
      port: 5173,
      https: httpsConfig,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    },
    resolve: {
      alias: {
        'react-leaflet-cluster': '/src/lib/reactLeafletClusterCompat.js'
      }
    },
    build: {
      chunkSizeWarningLimit: 1500
    }
  };
});
