<?php
declare(strict_types=1);

function app_config(): array
{
    $localFile = __DIR__ . '/config.local.php';
    $local = is_file($localFile) ? require $localFile : [];
    $value = static fn(string $key, mixed $default = null): mixed => getenv($key) !== false ? getenv($key) : ($local[$key] ?? $default);
    $driver = (string) $value('DB_DRIVER', 'mysql');
    if (!in_array($driver, ['sqlite', 'mysql'], true)) {
        throw new RuntimeException('Neplatný databázový ovladač.');
    }
    return [
        'driver' => $driver,
        'host' => (string) $value('DB_HOST', 'localhost'),
        'port' => (int) $value('DB_PORT', 3306),
        'name' => (string) $value('DB_NAME', ''),
        'user' => (string) $value('DB_USER', ''),
        'password' => (string) $value('DB_PASSWORD', ''),
    ];
}

function db(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) return $connection;
    $config = app_config();
    if ($config['driver'] === 'sqlite') {
        $dataDir = dirname(__DIR__) . '/data';
        if (!is_dir($dataDir) && !mkdir($dataDir, 0770, true) && !is_dir($dataDir)) {
            throw new RuntimeException('Nelze vytvořit datový adresář.');
        }
        $connection = new PDO('sqlite:' . $dataDir . '/php-dev.sqlite');
        $connection->exec('PRAGMA journal_mode=WAL');
        $connection->exec('PRAGMA foreign_keys=ON');
    } else {
        if ($config['name'] === '' || $config['user'] === '' || $config['password'] === '') {
            throw new RuntimeException('Chybí konfigurace MySQL databáze.');
        }
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['host'], $config['port'], $config['name']);
        $connection = new PDO($dsn, $config['user'], $config['password']);
    }
    $connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $connection->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $connection->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    return $connection;
}

function one(string $sql, array $params = []): array|false
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch();
}

function many(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function execute_sql(string $sql, array $params = []): void
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
}
