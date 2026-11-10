<?php
declare(strict_types=1);

function mail_setting(string $key): string
{
    $env = getenv($key);
    if ($env !== false) return (string) $env;
    $path = __DIR__ . '/config.local.php';
    $local = is_file($path) ? require $path : [];
    return (string) ($local[$key] ?? '');
}

function smtp_expect($socket, array $codes): string
{
    $lines = '';
    do {
        $line = fgets($socket, 2048);
        if ($line === false) throw new RuntimeException('SMTP server neodpověděl.');
        $lines .= $line;
    } while (strlen($line) > 3 && $line[3] === '-');
    if (!in_array((int) substr($line, 0, 3), $codes, true)) throw new RuntimeException('SMTP odmítl požadavek.');
    return $lines;
}

function smtp_command($socket, string $command, array $codes): void
{
    if (fwrite($socket, $command . "\r\n") === false) throw new RuntimeException('Nelze zapisovat na SMTP server.');
    smtp_expect($socket, $codes);
}

function send_invitation_email(string $recipient, string $farmName, string $role, string $token): bool
{
    $user = mail_setting('SMTP_USER');
    $password = mail_setting('SMTP_PASSWORD');
    $baseUrl = rtrim(mail_setting('APP_URL'), '/');
    if ($user === '' || $password === '' || !filter_var($baseUrl, FILTER_VALIDATE_URL)) return false;
    $host = mail_setting('SMTP_HOST') ?: 'smtp.seznam.cz';
    $port = (int) (mail_setting('SMTP_PORT') ?: 465);
    if (!filter_var($user, FILTER_VALIDATE_EMAIL) || !filter_var($recipient, FILTER_VALIDATE_EMAIL) || !preg_match('/^[a-zA-Z0-9.-]+$/', $host) || $port < 1 || $port > 65535) return false;
    $socket = stream_socket_client("ssl://$host:$port", $errno, $error, 10, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]));
    if (!$socket) throw new RuntimeException('SMTP připojení selhalo.');
    stream_set_timeout($socket, 10);
    try {
        smtp_expect($socket, [220]);
        smtp_command($socket, 'EHLO vcely.szeiner.com', [250]);
        smtp_command($socket, 'AUTH LOGIN', [334]);
        smtp_command($socket, base64_encode($user), [334]);
        smtp_command($socket, base64_encode($password), [235]);
        smtp_command($socket, 'MAIL FROM:<' . $user . '>', [250]);
        smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
        smtp_command($socket, 'DATA', [354]);
        $subject = 'Pozvanka do Vceliho deniku';
        $url = $baseUrl . '/?pozvanka=' . $token;
        $body = "Byli jste pozvani do farmy $farmName ve Vcelim deniku.\r\nRole: $role\r\n\r\nOtevrete odkaz: $url\r\n\r\nPozvanka plati 7 dni.\r\n";
        $body = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r", "\n"], "\n", $body));
        $body = str_replace("\n", "\r\n", $body);
        $headers = "From: Vceli denik <$user>\r\nTo: <$recipient>\r\nSubject: $subject\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit";
        smtp_command($socket, $headers . "\r\n\r\n" . $body . "\r\n.", [250]);
        smtp_command($socket, 'QUIT', [221]);
        return true;
    } finally {
        fclose($socket);
    }
}
