<?php
declare(strict_types=1);

function run_migration_v3(bool $mysql): bool
{
    if (one('SELECT version FROM schema_migrations WHERE version=?', [3])) return false;
    $pdo = db();
    if ($mysql) {
        $pdo->exec('CREATE TABLE IF NOT EXISTS stock_items (id CHAR(36) PRIMARY KEY, farm_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, category VARCHAR(60) NOT NULL, quantity DOUBLE NOT NULL DEFAULT 0, unit VARCHAR(20) NOT NULL, note TEXT NOT NULL, photo MEDIUMTEXT NULL, created_at VARCHAR(35) NOT NULL, INDEX stock_items_farm_id (farm_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS stock_items (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL, note TEXT NOT NULL DEFAULT \'\', photo TEXT, created_at TEXT NOT NULL)');
    }
    execute_sql('INSERT INTO schema_migrations (version, applied_at) VALUES (?,?)', [3, gmdate('Y-m-d\TH:i:s\Z')]);
    return true;
}
