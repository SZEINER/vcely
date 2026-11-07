# Včelí deník

Responzivní React aplikace pro evidenci včelstev. Obsahuje registraci, přihlášení, oddělená data uživatelů, stanoviště, úly a záznamy o zásazích, krmení, léčení, medu a financích.

## Spuštění

Vyžaduje Node.js 24+. Spusťte `npm install` a `npm run dev`, potom otevřete http://localhost:5173. Lokálně se používá SQLite v `data/vcely.sqlite`.

## Android

Projekt obsahuje konfiguraci Capacitoru. Pro sestavení otevřete projekt v Android Studiu po `npm run android:add` a `npm run android:sync`. Před produkčním sestavením nahraďte vývojovou adresu v `capacitor.config.json` HTTPS adresou nasazeného serveru/API, případně nastavte `server.url` na produkční web. Současná konfigurace míří na lokální Vite server v emulátoru Androidu; není určena pro vydání APK.

## Provoz

Produkční server používá MySQL. Zkopírujte `.env.example` do `.env` pouze na serveru a vyplňte `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, případně `DB_PORT` a `DB_SSL`. Soubor `.env` je ignorován Gitem a nesmí se nahrát do repozitáře. Hosting musí umět provozovat Node.js aplikaci a směrovat HTTPS provoz na její port.

Po nahrání kódu na server spusťte:

```sh
npm ci
npm run build
NODE_ENV=production npm start
```

Pak otevřete `https://vaše-doména/run-migrace`. Stránka bez přihlášení vytvoří chybějící tabulky a zobrazí výsledek. Provedené migrace eviduje v `schema_migrations`; opakované otevření je bezpečné. Stejnou operaci lze spustit na serveru příkazem `npm run migrate`. Veřejná stránka je určená jen pro ruční správu schématu; po prvním nasazení ji lze na serveru vypnout nebo omezit podle možností hostingu.

GitHub Actions zatím jen ověřuje sestavení a ke skutečné databázi se nepřipojuje. Samotný push na GitHub tedy migraci nespustí. Server musí nejprve stáhnout nový kód, nainstalovat závislosti, sestavit web a běžet jako Node.js aplikace. Příkaz `npm run start:production` sestaví web a spustí server; migraci pak provedete ručně otevřením stránky.

Aplikace je první funkční verze. Před veřejným provozem je vhodné doplnit obnovu hesla, ověření e-mailu a ochranu proti hromadným pokusům o přihlášení.
