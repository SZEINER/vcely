import { spawn, spawnSync } from 'node:child_process';

const env = { ...process.env, DB_DRIVER: 'sqlite' };
const migration = spawnSync('php', ['-r', "require 'public/migrations.php'; echo run_migrations(), PHP_EOL;"], {
  stdio: 'inherit',
  env,
});
if (migration.status !== 0) process.exit(migration.status ?? 1);

const php = spawn('php', ['-S', '127.0.0.1:8014', '-t', 'public', 'public/router.php'], {
  stdio: 'inherit',
  env,
});
php.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => php.kill('SIGINT'));
process.on('SIGTERM', () => php.kill('SIGTERM'));
