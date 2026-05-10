import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(rootDir, 'src/popup/index.html'),
        options: resolve(rootDir, 'src/settings/index.html'),
        content: resolve(rootDir, 'src/content/content.ts'),
        background: resolve(rootDir, 'src/background/service-worker.ts')
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'content' || chunk.name === 'background' ? '[name].js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
