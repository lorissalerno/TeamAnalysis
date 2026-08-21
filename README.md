# TeamAnalysis

> Analizza le statistiche del tuo team — app web statica 100% client-side per l'analisi delle performance, delle vendite e degli stati.

[![Versione](https://img.shields.io/badge/versione-v1.16-0ea5e9)](https://github.com/IronDirt/TeamAnalysis)
[![Repository](https://img.shields.io/badge/GitHub-IronDirt%2FTeamAnalysis-181717?logo=github)](https://github.com/IronDirt/TeamAnalysis)
[![Data](https://img.shields.io/badge/data-21%2F08%2F2026-10b981)](https://github.com/IronDirt/TeamAnalysis/commits/main)

**Repository pubblico:** [https://github.com/IronDirt/TeamAnalysis](https://github.com/IronDirt/TeamAnalysis)  ·  **Versione attuale:** `v1.16` del 21/08/2026

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

### v1.16 — 21/08/2026 `Attuale`

- Impostazioni: nuovo riquadro Stato Aggiornamenti collegato a GitHub (verifica disponibilità aggiornamenti, badge versione, link repository)
- Impostazioni: nuovo riquadro Novità e Modifiche con changelog raggruppato per giorno e versione
- Versionamento automatico v1.15 → v1.16 con version.json e changelog.json

### v1.15 — 20/08/2026

- Menu prodotti vendite: rimosse metriche hardcoded non presenti nel database
- Persistito tab obiettivi attivo al reload e rese distinte le frecce di spostamento colonna
- Pulsanti selezione colonna: Indiv. Team CHF QTA tutti visibili e selezionabili
- Spostate frecce di spostamento colonne in cima alla colonna
- Allargate colonne della tabella vendite in modalità modifica
- Allargato menu a tendina prodotti e aggiunto spostamento colonne tabella vendite
- Statistiche: riga Obiettivo in magenta per distinguerla dai collaboratori
- Nascondi prefisso Performance: dai titoli degli obiettivi efficienza
- Obiettivi: Metrica di influenza attivabile/disattivabile con toggle, disattivata di default
- Obiettivi Stati: metodo di calcolo Efficienza (target + tolleranza in su/in giù)
- Allargata finestra Storico Log (max-width 900px, altezza lista 520px)
- Log storici: data nel dettaglio, registrazione modifiche dati, ritenzione 30 giorni
- Aggiunta categoria Stati: import, obiettivi e statistiche
- Aggiunte statistiche simulate per 7 nuovi collaboratori in Report_stati.csv

### v1.14 — 18/08/2026

- Rinominati menu principali con suffisso TAASALO3 (sidebar, nav, dropdown collaboratore)
- Aggiunto header copyright con firma TAASALO3 a tutti i file JS/CSS/HTML
- Corretta altezza card Gestione Skill nel grid
- Rimossa icona targhetta dall'intestazione del pannello Gestione Skill
- Popup eliminazione skill più sintetico con elenco collaboratori a rischio
- Eliminazione skill: avviso per collaboratori con dati solo su quello skill
- Helper appDb.deleteSkill per rimozione completa di uno skill
- Dialog personalizzati (alert/confirm/prompt) al posto dei popup nativi
- Gestione Skill nel Passaggio 2 e pannello Gestione Skill a fianco di Importazione Dati CSV

### v1.13 — 17/08/2026

- Dashboard: sezione Sales con raggiungimento obiettivi di team per skill
- Fix mini-card obiettivi Sales: altezza uniforme e larghezza limitata
- Menu laterale: tooltip visibile in stato collassato
- Aggiunto footer copyright con link Feedback in fondo a ogni pagina
- Backup popup a due colonne (Esporta/Importa) e card impostazioni a dimensioni uniformi


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
