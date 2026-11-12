<?php
declare(strict_types=1);
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/api_farms.php';
require_once __DIR__ . '/api_entities.php';
require_once __DIR__ . '/api_stock.php';
require_once __DIR__ . '/api_beemap.php';
require_once __DIR__ . '/api_apivcelar.php';

try {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    handle_auth($path, $method);
    $user = require_user();
    handle_beemap($path, $method);
    handle_apivcelar($path, $method, $user);
    handle_farms($path, $method, $user);
    handle_entities($path, $method, $user);
    handle_stock($path, $method, $user);
    fail('Požadovaná cesta neexistuje.', 404);
} catch (Throwable $error) {
    error_log('API chyba: ' . $error->getMessage());
    fail('Serverová chyba. Zkuste to prosím znovu.', 500);
}
