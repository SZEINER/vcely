<?php
declare(strict_types=1);

function column_exists(string $table, string $column, bool $mysql): bool
{
    if ($mysql) return (bool) one('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [$table, $column]);
    foreach (db()->query("PRAGMA table_info($table)")->fetchAll() as $field) {
        if ($field['name'] === $column) return true;
    }
    return false;
}

function migration_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function run_migration_v2(bool $mysql): bool
{
    if (one('SELECT version FROM schema_migrations WHERE version = ?', [2])) return false;
    $pdo = db();
    if ($mysql) {
        $pdo->exec('CREATE TABLE IF NOT EXISTS farms (id CHAR(36) PRIMARY KEY, owner_id CHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, note TEXT NOT NULL, created_at VARCHAR(35) NOT NULL, INDEX farms_owner_id (owner_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        $pdo->exec('CREATE TABLE IF NOT EXISTS farm_members (farm_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL, role VARCHAR(10) NOT NULL, created_at VARCHAR(35) NOT NULL, PRIMARY KEY (farm_id, user_id), INDEX farm_members_user_id (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        $pdo->exec('CREATE TABLE IF NOT EXISTS farm_invites (id CHAR(36) PRIMARY KEY, farm_id CHAR(36) NOT NULL, email VARCHAR(160) NOT NULL, role VARCHAR(10) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, created_by CHAR(36) NOT NULL, expires_at VARCHAR(35) NOT NULL, accepted_at VARCHAR(35) NULL, created_at VARCHAR(35) NOT NULL, INDEX farm_invites_farm_id (farm_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        if (!column_exists('apiaries', 'farm_id', true)) $pdo->exec('ALTER TABLE apiaries ADD COLUMN farm_id CHAR(36) NULL');
        if (!column_exists('apiaries', 'latitude', true)) $pdo->exec('ALTER TABLE apiaries ADD COLUMN latitude DOUBLE NULL');
        if (!column_exists('apiaries', 'longitude', true)) $pdo->exec('ALTER TABLE apiaries ADD COLUMN longitude DOUBLE NULL');
        if (!column_exists('records', 'farm_id', true)) $pdo->exec('ALTER TABLE records ADD COLUMN farm_id CHAR(36) NULL');
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS farms (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, note TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS farm_members (farm_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (farm_id, user_id))');
        $pdo->exec('CREATE TABLE IF NOT EXISTS farm_invites (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, expires_at TEXT NOT NULL, accepted_at TEXT, created_at TEXT NOT NULL)');
        if (!column_exists('apiaries', 'farm_id', false)) $pdo->exec('ALTER TABLE apiaries ADD COLUMN farm_id TEXT');
        if (!column_exists('apiaries', 'latitude', false)) $pdo->exec('ALTER TABLE apiaries ADD COLUMN latitude REAL');
        if (!column_exists('apiaries', 'longitude', false)) $pdo->exec('ALTER TABLE apiaries ADD COLUMN longitude REAL');
        if (!column_exists('records', 'farm_id', false)) $pdo->exec('ALTER TABLE records ADD COLUMN farm_id TEXT');
    }
    $now = gmdate('Y-m-d\TH:i:s\Z');
    foreach (many('SELECT id FROM users') as $user) {
        $uid = $user['id'];
        $farm = one('SELECT f.id FROM farms f JOIN farm_members m ON m.farm_id=f.id WHERE m.user_id=? AND m.role=? ORDER BY f.created_at LIMIT 1', [$uid, 'owner']);
        if (!$farm) {
            $farmId = migration_uuid();
            execute_sql('INSERT INTO farms (id, owner_id, name, note, created_at) VALUES (?,?,?,?,?)', [$farmId, $uid, 'Moje farma', '', $now]);
            execute_sql('INSERT INTO farm_members (farm_id, user_id, role, created_at) VALUES (?,?,?,?)', [$farmId, $uid, 'owner', $now]);
        } else {
            $farmId = $farm['id'];
        }
        execute_sql('UPDATE apiaries SET farm_id=? WHERE user_id=? AND farm_id IS NULL', [$farmId, $uid]);
        execute_sql('UPDATE records SET farm_id=? WHERE user_id=? AND farm_id IS NULL', [$farmId, $uid]);
    }
    if ($mysql) execute_sql('INSERT IGNORE INTO schema_migrations (version, applied_at) VALUES (?,?)', [2, $now]);
    else execute_sql('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?,?)', [2, $now]);
    return true;
}
