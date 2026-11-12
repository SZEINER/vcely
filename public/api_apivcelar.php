<?php
declare(strict_types=1);
require_once __DIR__ . '/api_core.php';

function apivcelar_setting(string $key): string
{
    $env = getenv($key);
    if ($env !== false) return (string) $env;
    $path = is_file(__DIR__ . '/config.local.php') ? __DIR__ . '/config.local.php' : dirname(__DIR__) . '/config.local.php';
    $local = is_file($path) ? require $path : [];
    return (string) ($local[$key] ?? '');
}

function apivcelar_ready(): bool
{
    return apivcelar_setting('APIVCELAR_CLIENT_ID') !== '' && apivcelar_setting('APIVCELAR_CLIENT_SECRET') !== '' && apivcelar_setting('APIVCELAR_OWNER_EMAIL') !== '';
}

function apivcelar_json(string $url, ?array $post = null, ?string $authorization = null): array
{
    $curl = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_SSL_OPTIONS => defined('CURLSSLOPT_NATIVE_CA') ? CURLSSLOPT_NATIVE_CA : 0,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ];
    if ($post !== null) { $options[CURLOPT_POST] = true; $options[CURLOPT_POSTFIELDS] = http_build_query($post); }
    if ($authorization !== null) $options[CURLOPT_HTTPHEADER][] = 'Authorization: ' . $authorization;
    curl_setopt_array($curl, $options);
    $body = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE); curl_close($curl);
    if (!is_string($body) || $status < 200 || $status >= 300 || strlen($body) > 3000000) throw new RuntimeException('ApiVčelař není nyní dostupné.');
    $json = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($json)) throw new RuntimeException('ApiVčelař vrátil neočekávaná data.');
    return $json;
}

function apivcelar_telemetry(): array
{
    $base = 'https://www.senselink.cz:8391';
    $basic = base64_encode(apivcelar_setting('APIVCELAR_CLIENT_ID') . ':' . apivcelar_setting('APIVCELAR_CLIENT_SECRET'));
    $token = apivcelar_json($base . '/integrations/o/token/', ['grant_type' => 'client_credentials', 'scope' => 'device:telemetry:read'], 'Basic ' . $basic);
    if (empty($token['access_token'])) throw new RuntimeException('ApiVčelař nevrátil přístupový token.');
    $rows = apivcelar_json($base . '/integrations/api/v1/device/telemetry/', null, 'Bearer ' . $token['access_token']);
    $result = [];
    foreach ($rows as $row) {
        if (!is_array($row) || count($row) < 5 || !is_numeric($row[0]) || !is_numeric($row[2])) continue;
        $result[] = ['timestamp' => (int) $row[0], 'code' => (string) $row[1], 'value' => (float) $row[2], 'unit' => (string) $row[3], 'name' => (string) $row[4]];
    }
    return $result;
}

function handle_apivcelar(string $path, string $method, array $user): void
{
    if (!preg_match('~^/api/hives/([a-f0-9-]{36})/(telemetry|apivcelar-link)$~i', $path, $match)) return;
    $hive = one('SELECT h.id,a.farm_id FROM hives h JOIN apiaries a ON a.id=h.apiary_id WHERE h.id=?', [$match[1]]);
    if (!$hive) fail('Úl neexistuje.', 404);
    $role = require_farm($hive['farm_id'], $user['id']);
    $linked = (bool) one('SELECT hive_id FROM apivcelar_links WHERE hive_id=?', [$hive['id']]);
    $canLink = apivcelar_ready() && $role === 'owner' && mb_strtolower($user['email']) === mb_strtolower(apivcelar_setting('APIVCELAR_OWNER_EMAIL'));
    if ($match[2] === 'telemetry' && $method === 'GET') {
        if (!$linked) respond(['linked' => false, 'can_link' => $canLink, 'measurements' => []]);
        try { respond(['linked' => true, 'can_link' => $canLink, 'measurements' => apivcelar_telemetry()]); }
        catch (Throwable $error) { error_log('ApiVcelar: ' . $error->getMessage()); respond(['linked' => true, 'can_link' => $canLink, 'measurements' => [], 'error' => 'Data váhy se nyní nepodařilo načíst.']); }
    }
    if ($match[2] !== 'apivcelar-link' || !in_array($method, ['POST', 'DELETE'], true)) return;
    if (!$canLink) fail('Nemáte oprávnění propojit tento úl.', 403);
    if ($method === 'POST') {
        db()->beginTransaction();
        try {
            execute_sql('DELETE FROM apivcelar_links');
            execute_sql('INSERT INTO apivcelar_links (hive_id,linked_by,linked_at) VALUES (?,?,?)', [$hive['id'], $user['id'], iso_now()]);
            db()->commit();
        } catch (Throwable $error) { db()->rollBack(); throw $error; }
    } else execute_sql('DELETE FROM apivcelar_links WHERE hive_id=?', [$hive['id']]);
    respond(['ok' => true]);
}
