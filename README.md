# Včelí deník

Responzivní React aplikace pro evidenci včelstev. Obsahuje registraci, přihlášení, oddělená data uživatelů, stanoviště, úly a záznamy o zásazích, krmení, léčení, medu a financích.

## Spuštění

Vyžaduje Node.js 24+. Spusťte `npm install` a `npm run dev`, potom otevřete http://localhost:5173. Serverová data jsou v `data/vcely.sqlite`.

## Android

Projekt obsahuje konfiguraci Capacitoru. Pro sestavení otevřete projekt v Android Studiu po `npm run android:add` a `npm run android:sync`. Před produkčním sestavením nahraďte vývojovou adresu v `capacitor.config.json` HTTPS adresou nasazeného serveru/API, případně nastavte `server.url` na produkční web. Současná konfigurace míří na lokální Vite server v emulátoru Androidu; není určena pro vydání APK.

## Provoz

Pro veřejné nasazení nastavte `APP_ORIGIN` na URL webu, `NODE_ENV=production` a provozujte server za HTTPS reverzní proxy. SQLite soubor pravidelně zálohujte. Aplikace je první funkční verze; před veřejným provozem doplňte obnovu hesla, ověření e-mailu a ochranu proti hromadným pokusům o přihlášení.
