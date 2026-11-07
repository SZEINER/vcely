<?php
declare(strict_types=1);
require_once __DIR__ . '/migrations.php';
header('Cache-Control: no-store');
header('Content-Type: text/html; charset=utf-8');
try {
    $message = run_migrations();
} catch (Throwable $error) {
    error_log('Migrace selhala: ' . $error->getMessage());
    http_response_code(500);
    $message = 'Migrace selhala. Podrobnosti jsou v logu serveru.';
}
?><!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Migrace databáze</title><style>body{font-family:system-ui,sans-serif;background:#f6f8f5;color:#203a32;min-height:100vh;display:grid;place-items:center;margin:0;padding:20px}.card{background:white;border:1px solid #e1e9e2;border-radius:16px;padding:32px;max-width:520px;box-shadow:0 10px 30px #173f3610}h1{font-size:24px;margin:0 0 12px}p{line-height:1.6}a{color:#7d581c}</style></head><body><main class="card"><h1>Migrace databáze</h1><p><?=htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')?></p><a href="/">Zpět do aplikace</a></main></body></html>
