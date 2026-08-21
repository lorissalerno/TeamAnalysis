# TeamAnalysis

> Analizza le statistiche del tuo team — app web statica 100% client-side per l'analisi delle performance, delle vendite e degli stati.

[![Versione](https://img.shields.io/badge/versione-v1.19-0ea5e9)](https://github.com/IronDirt/TeamAnalysis)
[![Repository](https://img.shields.io/badge/GitHub-IronDirt%2FTeamAnalysis-181717?logo=github)](https://github.com/IronDirt/TeamAnalysis)
[![Data](https://img.shields.io/badge/data-21%2F08%2F2026-10b981)](https://github.com/IronDirt/TeamAnalysis/commits/main)

**Repository pubblico:** [https://github.com/IronDirt/TeamAnalysis](https://github.com/IronDirt/TeamAnalysis)  ·  **Versione attuale:** `v1.19` del 21/08/2026

---

## Stato Aggiornamenti

Il riquadro **Stato Aggiornamenti** in *Impostazioni* è collegato a GitHub e confronta automaticamente `version.json` locale con quello remoto su `raw.githubusercontent.com`.

- **Repository preconfigurato:** `IronDirt/TeamAnalysis` (modificabile in Impostazioni → Repository GitHub)
- **Sorgente di verifica primaria:** `https://raw.githubusercontent.com/IronDirt/TeamAnalysis/main/version.json`
- **Fallback:** API GitHub `/repos/IronDirt/TeamAnalysis/commits` (ultimi commit) se `version.json` remoto non è raggiungibile
- **Azioni disponibili:** _Verifica aggiornamenti_, _Salva repository_, _Ricarica_, link _Apri su GitHub_

> Nessuna configurazione manuale richiesta: il controllo funziona subito all'apertura dell'app. In caso di aggiornamento disponibile viene mostrato un avviso con la nuova versione e la data.

---

## Novità e Modifiche

Cronologia raggruppata per giorno e versione — stesso sistema del riquadro **Novità e Modifiche** in Impostazioni. I dati provengono da `changelog.json` e `version.json` (aggiornati automaticamente ad ogni commit tramite `scripts/bump-version.js`).

### v1.19 — 21/08/2026 `Attuale`

**Novità**
- Changelog: testi semplificati e divisi in Novità e BugFix
- Impostazioni: controllo aggiornamenti automatico da GitHub
- Impostazioni: cronologia novità raggruppata per versione e giorno
- README che si aggiorna da solo ad ogni versione

### v1.15 — 20/08/2026

**Novità**
- Nuova categoria Stati per import, obiettivi e statistiche
- Storico modifiche con data e conservazione 30 giorni
- Obiettivi Stati: calcolo efficienza con target e tolleranza
- Obiettivi: metrica di influenza attivabile quando serve

**BugFix**
- Tab Obiettivi rimane selezionato dopo il reload
- Titoli obiettivi più puliti senza prefissi inutili

### v1.14 — 18/08/2026

**Novità**
- Gestione Skill completa: crea, rinomina ed elimina con controllo dati
- Finestre di conferma più chiare al posto dei popup del browser

**BugFix**
- Avviso se elimini uno Skill usato da un solo collaboratore

### v1.13 — 17/08/2026

**Novità**
- Dashboard: obiettivi Sales di team per ogni Skill


> Ogni giorno con modifiche incrementa la versione (es. v1.15 → v1.16). Il README viene rigenerato automaticamente ad ogni bump.

---

## Descrizione del sito

**TeamAnalysis** è un'applicazione web statica, completamente client-side, senza server né build, sviluppata per l'analisi dei dati di team.

**Caratteristiche principali:**

- **100% client-side:** HTML, CSS, vanilla JavaScript, IndexedDB e Chart.js via CDN. Nessun backend — basta aprire `index.html` o servire la cartella con un server statico (es. `python3 -m http.server`).
- **Dati locali:** storage su IndexedDB (`TeamAnalysisDB` v3) con store `performance`, `sales`, `stati`, `settings`, `anonymous_map`, `custom_stats`, `goals`, `import_logs`. Ogni anno è un sistema indipendente filtrato per `activeYear`.
- **Importazione CSV:** parser dedicato in `js/csv-parser.js` che legge in `UTF-16LE` (formato Swisscom) e riconosce tre formati (Performance "Voice Inbound", Sales AOIT "AOIT gew", Sales Nuovi "Open Year Sales Event"). Numeri in formato europeo, gestione sovrascrittura per mese/skill, log di import con ritenzione 30 giorni.
- **Dashboard:** riepilogo collaboratori per skill, obiettivi di team Sales ed Efficienza, sforamenti tolleranza.
- **Statistiche:** grafici Chart.js con vista Team / Individuale, medie di team, obiettivi, template personalizzabili per collaboratore.
- **Obiettivi:** gestione obiettivi Efficienza, Vendita e Stati (calcolo con target + tolleranza), tabella stile Excel per Sales.
- **Database:** tabella interattiva con filtri per fonte (skill), ricerca full-text, ordinamento, paginazione (100 righe), eliminazione filtrata e storicizzazione.
- **Impostazioni & Backup:** gestione collaboratori e skill, anonimizzazione CSV, backup/restore locale, riquadri Stato Aggiornamenti e Novità e Modifiche, gestione tema chiaro/scuro (`data-theme`).
- **Privacy:** modalità anonima con mappatura `Collab. <ID>`, nessun dato inviato a server esterni (l'unico polling esterno è il controllo versione su GitHub).
- **Versionamento:** `version.json` + `changelog.json` con bump automatico giornaliero e generazione README.

**Tecnologie:** Vanilla JS (ordine script obbligatorio in `index.html`: `db.js` → `csv-parser.js` → `statistics.js` → `goals.js` → `dashboard.js` → `version.js` → `app.js`), IndexedDB, Chart.js, CSS variables per tema.

**Autore:** © Copyright 2026 Loris Salerno (TAASALO3) — loris.salerno@swisscom.com — Tutti i diritti riservati.

---

## Avvio rapido

```bash
# Clona
git clone https://github.com/IronDirt/TeamAnalysis.git
cd TeamAnalysis

# Apri direttamente o via server statico
open index.html
# oppure
python3 -m http.server 8000
```

Nessun `npm install` o build richiesto.
