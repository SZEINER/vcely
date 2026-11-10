# Včelí deník

Responzivní React aplikace pro evidenci včelstev. Obsahuje úvodní stránku `/uvod`, mapu stanovišť s přehledem úlů, správu farem, stanovišť, úlů, skladu s fotografiemi a záznamů o zásazích, krmení, léčení, medu a financích. Farmu lze sdílet pozvánkou s rolí vlastník, editor nebo náhled.

## Spuštění

Pro místní vývoj je potřeba PHP 8.1+ s `pdo_sqlite` a Node.js. Spusťte `npm install` a `npm run dev`, potom otevřete http://localhost:5173. Vývojový příkaz spustí PHP API, automaticky provede migrace v `data/php-dev.sqlite` a spustí React. Starší lokální data v `data/vcely.sqlite` ponechává beze změny. Produkční hosting používá PHP a MySQL.

## Android

Projekt obsahuje konfiguraci Capacitoru. Pro sestavení otevřete projekt v Android Studiu po `npm run android:add` a `npm run android:sync`. Před produkčním sestavením nahraďte vývojovou adresu v `capacitor.config.json` HTTPS adresou nasazeného serveru/API, případně nastavte `server.url` na produkční web. Současná konfigurace míří na lokální Vite server v emulátoru Androidu; není určena pro vydání APK.

## Provoz

Hosting vyžaduje PHP 8.1+ s `pdo_mysql`, MySQL a Apache s povoleným `.htaccess` a `mod_rewrite`. Node.js je potřeba pouze při sestavení Reactu, ne na produkčním serveru.

Web sestavte příkazem:

```sh
npm ci
npm run build
```

GitHub Actions při pushi do `main` sestaví web a nahraje **obsah** složky `dist/` přes existující FTP připojení. Na serveru musí být v kořeni webu soubor `config.local.php` s PHP polem klíčů `DB_DRIVER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` a `DB_PASSWORD`. Tento soubor nesmí být v Gitu; sestavení jej z `dist/` odstraňuje a nasazovací workflow jej nenahrává.

Po prvním nasazení a po aktualizaci této verze otevřete `https://vaše-doména/run-migrace`. Stránka bez přihlášení vytvoří chybějící tabulky včetně skladu a převede stávající data každého uživatele do jeho vlastní farmy. Provedené migrace eviduje v `schema_migrations`; opakované otevření je bezpečné.

GitHub Actions také ověřuje syntaxi PHP. Samotný push migraci nespustí; po nasazení ji spustíte ručně otevřením `/run-migrace`.

## E-mailové pozvánky

Pokud na serveru doplníte do souboru `config.local.php` klíče `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST` (`smtp.seznam.cz`), `SMTP_PORT` (`465`) a `APP_URL` (veřejná HTTPS adresa aplikace), budou se pozvánky posílat e-mailem. Bez těchto klíčů aplikace stále vytvoří odkaz ke zkopírování. Heslo k e-mailu patří pouze do tohoto souboru na serveru nebo do proměnných prostředí, nikdy do Gitu.

Aplikace je první funkční verze. Před veřejným provozem je vhodné doplnit obnovu hesla, ověření e-mailu a ochranu proti hromadným pokusům o přihlášení.
