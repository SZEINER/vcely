<?php
declare(strict_types=1);
require_once __DIR__ . '/api_core.php';

function stock_fields(array $body): array
{
    $name = clean($body['name'] ?? null, 120);
    if ($name === '') fail('Zadejte název zásoby.');
    $quantity = filter_var($body['quantity'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($quantity === false || !is_finite((float) $quantity) || $quantity < 0) fail('Zadejte nezáporné množství.');
    $photo = $body['photo'] ?? null;
    if ($photo === '') $photo = null;
    if ($photo !== null && (!is_string($photo) || strlen($photo) > 400000 || !preg_match('~^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$~', $photo))) fail('Fotka musí být JPG, PNG nebo WebP a mít nejvýše 300 kB.');
    return [$name, clean($body['category'] ?? null, 60), (float) $quantity, clean($body['unit'] ?? null, 20) ?: 'ks', clean($body['note'] ?? null, 1000), $photo];
}

function handle_stock(string $path, string $method, array $user): void
{
    if ($path === '/api/stock' && $method === 'POST') {
        $body = request_body(); $farmId = clean($body['farm_id'] ?? null, 50);
        require_farm($farmId, $user['id'], write: true);
        $fields = stock_fields($body); $id = uuid();
        execute_sql('INSERT INTO stock_items (id, farm_id, name, category, quantity, unit, note, photo, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [$id, $farmId, ...$fields, iso_now()]);
        respond(['id' => $id], 201);
    }
    if (!preg_match('~^/api/stock/([a-f0-9-]{36})$~', $path, $matches)) return;
    $item = one('SELECT * FROM stock_items WHERE id=?', [$matches[1]]);
    if (!$item) fail('Položka skladu neexistuje.', 404);
    require_farm($item['farm_id'], $user['id'], write: $method !== 'GET');
    if ($method === 'GET') respond($item);
    if ($method === 'PATCH') {
        [$name,$category,$quantity,$unit,$note,$photo] = stock_fields(request_body());
        execute_sql('UPDATE stock_items SET name=?, category=?, quantity=?, unit=?, note=?, photo=? WHERE id=?', [$name,$category,$quantity,$unit,$note,$photo,$item['id']]);
        respond(['ok' => true]);
    }
    if ($method === 'DELETE') {
        execute_sql('DELETE FROM stock_items WHERE id=?', [$item['id']]);
        respond(['ok' => true]);
    }
}
