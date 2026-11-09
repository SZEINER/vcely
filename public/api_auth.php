<?php
declare(strict_types=1);
require_once __DIR__ . '/api_core.php';

function handle_auth(string $path, string $method): void
{
    if ($path === '/api/me' && $method === 'GET') respond(['user' => user_for_request() ?: null]);
    if ($path === '/api/register' && $method === 'POST') {
        $body = request_body();
        $name = clean($body['name'] ?? null, 80);
        $email = mb_strtolower(clean($body['email'] ?? null, 160));
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) fail('Vyplňte jméno, platný e-mail a heslo alespoň o 8 znacích.');
        if (one('SELECT id FROM users WHERE email=?', [$email])) fail('Účet s tímto e-mailem už existuje.', 409);
        $userId = uuid(); $farmId = uuid(); $now = iso_now();
        db()->beginTransaction();
        try {
            execute_sql('INSERT INTO users (id, name, email, salt, password_hash, created_at) VALUES (?,?,?,?,?,?)', [$userId, $name, $email, '', password_hash($password, PASSWORD_DEFAULT), $now]);
            execute_sql('INSERT INTO farms (id, owner_id, name, note, created_at) VALUES (?,?,?,?,?)', [$farmId, $userId, 'Moje farma', '', $now]);
            execute_sql('INSERT INTO farm_members (farm_id, user_id, role, created_at) VALUES (?,?,?,?)', [$farmId, $userId, 'owner', $now]);
            db()->commit();
        } catch (PDOException $error) {
            db()->rollBack();
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
    if ($path === '/api/profile' && $method === 'PATCH') {
        $user = require_user();
        $body = request_body();
        $name = clean($body['name'] ?? $user['name'], 80);
        $email = mb_strtolower(clean($body['email'] ?? $user['email'], 160));
        $current = is_string($body['current_password'] ?? null) ? $body['current_password'] : '';
        $new = is_string($body['new_password'] ?? null) ? $body['new_password'] : '';
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Vyplňte jméno a platný e-mail.');
        if ($new !== '' && strlen($new) < 8) fail('Nové heslo musí mít alespoň 8 znaků.');
        if ($email !== $user['email'] || $new !== '') {
            $stored = one('SELECT password_hash FROM users WHERE id=?', [$user['id']]);
            if ($current === '' || !$stored || !password_verify($current, $stored['password_hash'])) fail('Potvrďte změnu současným heslem.', 403);
        }
        try {
            if ($new !== '') execute_sql('UPDATE users SET name=?, email=?, password_hash=? WHERE id=?', [$name, $email, password_hash($new, PASSWORD_DEFAULT), $user['id']]);
            else execute_sql('UPDATE users SET name=?, email=? WHERE id=?', [$name, $email, $user['id']]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') fail('E-mail už používá jiný účet.', 409);
            throw $error;
        }
        respond(['user' => ['id' => $user['id'], 'name' => $name, 'email' => $email]]);
    }
}
