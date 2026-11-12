<?php
declare(strict_types=1);

function run_migration_v5(bool $mysql): bool
{
    if (one('SELECT version FROM schema_migrations WHERE version=?', [5])) return false;
    db()->exec($mysql
        ? 'CREATE TABLE IF NOT EXISTS apivcelar_links (hive_id CHAR(36) PRIMARY KEY, linked_by CHAR(36) NOT NULL, linked_at VARCHAR(35) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        : 'CREATE TABLE IF NOT EXISTS apivcelar_links (hive_id TEXT PRIMARY KEY, linked_by TEXT NOT NULL, linked_at TEXT NOT NULL)');
    execute_sql('INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)', [5, gmdate('Y-m-d\TH:i:s\Z')]);
    return true;
}
