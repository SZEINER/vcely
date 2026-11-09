import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
export default defineConfig({ plugins: [react(), { name: 'exclude-local-db-config', closeBundle() { rmSync(resolve('dist/config.local.php'), { force: true }); } }], server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8014', '/run-migrace': 'http://127.0.0.1:8014' } } });
