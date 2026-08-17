# AGENTS.md

## Panoramica

TeamAnalysis: app web statica, 100% client-side (HTML/CSS/vanilla JS + IndexedDB + Chart.js via CDN), nessun server, nessun build, nessun test. Interamente in italiano (UI, commenti, commit).

## Verifica

Niente build/lint/test. Aprire `index.html` direttamente nel browser (o `python3 -m http.server`). Verifica manuale.

## Architettura e convenzioni

- Ordine di caricamento script in `index.html` (nella coda `</body>`) è obbligatorio: `db.js` → `csv-parser.js` → `statistics.js` → `goals.js` → `dashboard.js` → `app.js`. I moduli si scambiano API esclusivamente via `window.*`: `window.appDb` (db.js), `window.CSVParser` (csv-parser.js), `window.appState` (stato globale: `isAnonymous`, `activeYear`, `anonymousMap`, `collaboratorSkills`), `window.renderStatistics`, `window.renderGoals`, `window.renderDashboard`, `window.getDisplayName`. Nuovi file JS vanno inseriti PRIMA di `app.js`.
- `app.js` accede a volte direttamente a `appDb._db` (transazioni IndexedDB grezze) anziché agli helper — pattern esistente, da mantenere.
- Tutto il codice deve contenere la firma autore (`window.getAuthorInfo` in app.js: Loris Salerno / taasalo3 / Loris.Salerno@swisscom.com).
- Nessuna emoji: icone solo SVG (specifica). Attenzione: codice attuale contiene ancora qualche emoji (es. `🔍` in js/goals.js) — non replicare, sostituire con SVG.
- Tema chiaro/scuro via attributo `data-theme` su `<html>` (default `dark`); variabili CSS in `css/style.css` (`--bg-base`, `--text-main`, `--primary`, ecc.) — usare sempre le variabili, mai colori hardcoded. Il CSS è diviso in tre file caricati da `index.html`: `style.css` (variabili/tema), `layout.css`, `components.css` — seguire la ripartizione esistente. Nel markup generato da JS è normale l'uso di style inline.

## Dati (IndexedDB `TeamAnalysisDB`, v3)

- Store: `settings`, `performance`, `sales`, `anonymous_map`, `dashboard_widgets`, `custom_stats`, `goals`, `import_logs` (log import con `appDb.addImportLog(msg, isError)`, letti con `getImportLogs()`, ripuliti con `cleanOldImportLogs(7)`).
- Record performance/sales: `{ id, year, date, employee, data{...}, category, skill? }` con `date` come `YYYY-MM-DD`. I record sales hanno `data.Product` (distinguono AOIT da "Nuovi Abo").
- Ogni anno è un sistema indipendente; tutto è filtrato per `year`/`activeYear`.
- Aumentando `DB_VERSION` va aggiunta la migrazione in `onupgradeneeded` (esempio: indice `year` su `goals` per `oldVersion < 2`).

## CSV (import)

- `js/csv-parser.js` legge SEMPRE con `readAsText(file, "UTF-16LE")`: i file esportati dai sistemi Swisscom (esempi in `Esempi_csv/`) sono UTF-16LE con BOM. Eccezione: "Report OP Wline only performance (1).csv" è UTF-8 puro e viene letto male dal parser — non "sistemare" il parser assumendo UTF-8.
- Riconoscimento formato da testo header: "Voice Inbound" → performance; "AOIT gew" → sales_aoit; "Open Year Sales Event" → sales_nuovi; altrimenti errore "Formato CSV non riconosciuto". Le strutture dei tre formati sono molto diverse tra loro (header su righe diverse, coppie di colonne settimanali YYYYWW per AOIT, ecc.) — analizzare i file in `Esempi_csv/` prima di toccare il parser.
- Numeri in formato europeo (`1.176`, `100,0%`): il parser rimuove i punti e converte la virgola in punto; valori non numerici → 0.
- Logica di import/sovrascrittura: il selettore mese determina `startDate`; con `startDate` si cancellano i dati da quella data in poi (`deleteFromDate`, per skill selezionata in performance), poi si aggiungono i nuovi. "Importa Tutto" = nessuna cancellazione.
