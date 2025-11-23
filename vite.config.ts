import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // Copy service worker and manifest to dist after build
        {
          name: 'copy-pwa-files',
          closeBundle() {
            const filesToCopy = [
              { src: 'service-worker.js', dest: 'dist/service-worker.js' },
              { src: 'manifest.json', dest: 'dist/manifest.json' }
            ];

            filesToCopy.forEach(({ src, dest }) => {
              if (existsSync(src)) {
                copyFileSync(src, dest);
                console.log(`✓ Copied ${src} to ${dest}`);
              } else {
                console.warn(`⚠ Warning: ${src} not found, skipping copy`);
              }
            });
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
