import { runMigrations } from './migrations.js';
import { close } from './db.js';

try {
  console.log(await runMigrations());
} catch (error) {
  console.error('Migrace selhala:', error.message);
  process.exitCode = 1;
} finally {
  await close();
}
