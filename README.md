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

## BeeMap a ApiVčelař

Po aktualizaci spusťte `/run-migrace`. BeeMap pak na stránce **Mapa** zobrazuje ohniska moru a hniloby včelího plodu a skutečné polygony ochranných pásem ze [zdrojové mapy SVS](https://svs.gov.cz/mapove-vystupy-ohnisek-nebezpecnych-nakaz-a-ochrannych-pasem/). Nové API nabízí `GET /api/beemap/health`, `/outbreaks`, `/zones`, `/geojson` a `/sources`. Podporuje parametry `disease=MVP|HVP`, `active=1|0|all` a `area=`. Přístup vyžaduje běžné přihlášení do aplikace. GeoJSON vrací pouze záznamy s ověřenou geometrií.

Import se spustí při prvním zobrazení mapy a nejvýše jednou za hodinu při dalším požadavku. Pro pravidelnou aktualizaci i bez návštěvníků nastavte hodinový cron na `php /cesta/k/webu/sync-beemap-cli.php`; skript je součástí `dist/`. Chyba zdroje neodstraní poslední úspěšná data; stav a datum importu ukazuje API i mapa. Před veřejným opakovaným stahováním a dalším poskytováním dat ověřte podmínky použití u SVS. Použité veřejné rozhraní mapy není zdokumentované jako stabilní API.

BeeMap používá stávající databázi MySQL/SQLite a ukládá geometrii jako GeoJSON, aby nevyžadoval výměnu původní databáze aplikace. Požadavek na PostgreSQL/PostGIS z dodaného plánu tím zatím splněn není.

Pro ApiVčelař nastavte v ignorovaném kořenovém `config.local.php` (na produkčním serveru v kořeni webu) nebo v proměnných prostředí `APIVCELAR_CLIENT_ID`, `APIVCELAR_CLIENT_SECRET` a `APIVCELAR_OWNER_EMAIL`. Údaje jsou v dodaném integračním balíčku; nepatří do Gitu ani do prohlížeče. Vlastník farmy s uvedeným e-mailem pak otevře detail správného úlu a použije **Připojit tento úl**. Přístupový token je vázaný na jediný úl, takže propojte pouze odpovídající úl. V detailu se zobrazují poslední dostupná měření včetně hmotnosti. Integrace je pro čtení; zápis do externího deníku není zapnutý.
