import { driver, get, run, executeSchema } from './db.js';

const migration = [
  `CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    salt CHAR(32) NOT NULL,
    password_hash CHAR(128) NOT NULL,
    created_at VARCHAR(35) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    expires_at VARCHAR(35) NOT NULL,
    INDEX sessions_user_id (user_id),
    INDEX sessions_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS apiaries (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(160) NOT NULL DEFAULT '',
    note TEXT NOT NULL,
    created_at VARCHAR(35) NOT NULL,
    INDEX apiaries_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hives (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    apiary_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    queen_year INT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Aktivní',
    note TEXT NOT NULL,
    created_at VARCHAR(35) NOT NULL,
    INDEX hives_user_id (user_id),
    INDEX hives_apiary_id (apiary_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS records (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    hive_id CHAR(36) NULL,
    apiary_id CHAR(36) NULL,
    type VARCHAR(30) NOT NULL,
    date CHAR(10) NOT NULL,
    title VARCHAR(120) NOT NULL,
    amount DOUBLE NULL,
    unit VARCHAR(20) NULL,
    note TEXT NOT NULL,
    created_at VARCHAR(35) NOT NULL,
    INDEX records_user_date (user_id, date),
    INDEX records_hive_id (hive_id),
    INDEX records_apiary_id (apiary_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function runMigrations() {
  if (driver === 'mysql') {
    await executeSchema(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY,
      applied_at VARCHAR(35) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    if (!await get('SELECT version FROM schema_migrations WHERE version = ?', [1])) {
      for (const statement of migration) await executeSchema(statement);
      await run('INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [1, new Date().toISOString()]);
      return 'MySQL migrace 1 dokončena.';
    } else {
      return 'MySQL schéma je aktuální.';
    }
  } else {
    return 'SQLite schéma je aktuální.';
  }
}
