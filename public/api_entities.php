<?php
declare(strict_types=1);
require_once __DIR__ . '/api_core.php';
require_once __DIR__ . '/api_farms.php';

function coordinate(mixed $value, float $min, float $max): ?float
{
    if ($value === null || $value === '') return null;
    if (!is_numeric($value)) fail('Souřadnice musí být číslo.');
    $number = (float) $value;
    if (!is_finite($number) || $number < $min || $number > $max) fail('Souřadnice jsou mimo povolený rozsah.');
    return $number;
}
function record_fields(array $body, string $farmId, string $uid): array
{
    $type = clean($body['type'] ?? null, 30); $date = clean($body['date'] ?? null, 10); $title = clean($body['title'] ?? null, 120);
    $hiveId = clean($body['hive_id'] ?? null, 50) ?: null; $apiaryId = clean($body['apiary_id'] ?? null, 50) ?: null;
    if (!in_array($type, ['Prohlídka', 'Krmení', 'Léčení', 'Med', 'Finance', 'Poznámka'], true) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $title === '') fail('Vyplňte typ, datum a název záznamu.');
    if ($hiveId) {
        $hive = one('SELECT h.id, h.apiary_id FROM hives h JOIN apiaries a ON a.id=h.apiary_id WHERE h.id=? AND a.farm_id=?', [$hiveId, $farmId]);
        if (!$hive) fail('Neplatný úl.');
        if ($apiaryId && $apiaryId !== $hive['apiary_id']) fail('Úl nepatří do vybraného stanoviště.');
        $apiaryId = $hive['apiary_id'];
    }
    if ($apiaryId && !one('SELECT id FROM apiaries WHERE id=? AND farm_id=?', [$apiaryId, $farmId])) fail('Neplatné stanoviště.');
    $amount = ($body['amount'] ?? '') === '' ? null : filter_var($body['amount'], FILTER_VALIDATE_FLOAT);
    if ($amount === false || ($amount !== null && !is_finite((float) $amount))) fail('Neplatné množství.');
    return [$hiveId, $apiaryId, $type, $date, $title, $amount, clean($body['unit'] ?? null, 20) ?: null, clean($body['note'] ?? null, 2000)];
}
function handle_entities(string $path, string $method, array $user): void
{
    $uid = $user['id'];
    if ($path === '/api/data' && $method === 'GET') {
        $farms = user_farms($uid);
        $farmId = clean($_GET['farm_id'] ?? ($farms[0]['id'] ?? ''), 50);
        if ($farmId === '') respond(['farms' => [], 'farm' => null, 'apiaries' => [], 'hives' => [], 'records' => [], 'members' => [], 'invites' => []]);
        $role = require_farm($farmId, $uid);
        $farm = one('SELECT * FROM farms WHERE id=?', [$farmId]);
        $farm['role'] = $role;
        respond([
            'farms' => $farms,
            'farm' => $farm,
            'apiaries' => many('SELECT * FROM apiaries WHERE farm_id=? ORDER BY created_at DESC', [$farmId]),
            'hives' => many('SELECT h.* FROM hives h JOIN apiaries a ON a.id=h.apiary_id WHERE a.farm_id=? ORDER BY h.created_at DESC', [$farmId]),
            'records' => many('SELECT * FROM records WHERE farm_id=? ORDER BY date DESC, created_at DESC', [$farmId]),
            'members' => many('SELECT u.id, u.name, u.email, m.role, m.created_at FROM farm_members m JOIN users u ON u.id=m.user_id WHERE m.farm_id=? ORDER BY m.role, u.name', [$farmId]),
            'invites' => $role === 'owner' ? many('SELECT id, email, role, expires_at, created_at FROM farm_invites WHERE farm_id=? AND accepted_at IS NULL AND expires_at>? ORDER BY created_at DESC', [$farmId, iso_now()]) : [],
        ]);
    }
    if ($path === '/api/apiaries' && $method === 'POST') {
        $body = request_body(); $farmId = clean($body['farm_id'] ?? null, 50);
        require_farm($farmId, $uid, write: true);
        $name = clean($body['name'] ?? null, 100); if ($name === '') fail('Zadejte název stanoviště.');
        $lat = coordinate($body['latitude'] ?? null, -90, 90); $lng = coordinate($body['longitude'] ?? null, -180, 180);
        if (($lat === null) !== ($lng === null)) fail('Vyplňte obě souřadnice nebo žádnou.');
        $item = ['id' => uuid(), 'user_id' => $uid, 'name' => $name, 'location' => clean($body['location'] ?? null, 160), 'note' => clean($body['note'] ?? null, 1000), 'created_at' => iso_now(), 'farm_id' => $farmId, 'latitude' => $lat, 'longitude' => $lng];
        execute_sql('INSERT INTO apiaries (id, user_id, name, location, note, created_at, farm_id, latitude, longitude) VALUES (?,?,?,?,?,?,?,?,?)', array_values($item));
        respond($item, 201);
    }
    if ($path === '/api/hives' && $method === 'POST') {
        $body = request_body(); $apiaryId = clean($body['apiary_id'] ?? null, 50); $name = clean($body['name'] ?? null, 100);
        $apiary = one('SELECT farm_id FROM apiaries WHERE id=?', [$apiaryId]);
        if (!$apiary || $name === '') fail('Vyberte stanoviště a zadejte název úlu.');
        require_farm($apiary['farm_id'], $uid, write: true);
        $year = ($body['queen_year'] ?? '') === '' ? null : filter_var($body['queen_year'], FILTER_VALIDATE_INT);
        if ($year === false || ($year !== null && ($year < 2000 || $year > 2100))) fail('Neplatný rok matky.');
        $item = ['id' => uuid(), 'user_id' => $uid, 'apiary_id' => $apiaryId, 'name' => $name, 'queen_year' => $year, 'status' => clean($body['status'] ?? null, 40) ?: 'Aktivní', 'note' => clean($body['note'] ?? null, 1000), 'created_at' => iso_now()];
        execute_sql('INSERT INTO hives (id, user_id, apiary_id, name, queen_year, status, note, created_at) VALUES (?,?,?,?,?,?,?,?)', array_values($item));
        respond($item, 201);
    }
    if ($path === '/api/records' && $method === 'POST') {
        $body = request_body(); $farmId = clean($body['farm_id'] ?? null, 50);
        require_farm($farmId, $uid, write: true);
        $fields = record_fields($body, $farmId, $uid);
        $item = array_combine(['hive_id','apiary_id','type','date','title','amount','unit','note'], $fields);
        $item = ['id' => uuid(), 'user_id' => $uid, 'farm_id' => $farmId] + $item + ['created_at' => iso_now()];
        execute_sql('INSERT INTO records (id, user_id, farm_id, hive_id, apiary_id, type, date, title, amount, unit, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', array_values($item));
        respond($item, 201);
    }
    if (!preg_match('~^/api/(apiaries|hives|records)/([a-f0-9-]{36})$~', $path, $matches)) return;
    $table = $matches[1]; $itemId = $matches[2];
    $item = $table === 'hives'
        ? one('SELECT h.*, a.farm_id FROM hives h JOIN apiaries a ON a.id=h.apiary_id WHERE h.id=?', [$itemId])
        : one("SELECT * FROM $table WHERE id=?", [$itemId]);
    if (!$item) fail('Položka neexistuje.', 404);
    $farmId = $item['farm_id'];
    require_farm($farmId, $uid, write: $method !== 'GET');
    if ($method === 'GET') respond($item);
    if ($method === 'PATCH') {
        $body = request_body();
        if ($table === 'apiaries') {
            $name = clean($body['name'] ?? null, 100); if ($name === '') fail('Zadejte název stanoviště.');
            $lat = coordinate($body['latitude'] ?? null, -90, 90); $lng = coordinate($body['longitude'] ?? null, -180, 180);
            if (($lat === null) !== ($lng === null)) fail('Vyplňte obě souřadnice nebo žádnou.');
            execute_sql('UPDATE apiaries SET name=?, location=?, note=?, latitude=?, longitude=? WHERE id=? AND farm_id=?', [$name, clean($body['location'] ?? null, 160), clean($body['note'] ?? null, 1000), $lat, $lng, $itemId, $farmId]);
        } elseif ($table === 'hives') {
            $name = clean($body['name'] ?? null, 100); $apiaryId = clean($body['apiary_id'] ?? null, 50);
            if ($name === '' || !one('SELECT id FROM apiaries WHERE id=? AND farm_id=?', [$apiaryId, $farmId])) fail('Vyberte stanoviště a zadejte název úlu.');
            $year = ($body['queen_year'] ?? '') === '' ? null : filter_var($body['queen_year'], FILTER_VALIDATE_INT);
            if ($year === false || ($year !== null && ($year < 2000 || $year > 2100))) fail('Neplatný rok matky.');
            execute_sql('UPDATE hives SET apiary_id=?, name=?, queen_year=?, status=?, note=? WHERE id=?', [$apiaryId, $name, $year, clean($body['status'] ?? null, 40) ?: 'Aktivní', clean($body['note'] ?? null, 1000), $itemId]);
        } else {
            [$hiveId,$apiaryId,$type,$date,$title,$amount,$unit,$note] = record_fields($body, $farmId, $uid);
            execute_sql('UPDATE records SET hive_id=?, apiary_id=?, type=?, date=?, title=?, amount=?, unit=?, note=? WHERE id=? AND farm_id=?', [$hiveId,$apiaryId,$type,$date,$title,$amount,$unit,$note,$itemId,$farmId]);
        }
        respond(['ok' => true]);
    }
    if ($method === 'DELETE') {
        if ($table === 'apiaries' && one('SELECT id FROM hives WHERE apiary_id=? LIMIT 1', [$itemId])) fail('Stanoviště obsahuje úly.');
        if ($table === 'apiaries' && one('SELECT id FROM records WHERE apiary_id=? LIMIT 1', [$itemId])) fail('Stanoviště obsahuje záznamy.');
        if ($table === 'hives' && one('SELECT id FROM records WHERE hive_id=? LIMIT 1', [$itemId])) fail('Úl obsahuje záznamy.');
        execute_sql("DELETE FROM $table WHERE id=?", [$itemId]);
        respond(['ok' => true]);
    }
}
