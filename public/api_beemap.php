<?php
declare(strict_types=1);
require_once __DIR__ . '/api_core.php';

const BEEMAP_SOURCE_URL = 'https://svs.gov.cz/wp-content/plugins/svs-maps/bin/vcely_read_data.php';
const BEEMAP_PAGE_URL = 'https://svs.gov.cz/mapove-vystupy-ohnisek-nebezpecnych-nakaz-a-ochrannych-pasem/';

function beemap_today(string $format): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Europe/Prague')))->format($format);
}

function beemap_date(?string $value): ?string
{
    if (!$value) return null;
    $date = DateTimeImmutable::createFromFormat('!d.m.Y', $value);
    return $date && $date->format('d.m.Y') === $value ? $date->format('Y-m-d') : null;
}

function beemap_geometry(array $geometry, string $kind): ?string
{
    $type = $geometry['type'] ?? null;
    $coords = $geometry['coordinates'] ?? null;
    if ($kind === 'O' && $type === 'Point' && is_array($coords) && count($coords) === 2 && is_numeric($coords[0]) && is_numeric($coords[1])) {
        $lng = (float) $coords[0]; $lat = (float) $coords[1];
        if ($lng < 12 || $lng > 19 || $lat < 48 || $lat > 52) return null;
    } elseif ($kind === 'P' && in_array($type, ['Polygon', 'MultiPolygon'], true) && is_array($coords) && $coords !== []) {
        $first = $coords;
        while (is_array($first) && isset($first[0]) && is_array($first[0])) $first = $first[0];
        if (!is_array($first) || count($first) < 2 || !is_numeric($first[0]) || !is_numeric($first[1])) return null;
        if ((float) $first[0] < 12 || (float) $first[0] > 19 || (float) $first[1] < 48 || (float) $first[1] > 52) return null;
    } else return null;
    return json_encode(['type' => $type, 'coordinates' => $coords], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function beemap_fetch(string $disease): array
{
    $curl = curl_init(BEEMAP_SOURCE_URL);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['type' => 'nakaza', 'mapa' => $disease, 'datum' => beemap_today('d.m.Y')]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        CURLOPT_USERAGENT => 'SZEINER BeeMap/1.0 (source: svs.gov.cz)',
        CURLOPT_SSL_OPTIONS => defined('CURLSSLOPT_NATIVE_CA') ? CURLSSLOPT_NATIVE_CA : 0,
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if (!is_string($body) || $status !== 200 || strlen($body) > 20000000) throw new RuntimeException('Zdroj SVS neodpověděl platnými daty: ' . ($error ?: $status));
    $items = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($items) || !array_is_list($items)) throw new RuntimeException('Neočekávaný formát dat SVS.');
    return $items;
}

function beemap_sync(): array
{
    $started = iso_now();
    execute_sql('UPDATE beemap_sources SET last_attempt_at=? WHERE id=?', [$started, 'svs-cz']);
    try {
        $incoming = [];
        foreach (['MVP', 'HVP'] as $disease) {
            $items = beemap_fetch($disease);
            if (!$items) throw new RuntimeException("Zdroj SVS vrátil prázdný seznam pro $disease; původní data zůstávají zachována.");
            foreach ($items as $item) {
                if (!is_array($item) || !in_array($item['typ'] ?? '', ['O', 'P'], true) || !isset($item['id'], $item['geom'])) continue;
                $geometry = beemap_geometry($item['geom'], $item['typ']);
                if ($geometry === null) continue;
                $id = $disease . ':' . (string) $item['id'];
                if (isset($incoming[$id])) throw new RuntimeException('Zdroj SVS obsahuje duplicitní ID.');
                $until = beemap_date($item['datum_do'] ?? null);
                $incoming[$id] = [
                    $id, 'svs-cz', $disease, mb_substr((string) ($item['cj'] ?? ''), 0, 120),
                    mb_substr((string) ($item['misto'] ?? ''), 0, 1000),
                    $until && $until < beemap_today('Y-m-d') ? 'ended' : 'active',
                    beemap_date($item['datum_od'] ?? null), $until, null, $started, $geometry,
                    $item['typ'] === 'O' ? 'beemap_outbreaks' : 'beemap_zones',
                ];
            }
        }
        if (!$incoming) throw new RuntimeException('Zdroj SVS neobsahuje platné geografické záznamy.');
        db()->beginTransaction();
        try {
            execute_sql('DELETE FROM beemap_outbreaks WHERE source_id=?', ['svs-cz']);
            execute_sql('DELETE FROM beemap_zones WHERE source_id=?', ['svs-cz']);
            foreach ($incoming as $row) {
                $table = array_pop($row);
                execute_sql("INSERT INTO $table (id,source_id,disease,reference_no,location,status,valid_from,valid_to,source_updated_at,imported_at,geometry_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)", $row);
            }
            execute_sql('UPDATE beemap_sources SET last_success_at=?, last_error=NULL WHERE id=?', [iso_now(), 'svs-cz']);
            execute_sql('INSERT INTO beemap_sync_logs (source_id,started_at,finished_at,status,item_count,message) VALUES (?,?,?,?,?,?)', ['svs-cz', $started, iso_now(), 'ok', count($incoming), null]);
            db()->commit();
        } catch (Throwable $error) { db()->rollBack(); throw $error; }
        return ['ok' => true, 'count' => count($incoming)];
    } catch (Throwable $error) {
        $message = mb_substr($error->getMessage(), 0, 1000);
        execute_sql('UPDATE beemap_sources SET last_error=? WHERE id=?', [$message, 'svs-cz']);
        execute_sql('INSERT INTO beemap_sync_logs (source_id,started_at,finished_at,status,item_count,message) VALUES (?,?,?,?,?,?)', ['svs-cz', $started, iso_now(), 'error', 0, $message]);
        return ['ok' => false, 'error' => $message];
    }
}

function beemap_maybe_sync(): void
{
    $source = one('SELECT last_attempt_at FROM beemap_sources WHERE id=?', ['svs-cz']);
    if ($source && $source['last_attempt_at'] && strtotime($source['last_attempt_at']) > time() - 3600) return;
    $lock = fopen(sys_get_temp_dir() . '/szeiner-beemap-sync.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) return;
    try {
        $source = one('SELECT last_attempt_at FROM beemap_sources WHERE id=?', ['svs-cz']);
        if (!$source || !$source['last_attempt_at'] || strtotime($source['last_attempt_at']) <= time() - 3600) beemap_sync();
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

function beemap_filter(): array
{
    $disease = strtoupper(clean($_GET['disease'] ?? '', 10));
    if ($disease !== '' && !in_array($disease, ['MVP', 'HVP'], true)) fail('Neplatný druh nákazy.');
    $active = clean($_GET['active'] ?? '1', 5);
    if (!in_array($active, ['0', '1', 'all'], true)) fail('Neplatný filtr stavu.');
    $area = clean($_GET['area'] ?? '', 100);
    $where = []; $params = [];
    if ($disease) { $where[] = 'disease=?'; $params[] = $disease; }
    if ($active !== 'all') { $where[] = 'status=?'; $params[] = $active === '1' ? 'active' : 'ended'; }
    if ($area !== '') { $where[] = '(location LIKE ? OR reference_no LIKE ?)'; $params[] = "%$area%"; $params[] = "%$area%"; }
    return [$where ? ' WHERE ' . implode(' AND ', $where) : '', $params];
}

function beemap_rows(string $table, string $where, array $params): array
{
    $rows = many("SELECT * FROM $table$where ORDER BY valid_from DESC", $params);
    foreach ($rows as &$row) { $row['geometry'] = json_decode($row['geometry_json'], true); unset($row['geometry_json']); }
    return $rows;
}

function handle_beemap(string $path, string $method): void
{
    if ($method !== 'GET' || !str_starts_with($path, '/api/beemap/')) return;
    if (!in_array($path, ['/api/beemap/health', '/api/beemap/outbreaks', '/api/beemap/zones', '/api/beemap/geojson', '/api/beemap/sources'], true)) return;
    beemap_maybe_sync();
    $source = one('SELECT * FROM beemap_sources WHERE id=?', ['svs-cz']);
    if ($path === '/api/beemap/health') {
        $counts = ['outbreaks' => (int) one('SELECT COUNT(*) AS n FROM beemap_outbreaks')['n'], 'zones' => (int) one('SELECT COUNT(*) AS n FROM beemap_zones')['n']];
        respond(['status' => $source['last_error'] ? 'stale' : ($source['last_success_at'] ? 'ok' : 'unavailable'), 'last_success_at' => $source['last_success_at'], 'last_attempt_at' => $source['last_attempt_at'], 'error' => $source['last_error'], 'counts' => $counts]);
    }
    if ($path === '/api/beemap/sources') respond(['sources' => [$source], 'recent_syncs' => many('SELECT * FROM beemap_sync_logs ORDER BY id DESC LIMIT 10')]);
    [$where, $params] = beemap_filter();
    $outbreaks = $path === '/api/beemap/zones' ? [] : beemap_rows('beemap_outbreaks', $where, $params);
    $zones = $path === '/api/beemap/outbreaks' ? [] : beemap_rows('beemap_zones', $where, $params);
    if ($path === '/api/beemap/outbreaks') respond(['outbreaks' => $outbreaks, 'last_success_at' => $source['last_success_at']]);
    if ($path === '/api/beemap/zones') respond(['zones' => $zones, 'last_success_at' => $source['last_success_at']]);
    $features = [];
    foreach ([['outbreak', $outbreaks], ['zone', $zones]] as [$kind, $rows]) {
        foreach ($rows as $row) {
            $geometry = $row['geometry']; unset($row['geometry']);
            $features[] = ['type' => 'Feature', 'id' => $row['id'], 'geometry' => $geometry, 'properties' => ['kind' => $kind] + $row + ['source_url' => BEEMAP_PAGE_URL]];
        }
    }
    respond(['type' => 'FeatureCollection', 'features' => $features, 'last_success_at' => $source['last_success_at'], 'stale' => (bool) $source['last_error']]);
}
