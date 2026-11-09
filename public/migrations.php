<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/migrations_v2.php';

function run_migrations(): string
{
    $pdo = db();
    $mysql = app_config()['driver'] === 'mysql';
    $pdo->exec($mysql
        ? 'CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at VARCHAR(35) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        : 'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    $createdV1 = !one('SELECT version FROM schema_migrations WHERE version = ?', [1]);
    if ($createdV1 && $mysql) {
        $statements = [
            'CREATE TABLE IF NOT EXISTS users (id CHAR(36) PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE, salt CHAR(32) NOT NULL DEFAULT \'\', password_hash VARCHAR(255) NOT NULL, created_at VARCHAR(35) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS sessions (token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, expires_at VARCHAR(35) NOT NULL, INDEX sessions_user_id (user_id), INDEX sessions_expires_at (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS apiaries (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, location VARCHAR(160) NOT NULL DEFAULT \'\', note TEXT NOT NULL, created_at VARCHAR(35) NOT NULL, INDEX apiaries_user_id (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS hives (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, apiary_id CHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, queen_year INT NULL, status VARCHAR(40) NOT NULL DEFAULT \'Aktivní\', note TEXT NOT NULL, created_at VARCHAR(35) NOT NULL, INDEX hives_user_id (user_id), INDEX hives_apiary_id (apiary_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS records (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, hive_id CHAR(36) NULL, apiary_id CHAR(36) NULL, type VARCHAR(30) NOT NULL, date CHAR(10) NOT NULL, title VARCHAR(120) NOT NULL, amount DOUBLE NULL, unit VARCHAR(20) NULL, note TEXT NOT NULL, created_at VARCHAR(35) NOT NULL, INDEX records_user_date (user_id, date), INDEX records_hive_id (hive_id), INDEX records_apiary_id (apiary_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        ];
    } elseif ($createdV1) {
        $statements = [
            'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL DEFAULT \'\', password_hash TEXT NOT NULL, created_at TEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS apiaries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT \'\', note TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS hives (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, apiary_id TEXT NOT NULL, name TEXT NOT NULL, queen_year INTEGER, status TEXT NOT NULL DEFAULT \'Aktivní\', note TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, hive_id TEXT, apiary_id TEXT, type TEXT NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL, amount REAL, unit TEXT, note TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL)',
        ];
    }
    if ($createdV1) {
        foreach ($statements as $statement) $pdo->exec($statement);
        if ($mysql) execute_sql('INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [1, gmdate('Y-m-d\TH:i:s\Z')]);
        else execute_sql('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [1, gmdate('Y-m-d\TH:i:s\Z')]);
    }
    $createdV2 = run_migration_v2($mysql);
    return ($createdV1 || $createdV2) ? 'Databázové migrace dokončeny.' : 'Databázové schéma je aktuální.';
}
