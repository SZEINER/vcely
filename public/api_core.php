<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function fail(string $message, int $status = 400): never { respond(['error' => $message], $status); }
function clean(mixed $value, int $length = 200): string { return mb_substr(trim(is_scalar($value) ? (string) $value : ''), 0, $length); }
function request_body(): array
{
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 500000) fail('Požadavek je příliš velký.', 413);
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($body)) fail('Neplatný JSON.');
    return $body;
}
function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}
function iso_now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function cookie_token(?string $token, int $age): void
{
    setcookie('session', $token ?? '', [
        'expires' => $age ? time() + $age : time() - 3600,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
function user_for_request(): array|false
{
    $token = $_COOKIE['session'] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) return false;
    return one('SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?', [hash('sha256', $token), iso_now()]);
}
function require_user(): array
{
    $user = user_for_request();
    if (!$user) fail('Nejste přihlášeni.', 401);
    return $user;
}
function create_session(string $userId): void
{
    $token = bin2hex(random_bytes(32));
    execute_sql('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)', [hash('sha256', $token), $userId, gmdate('Y-m-d\TH:i:s\Z', time() + 30 * 86400)]);
    cookie_token($token, 30 * 86400);
}
function farm_role(string $farmId, string $userId): string|false
{
    $row = one('SELECT role FROM farm_members WHERE farm_id=? AND user_id=?', [$farmId, $userId]);
    return $row['role'] ?? false;
}
function require_farm(string $farmId, string $userId, bool $write = false, bool $owner = false): string
{
    $role = farm_role($farmId, $userId);
    if (!$role) fail('Farma neexistuje nebo k ní nemáte přístup.', 404);
    if ($owner && $role !== 'owner') fail('Tuto akci může provést jen vlastník farmy.', 403);
    if ($write && !in_array($role, ['owner', 'editor'], true)) fail('Pro tuto akci nemáte oprávnění.', 403);
    return $role;
}
