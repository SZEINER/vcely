<?php
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($path, '/api/')) {
    require __DIR__ . '/api.php';
    return true;
}
if ($path === '/run-migrace' || $path === '/run-migrace/') {
    require __DIR__ . '/run-migrace.php';
    return true;
}
if (is_file(__DIR__ . $path)) return false;
if (is_file(__DIR__ . '/index.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    return true;
}
http_response_code(404);
echo 'Nenalezeno.';
