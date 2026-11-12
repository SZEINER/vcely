<?php
declare(strict_types=1);

function run_migration_v4(bool $mysql): bool
{
    if (one('SELECT version FROM schema_migrations WHERE version=?', [4])) return false;
    $pdo = db();
    if ($mysql) {
        $suffix = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_sources (id VARCHAR(40) PRIMARY KEY, name VARCHAR(120) NOT NULL, url VARCHAR(500) NOT NULL, last_attempt_at VARCHAR(35) NULL, last_success_at VARCHAR(35) NULL, last_error TEXT NULL)' . $suffix);
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_outbreaks (id VARCHAR(80) PRIMARY KEY, source_id VARCHAR(40) NOT NULL, disease VARCHAR(10) NOT NULL, reference_no VARCHAR(120) NOT NULL, location TEXT NOT NULL, status VARCHAR(20) NOT NULL, valid_from CHAR(10) NULL, valid_to CHAR(10) NULL, source_updated_at VARCHAR(35) NULL, imported_at VARCHAR(35) NOT NULL, geometry_json TEXT NOT NULL, INDEX beemap_outbreaks_filter (disease,status))' . $suffix);
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_zones (id VARCHAR(80) PRIMARY KEY, source_id VARCHAR(40) NOT NULL, disease VARCHAR(10) NOT NULL, reference_no VARCHAR(120) NOT NULL, location TEXT NOT NULL, status VARCHAR(20) NOT NULL, valid_from CHAR(10) NULL, valid_to CHAR(10) NULL, source_updated_at VARCHAR(35) NULL, imported_at VARCHAR(35) NOT NULL, geometry_json LONGTEXT NOT NULL, INDEX beemap_zones_filter (disease,status))' . $suffix);
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_sync_logs (id BIGINT AUTO_INCREMENT PRIMARY KEY, source_id VARCHAR(40) NOT NULL, started_at VARCHAR(35) NOT NULL, finished_at VARCHAR(35) NOT NULL, status VARCHAR(20) NOT NULL, item_count INT NOT NULL, message TEXT NULL)' . $suffix);
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, last_attempt_at TEXT, last_success_at TEXT, last_error TEXT)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_outbreaks (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, disease TEXT NOT NULL, reference_no TEXT NOT NULL, location TEXT NOT NULL, status TEXT NOT NULL, valid_from TEXT, valid_to TEXT, source_updated_at TEXT, imported_at TEXT NOT NULL, geometry_json TEXT NOT NULL)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_zones (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, disease TEXT NOT NULL, reference_no TEXT NOT NULL, location TEXT NOT NULL, status TEXT NOT NULL, valid_from TEXT, valid_to TEXT, source_updated_at TEXT, imported_at TEXT NOT NULL, geometry_json TEXT NOT NULL)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS beemap_sync_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT NOT NULL, status TEXT NOT NULL, item_count INTEGER NOT NULL, message TEXT)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS beemap_outbreaks_filter ON beemap_outbreaks (disease,status)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS beemap_zones_filter ON beemap_zones (disease,status)');
    }
    execute_sql('INSERT INTO beemap_sources (id,name,url) VALUES (?,?,?)', ['svs-cz', 'Státní veterinární správa ČR', 'https://svs.gov.cz/mapove-vystupy-ohnisek-nebezpecnych-nakaz-a-ochrannych-pasem/']);
    execute_sql('INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)', [4, gmdate('Y-m-d\TH:i:s\Z')]);
    return true;
}
