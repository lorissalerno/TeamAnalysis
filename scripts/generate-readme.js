#!/usr/bin/env node
/**
 * TeamAnalysis
 * © Copyright 2026 Loris Salerno (TAASALO3) - loris.salerno@swisscom.com
 * Tutti i diritti riservati.
 *
 * Genera README.md a partire da version.json + changelog.json
 * Stesso sistema del riquadro "Novità e Modifiche" in Impostazioni (raggruppato per giorno/versione)
 * Uso: node scripts/generate-readme.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const versionPath = path.join(root, 'version.json');
const changelogPath = path.join(root, 'changelog.json');
const readmePath = path.join(root, 'README.md');

function formatDateIT(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return dateStr;
}

let versionData = {};
let changelog = [];
try { versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8')); } catch {}
try { changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8')); } catch {}

const version = versionData.version || 'v1.0';
const date = versionData.date || '';
const repo = 'lorissalerno/TeamAnalysis';
const repoUrl = `https://github.com/${repo}`;

let changelogMd = '';
if (!Array.isArray(changelog) || changelog.length === 0) {
    changelogMd = '_Nessuna novità disponibile._\n';
} else {
    changelog.forEach(entry => {
        const isLatest = entry === changelog[0];
        const badge = isLatest ? ' `Attuale`' : '';
        changelogMd += `### ${entry.version} — ${formatDateIT(entry.date)}${badge}\n\n`;
        // Supporta formato nuovo (novita/bugfix) e legacy (changes)
        const novita = Array.isArray(entry.novita) ? entry.novita : (Array.isArray(entry.changes) ? entry.changes : []);
        const bugfix = Array.isArray(entry.bugfix) ? entry.bugfix : [];
        if (novita.length > 0) {
            changelogMd += `**Novità**\n`;
            novita.forEach(c => { changelogMd += `- ${c}\n`; });
            changelogMd += `\n`;
        }
        if (bugfix.length > 0) {
            changelogMd += `**BugFix**\n`;
            bugfix.forEach(c => { changelogMd += `- ${c}\n`; });
            changelogMd += `\n`;
        }
        if (novita.length === 0 && bugfix.length === 0) {
            changelogMd += `_Nessun dettaglio._\n\n`;
        }
    });
}

const readme = `# TeamAnalysis

> Analizza le statistiche del tuo team — app web statica 100% client-side per l'analisi delle performance, delle vendite e degli stati.

[![Versione](${`https://img.shields.io/badge/versione-${encodeURIComponent(version)}-0ea5e9`})](${repoUrl})
[![Repository](${`https://img.shields.io/badge/GitHub-${encodeURIComponent(repo)}-181717?logo=github`})](${repoUrl})
[![Data](${`https://img.shields.io/badge/data-${encodeURIComponent(formatDateIT(date))}-10b981`})](${repoUrl}/commits/main)

**Repository pubblico:** [${repoUrl}](${repoUrl})  ·  **Versione attuale:** \`${version}\` del ${formatDateIT(date)}

---

## Stato Aggiornamenti

Il riquadro **Stato Aggiornamenti** in *Impostazioni* è collegato a GitHub e confronta automaticamente \`version.json\` locale con quello remoto su \`raw.githubusercontent.com\`.

- **Repository preconfigurato:** \`${repo}\` (modificabile in Impostazioni → Repository GitHub)
- **Sorgente di verifica primaria:** \`https://raw.githubusercontent.com/${repo}/main/version.json\`
- **Fallback:** API GitHub \`/repos/${repo}/commits\` (ultimi commit) se \`version.json\` remoto non è raggiungibile
- **Azioni disponibili:** _Verifica aggiornamenti_, _Salva repository_, _Ricarica_, link _Apri su GitHub_

> Nessuna configurazione manuale richiesta: il controllo funziona subito all'apertura dell'app. In caso di aggiornamento disponibile viene mostrato un avviso con la nuova versione e la data.

---

## Novità e Modifiche

Cronologia raggruppata per giorno e versione — stesso sistema del riquadro **Novità e Modifiche** in Impostazioni. I dati provengono da \`changelog.json\` e \`version.json\` (aggiornati automaticamente ad ogni commit tramite \`scripts/bump-version.js\`).

${changelogMd}

---

## Descrizione del sito

**TeamAnalysis** è un'applicazione web statica, completamente client-side, senza server né build, sviluppata per l'analisi dei dati di team.

**Caratteristiche principali:**

- **100% client-side:** HTML, CSS, vanilla JavaScript, IndexedDB e Chart.js via CDN. Nessun backend — basta aprire \`index.html\` o servire la cartella con un server statico (es. \`python3 -m http.server\`).
- **Dati locali:** storage su IndexedDB (\`TeamAnalysisDB\` v3) con store \`performance\`, \`sales\`, \`stati\`, \`settings\`, \`anonymous_map\`, \`custom_stats\`, \`goals\`, \`import_logs\`. Ogni anno è un sistema indipendente filtrato per \`activeYear\`.
- **Importazione CSV:** parser dedicato in \`js/csv-parser.js\` che legge in \`UTF-16LE\` (formato Swisscom) e riconosce tre formati (Performance "Voice Inbound", Sales AOIT "AOIT gew", Sales Nuovi "Open Year Sales Event"). Numeri in formato europeo, gestione sovrascrittura per mese/skill, log di import con ritenzione 30 giorni.
- **Dashboard:** riepilogo collaboratori per skill, obiettivi di team Sales ed Efficienza, sforamenti tolleranza.
- **Statistiche:** grafici Chart.js con vista Team / Individuale, medie di team, obiettivi, template personalizzabili per collaboratore.
- **Obiettivi:** gestione obiettivi Efficienza, Vendita e Stati (calcolo con target + tolleranza), tabella stile Excel per Sales.
- **Database:** tabella interattiva con filtri per fonte (skill), ricerca full-text, ordinamento, paginazione (100 righe), eliminazione filtrata e storicizzazione.
- **Impostazioni & Backup:** gestione collaboratori e skill, anonimizzazione CSV, backup/restore locale, riquadri Stato Aggiornamenti e Novità e Modifiche, gestione tema chiaro/scuro (\`data-theme\`).
- **Privacy:** modalità anonima con mappatura \`Collab. <ID>\`, nessun dato inviato a server esterni (l'unico polling esterno è il controllo versione su GitHub).
- **Versionamento:** \`version.json\` + \`changelog.json\` con bump automatico giornaliero e generazione README.

**Tecnologie:** Vanilla JS (ordine script obbligatorio in \`index.html\`: \`db.js\` → \`csv-parser.js\` → \`statistics.js\` → \`goals.js\` → \`dashboard.js\` → \`version.js\` → \`app.js\`), IndexedDB, Chart.js, CSS variables per tema.

**Autore:** © Copyright 2026 Loris Salerno (TAASALO3) — loris.salerno@swisscom.com — Tutti i diritti riservati.

---

## Avvio rapido

\`\`\`bash
# Clona
git clone https://github.com/${repo}.git
cd TeamAnalysis

# Apri direttamente o via server statico
open index.html
# oppure
python3 -m http.server 8000
\`\`\`

Nessun \`npm install\` o build richiesto.
`;

fs.writeFileSync(readmePath, readme, 'utf8');
console.log(`README.md generato: ${version} del ${formatDateIT(date)} (${changelog.length} versioni)`);
