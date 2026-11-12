<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/migrations.php';
require __DIR__ . '/api_beemap.php';
run_migrations();
$result = beemap_sync();
fwrite($result['ok'] ? STDOUT : STDERR, json_encode($result, JSON_UNESCAPED_UNICODE) . PHP_EOL);
exit($result['ok'] ? 0 : 1);
