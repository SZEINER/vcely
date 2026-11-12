import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react(), {
    name: 'exclude-local-db-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
        if (path.toLowerCase().split('/').pop() === 'config.local.php') {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        next();
      });
    },
    closeBundle() { rmSync(resolve('dist/config.local.php'), { force: true }); },
  }],
  server: { port: 5173, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/config.local.php'] }, proxy: { '/api': 'http://127.0.0.1:8014', '/run-migrace': 'http://127.0.0.1:8014' } },
});
