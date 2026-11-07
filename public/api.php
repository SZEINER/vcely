<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function fail(string $message, int $status = 400): never
{
    respond(['error' => $message], $status);
}
function clean(mixed $value, int $length = 200): string
{
    return mb_substr(trim(is_scalar($value) ? (string) $value : ''), 0, $length);
}
function request_body(): array
{
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) fail('Požadavek je příliš velký.', 413);
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
function iso_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}
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

try {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($path === '/api/me' && $method === 'GET') respond(['user' => user_for_request() ?: null]);
    if ($path === '/api/register' && $method === 'POST') {
        $body = request_body();
        $name = clean($body['name'] ?? null, 80);
        $email = mb_strtolower(clean($body['email'] ?? null, 160));
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) fail('Vyplňte jméno, platný e-mail a heslo alespoň o 8 znacích.');
        if (one('SELECT id FROM users WHERE email=?', [$email])) fail('Účet s tímto e-mailem už existuje.', 409);
        $userId = uuid();
        try {
            execute_sql('INSERT INTO users (id, name, email, salt, password_hash, created_at) VALUES (?,?,?,?,?,?)', [$userId, $name, $email, '', password_hash($password, PASSWORD_DEFAULT), iso_now()]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') fail('Účet s tímto e-mailem už existuje.', 409);
            throw $error;
        }
        create_session($userId);
        respond(['user' => ['id' => $userId, 'name' => $name, 'email' => $email]], 201);
    }
    if ($path === '/api/login' && $method === 'POST') {
        $body = request_body();
        $email = mb_strtolower(clean($body['email'] ?? null, 160));
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        $user = one('SELECT * FROM users WHERE email=?', [$email]);
        if (!$user || !password_verify($password, $user['password_hash'])) fail('Nesprávný e-mail nebo heslo.', 401);
        create_session($user['id']);
        respond(['user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']]]);
    }
    if ($path === '/api/logout' && $method === 'POST') {
        $token = $_COOKIE['session'] ?? '';
        if (is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token)) execute_sql('DELETE FROM sessions WHERE token_hash=?', [hash('sha256', $token)]);
        cookie_token(null, 0);
        respond(['ok' => true]);
    }
    $user = require_user();
    $uid = $user['id'];
    if ($path === '/api/data' && $method === 'GET') respond([
        'apiaries' => many('SELECT * FROM apiaries WHERE user_id=? ORDER BY created_at DESC', [$uid]),
        'hives' => many('SELECT * FROM hives WHERE user_id=? ORDER BY created_at DESC', [$uid]),
        'records' => many('SELECT * FROM records WHERE user_id=? ORDER BY date DESC, created_at DESC', [$uid]),
    ]);
    if ($path === '/api/apiaries' && $method === 'POST') {
        $body = request_body();
        $name = clean($body['name'] ?? null, 100);
        if ($name === '') fail('Zadejte název stanoviště.');
        $item = ['id' => uuid(), 'user_id' => $uid, 'name' => $name, 'location' => clean($body['location'] ?? null, 160), 'note' => clean($body['note'] ?? null, 1000), 'created_at' => iso_now()];
        execute_sql('INSERT INTO apiaries (id, user_id, name, location, note, created_at) VALUES (?,?,?,?,?,?)', array_values($item));
        respond($item, 201);
    }
    if ($path === '/api/hives' && $method === 'POST') {
        $body = request_body();
        $name = clean($body['name'] ?? null, 100);
        $apiaryId = clean($body['apiary_id'] ?? null, 50);
        if ($name === '' || !one('SELECT id FROM apiaries WHERE id=? AND user_id=?', [$apiaryId, $uid])) fail('Vyberte stanoviště a zadejte název úlu.');
        $year = ($body['queen_year'] ?? '') === '' ? null : filter_var($body['queen_year'], FILTER_VALIDATE_INT);
        if ($year === false || ($year !== null && ($year < 2000 || $year > 2100))) fail('Neplatný rok matky.');
        $item = ['id' => uuid(), 'user_id' => $uid, 'apiary_id' => $apiaryId, 'name' => $name, 'queen_year' => $year, 'status' => clean($body['status'] ?? null, 40) ?: 'Aktivní', 'note' => clean($body['note'] ?? null, 1000), 'created_at' => iso_now()];
        execute_sql('INSERT INTO hives (id, user_id, apiary_id, name, queen_year, status, note, created_at) VALUES (?,?,?,?,?,?,?,?)', array_values($item));
        respond($item, 201);
    }
    if ($path === '/api/records' && $method === 'POST') {
        $body = request_body();
        $type = clean($body['type'] ?? null, 30);
        $date = clean($body['date'] ?? null, 10);
        $title = clean($body['title'] ?? null, 120);
        $hiveId = clean($body['hive_id'] ?? null, 50) ?: null;
        $apiaryId = clean($body['apiary_id'] ?? null, 50) ?: null;
        if (!in_array($type, ['Prohlídka', 'Krmení', 'Léčení', 'Med', 'Finance', 'Poznámka'], true) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $title === '') fail('Vyplňte typ, datum a název záznamu.');
        if ($hiveId && !one('SELECT id FROM hives WHERE id=? AND user_id=?', [$hiveId, $uid])) fail('Neplatný úl.');
        if ($apiaryId && !one('SELECT id FROM apiaries WHERE id=? AND user_id=?', [$apiaryId, $uid])) fail('Neplatné stanoviště.');
        $amount = ($body['amount'] ?? '') === '' ? null : filter_var($body['amount'], FILTER_VALIDATE_FLOAT);
        if ($amount === false) fail('Neplatné množství.');
        $item = ['id' => uuid(), 'user_id' => $uid, 'hive_id' => $hiveId, 'apiary_id' => $apiaryId, 'type' => $type, 'date' => $date, 'title' => $title, 'amount' => $amount, 'unit' => clean($body['unit'] ?? null, 20) ?: null, 'note' => clean($body['note'] ?? null, 2000), 'created_at' => iso_now()];
        execute_sql('INSERT INTO records (id, user_id, hive_id, apiary_id, type, date, title, amount, unit, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', array_values($item));
        respond($item, 201);
    }
    if (preg_match('~^/api/(apiaries|hives|records)/([a-f0-9-]{36})$~', $path, $matches) && $method === 'DELETE') {
        $table = $matches[1];
        $itemId = $matches[2];
        if (!one("SELECT id FROM $table WHERE id=? AND user_id=?", [$itemId, $uid])) fail('Záznam neexistuje.', 404);
        if ($table === 'apiaries' && one('SELECT id FROM hives WHERE apiary_id=? AND user_id=?', [$itemId, $uid])) fail('Stanoviště obsahuje úly.');
        if ($table === 'hives' && one('SELECT id FROM records WHERE hive_id=? AND user_id=?', [$itemId, $uid])) fail('Úl obsahuje záznamy.');
        execute_sql("DELETE FROM $table WHERE id=? AND user_id=?", [$itemId, $uid]);
        respond(['ok' => true]);
    }
    fail('Požadovaná cesta neexistuje.', 404);
} catch (Throwable $error) {
    error_log('API chyba: ' . $error->getMessage());
    fail('Serverová chyba. Zkuste to prosím znovu.', 500);
}
