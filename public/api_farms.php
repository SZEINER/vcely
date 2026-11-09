<?php
declare(strict_types=1);
require_once __DIR__ . '/api_core.php';

function user_farms(string $userId): array
{
    return many('SELECT f.*, m.role FROM farms f JOIN farm_members m ON m.farm_id=f.id WHERE m.user_id=? ORDER BY f.created_at, f.name', [$userId]);
}
function handle_farms(string $path, string $method, array $user): void
{
    $uid = $user['id'];
    if ($path === '/api/farms' && $method === 'GET') respond(['farms' => user_farms($uid)]);
    if ($path === '/api/farms' && $method === 'POST') {
        $body = request_body(); $name = clean($body['name'] ?? null, 100);
        if ($name === '') fail('Zadejte název farmy.');
        $item = ['id' => uuid(), 'owner_id' => $uid, 'name' => $name, 'note' => clean($body['note'] ?? null, 1000), 'created_at' => iso_now(), 'role' => 'owner'];
        db()->beginTransaction();
        try {
            execute_sql('INSERT INTO farms (id, owner_id, name, note, created_at) VALUES (?,?,?,?,?)', array_slice(array_values($item), 0, 5));
            execute_sql('INSERT INTO farm_members (farm_id, user_id, role, created_at) VALUES (?,?,?,?)', [$item['id'], $uid, 'owner', $item['created_at']]);
            db()->commit();
        } catch (Throwable $error) { db()->rollBack(); throw $error; }
        respond($item, 201);
    }
    if ($path === '/api/invites/accept' && $method === 'POST') {
        $body = request_body(); $token = clean($body['token'] ?? null, 128);
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) fail('Neplatná pozvánka.');
        $invite = one('SELECT * FROM farm_invites WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?', [hash('sha256', $token), iso_now()]);
        if (!$invite || mb_strtolower($invite['email']) !== mb_strtolower($user['email'])) fail('Pozvánka neexistuje, vypršela nebo je pro jiný e-mail.', 403);
        if (farm_role($invite['farm_id'], $uid)) fail('Už jste členem této farmy.', 409);
        db()->beginTransaction();
        try {
            execute_sql('INSERT INTO farm_members (farm_id, user_id, role, created_at) VALUES (?,?,?,?)', [$invite['farm_id'], $uid, $invite['role'], iso_now()]);
            execute_sql('UPDATE farm_invites SET accepted_at=? WHERE id=? AND accepted_at IS NULL', [iso_now(), $invite['id']]);
            db()->commit();
        } catch (Throwable $error) { db()->rollBack(); throw $error; }
        respond(['farm_id' => $invite['farm_id'], 'role' => $invite['role']]);
    }
    if (preg_match('~^/api/farms/([a-f0-9-]{36})$~', $path, $matches)) {
        $farmId = $matches[1];
        if ($method === 'PATCH') {
            require_farm($farmId, $uid, owner: true);
            $body = request_body(); $name = clean($body['name'] ?? null, 100);
            if ($name === '') fail('Zadejte název farmy.');
            $note = clean($body['note'] ?? null, 1000);
            execute_sql('UPDATE farms SET name=?, note=? WHERE id=?', [$name, $note, $farmId]);
            respond(['id' => $farmId, 'name' => $name, 'note' => $note]);
        }
        if ($method === 'DELETE') {
            require_farm($farmId, $uid, owner: true);
            if (one('SELECT id FROM apiaries WHERE farm_id=? LIMIT 1', [$farmId])) fail('Nejprve smažte nebo přesuňte stanoviště farmy.');
            if (one('SELECT id FROM records WHERE farm_id=? LIMIT 1', [$farmId])) fail('Farma obsahuje záznamy.');
            db()->beginTransaction();
            try {
                execute_sql('DELETE FROM farm_invites WHERE farm_id=?', [$farmId]);
                execute_sql('DELETE FROM farm_members WHERE farm_id=?', [$farmId]);
                execute_sql('DELETE FROM farms WHERE id=?', [$farmId]);
                db()->commit();
            } catch (Throwable $error) { db()->rollBack(); throw $error; }
            respond(['ok' => true]);
        }
    }
    if (preg_match('~^/api/farms/([a-f0-9-]{36})/invites$~', $path, $matches) && $method === 'POST') {
        $farmId = $matches[1]; require_farm($farmId, $uid, owner: true);
        $body = request_body(); $email = mb_strtolower(clean($body['email'] ?? null, 160)); $role = clean($body['role'] ?? null, 10);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !in_array($role, ['editor', 'viewer'], true)) fail('Zadejte platný e-mail a roli.');
        $existingUser = one('SELECT id FROM users WHERE email=?', [$email]);
        if ($existingUser && farm_role($farmId, $existingUser['id'])) fail('Uživatel už je členem farmy.', 409);
        $token = bin2hex(random_bytes(32)); $inviteId = uuid(); $now = iso_now();
        execute_sql('INSERT INTO farm_invites (id, farm_id, email, role, token_hash, created_by, expires_at, accepted_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [$inviteId, $farmId, $email, $role, hash('sha256', $token), $uid, gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400), null, $now]);
        respond(['id' => $inviteId, 'email' => $email, 'role' => $role, 'token' => $token, 'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400)], 201);
    }
    if (preg_match('~^/api/farms/([a-f0-9-]{36})/invites/([a-f0-9-]{36})$~', $path, $matches) && $method === 'DELETE') {
        require_farm($matches[1], $uid, owner: true);
        execute_sql('DELETE FROM farm_invites WHERE id=? AND farm_id=?', [$matches[2], $matches[1]]);
        respond(['ok' => true]);
    }
    if (preg_match('~^/api/farms/([a-f0-9-]{36})/members/([a-f0-9-]{36})$~', $path, $matches)) {
        [$full, $farmId, $memberId] = $matches;
        $ownRole = require_farm($farmId, $uid);
        $member = one('SELECT role FROM farm_members WHERE farm_id=? AND user_id=?', [$farmId, $memberId]);
        if (!$member) fail('Člen farmy neexistuje.', 404);
        if ($member['role'] === 'owner') fail('Vlastníka farmy nelze odebrat ani změnit.', 403);
        if ($method === 'PATCH') {
            if ($ownRole !== 'owner') fail('Role může měnit jen vlastník.', 403);
            $body = request_body(); $role = clean($body['role'] ?? null, 10);
            if (!in_array($role, ['editor', 'viewer'], true)) fail('Neplatná role.');
            execute_sql('UPDATE farm_members SET role=? WHERE farm_id=? AND user_id=?', [$role, $farmId, $memberId]);
            respond(['ok' => true, 'role' => $role]);
        }
        if ($method === 'DELETE') {
            if ($ownRole !== 'owner' && $uid !== $memberId) fail('Nemáte oprávnění odebrat člena.', 403);
            execute_sql('DELETE FROM farm_members WHERE farm_id=? AND user_id=?', [$farmId, $memberId]);
            respond(['ok' => true]);
        }
    }
}
