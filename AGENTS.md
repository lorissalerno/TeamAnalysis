# AGENTS.md

## Panoramica

TeamAnalysis: app web statica, 100% client-side (HTML/CSS/vanilla JS + IndexedDB + Chart.js via CDN), nessun server, nessun build, nessun test. Interamente in italiano (UI, commenti, commit).

## Verifica

Niente build/lint/test. Aprire `index.html` direttamente nel browser (o `python3 -m http.server`). Verifica manuale.

## Architettura e convenzioni

- Ordine di caricamento script in `index.html` (nella coda `</body>`) è obbligatorio: `db.js` → `csv-parser.js` → `statistics.js` → `goals.js` → `dashboard.js` → `version.js` → `app.js`. I moduli si scambiano API esclusivamente via `window.*`: `window.appDb` (db.js), `window.CSVParser` (csv-parser.js), `window.appState` (stato globale: `isAnonymous`, `activeYear`, `anonymousMap`, `collaboratorSkills`), `window.renderStatistics`, `window.renderGoals`, `window.renderDashboard`, `window.getDisplayName`, `window.VersionManager` (version.js). Nuovi file JS vanno inseriti PRIMA di `app.js`.
- `app.js` accede a volte direttamente a `appDb._db` (transazioni IndexedDB grezze) anziché agli helper — pattern esistente, da mantenere.
- Tutto il codice deve contenere la firma autore. Ogni file JS/CSS/HTML inizia con un header di copyright standard: `© Copyright 2026 Loris Salerno (TAASALO3) - loris.salerno@swisscom.com - Tutti i diritti riservati.` (`window.getAuthorInfo` in app.js restituisce author "Loris Salerno", sigla "TAASALO3", email "Loris.Salerno@swisscom.com"; div `#copyright-signature` in index.html). Non aggiungere firme in altri formati né duplicati.
- Nessuna emoji: icone solo SVG (specifica). Attenzione: codice attuale contiene ancora qualche emoji (es. `🔍` in js/goals.js) — non replicare, sostituire con SVG.
- Tema chiaro/scuro via attributo `data-theme` su `<html>` (default `dark`); variabili CSS in `css/style.css` (`--bg-base`, `--text-main`, `--primary`, ecc.) — usare sempre le variabili, mai colori hardcoded. Il CSS è diviso in tre file caricati da `index.html`: `style.css` (variabili/tema), `layout.css`, `components.css` — seguire la ripartizione esistente. Nel markup generato da JS è normale l'uso di style inline.

## Dati (IndexedDB `TeamAnalysisDB`, v3)

- Store: `settings`, `performance`, `sales`, `anonymous_map`, `dashboard_widgets`, `custom_stats`, `goals`, `import_logs` (log import/modifiche con `appDb.addImportLog(msg, isError, type)`, letti con `getImportLogs()`, ripuliti con `cleanOldImportLogs(30)` — ritenzione massima 30 giorni).
- Record performance/sales: `{ id, year, date, employee, data{...}, category, skill? }` con `date` come `YYYY-MM-DD`. I record sales hanno `data.Product` (distinguono AOIT da "Nuovi Abo").
- Ogni anno è un sistema indipendente; tutto è filtrato per `year`/`activeYear`.
- Aumentando `DB_VERSION` va aggiunta la migrazione in `onupgradeneeded` (esempio: indice `year` su `goals` per `oldVersion < 2`).

## CSV (import)

- `js/csv-parser.js` legge SEMPRE con `readAsText(file, "UTF-16LE")`: i file esportati dai sistemi Swisscom (esempi in `Esempi_csv/`) sono UTF-16LE con BOM. Eccezione: "Report OP Wline only performance (1).csv" è UTF-8 puro e viene letto male dal parser — non "sistemare" il parser assumendo UTF-8.
- Riconoscimento formato da testo header: "Voice Inbound" → performance; "AOIT gew" → sales_aoit; "Open Year Sales Event" → sales_nuovi; altrimenti errore "Formato CSV non riconosciuto". Le strutture dei tre formati sono molto diverse tra loro (header su righe diverse, coppie di colonne settimanali YYYYWW per AOIT, ecc.) — analizzare i file in `Esempi_csv/` prima di toccare il parser.
- Numeri in formato europeo (`1.176`, `100,0%`): il parser rimuove i punti e converte la virgola in punto; valori non numerici → 0.
- Logica di import/sovrascrittura: il selettore mese determina `startDate`; con `startDate` si cancellano i dati da quella data in poi (`deleteFromDate`, per skill selezionata in performance), poi si aggiungono i nuovi. "Importa Tutto" = nessuna cancellazione.

## Versionamento, Changelog e README (obbligatorio per l'agente AI)

- **Ogni modifica importante** (nuova feature, fix rilevante, cambio UI/Dati) DEVE aggiornare il versionamento: eseguire `node scripts/bump-version.js "Descrizione modifica"` — incrementa `version.json` (es. `v1.16 → v1.17` giornaliero), prepende/aggrega l'entry in `changelog.json` raggruppata per giorno/versione, e rigenera automaticamente `README.md` tramite `scripts/generate-readme.js`.
- **README.md è auto-generato** dallo stesso sistema del riquadro **Novità e Modifiche** in Impostazioni: sezioni `Stato Aggiornamenti` (link/repo `IronDirt/TeamAnalysis`, sorgente `raw.githubusercontent.com/.../version.json` + fallback API commits), `Novità e Modifiche` (changelog da `changelog.json`), `Descrizione del sito` (in fondo, dopo il changelog) e `Avvio rapido`. Non modificare il README a mano: usa `node scripts/generate-readme.js` (o il bump) per mantenerlo sincronizzato. Per modifiche minori senza bump, rigenerare comunque il README.
- **Changelog: stile obbligatorio** — tenere testi brevi e semplici, senza dettagli inutili (es. cambio colore, allargato riquadro, tooltip). Tenere solo le cose importanti. Ogni entry in `changelog.json` usa `{"novita": [...], "bugfix": [...]}` (retrocompatibile con `changes` legacy): il riquadro e il README mostrano sezioni separate **Novità** (verde) e **BugFix** (arancione). Quando si lancia `bump-version.js`, la descrizione va in `novita`; spostare manualmente in `bugfix` se è una correzione.
- **GitHub:** repo pubblico preconfigurato `IronDirt/TeamAnalysis` in `js/version.js` (`DEFAULT_REPO`) — il controllo aggiornamenti funziona senza input utente. Mantenere `version.json`/`changelog.json` committati e pushati su `main` affinché `raw.githubusercontent.com` rifletta la versione corrente.
- **Ordine bump/push:** modifica codice → `node scripts/bump-version.js "..."` → verifica `version.json`/`changelog.json`/`README.md` → commit + push su `main` (auto-push attivo).
