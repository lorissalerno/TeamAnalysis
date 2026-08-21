#!/usr/bin/env node
/**
 * TeamAnalysis
 * © Copyright 2026 Loris Salerno (TAASALO3) - loris.salerno@swisscom.com
 * Tutti i diritti riservati.
 *
 * Bump versione: incrementa patch se la data è oggi, altrimenti minor se stesso giorno.
 * Uso: node scripts/bump-version.js "Descrizione modifica 1" "Descrizione modifica 2"
 * Se non passate descrizioni, legge git log del giorno corrente.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const versionPath = path.join(root, 'version.json');
const changelogPath = path.join(root, 'changelog.json');

function getTodayStr() {
    const d = new Date();
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
function parseVersion(v) {
    const m = (v || 'v1.0').match(/v?(\d+)\.(\d+)/);
    return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10) };
}
function getGitCommit() {
    try { return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { return ''; }
}
function getGitLogForDate(dateStr) {
    try {
        const out = execSync(`git log --oneline --since="${dateStr} 00:00" --until="${dateStr} 23:59" --pretty=format:"%s"`, { cwd: root }).toString().trim();
        if (!out) return [];
        return out.split('\n').filter(Boolean);
    } catch { return []; }
}

const today = getTodayStr();
let versionData = { version: 'v1.0', date: today, commit: getGitCommit() };
let changelog = [];
try { versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8')); } catch {}
try { changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8')); } catch {}

const args = process.argv.slice(2).filter(Boolean);
let changes = args.length > 0 ? args : getGitLogForDate(today);
if (changes.length === 0) {
    // fallback: prova a prendere ultimo commit non ancora in changelog
    try {
        const lastMsg = execSync('git log -1 --pretty=format:"%s"', { cwd: root }).toString().trim();
        if (lastMsg) changes = [lastMsg];
    } catch {}
}
if (changes.length === 0) changes = ['Aggiornamento generale'];

const parsed = parseVersion(versionData.version);
let newVersion;
if (versionData.date === today) {
    // stesso giorno: incrementa patch
    newVersion = `v${parsed.major}.${parsed.minor + 1}`;
} else {
    // giorno diverso: incrementa comunque patch (v1.15 -> v1.16)
    newVersion = `v${parsed.major}.${parsed.minor + 1}`;
}

const commit = getGitCommit();
const newEntry = { version: newVersion, date: today, novita: changes, bugfix: [] };

// Aggiorna version.json
const newVersionData = { version: newVersion, date: today, commit: commit, description: changes[0] || '' };
fs.writeFileSync(versionPath, JSON.stringify(newVersionData, null, 2) + '\n', 'utf8');

// Helper per leggere novita con fallback legacy
function getNovita(e) {
    if (Array.isArray(e.novita)) return e.novita;
    if (Array.isArray(e.changes)) return e.changes;
    return [];
}

// Aggiorna changelog.json: sostituisci entry di oggi se già esiste, altrimenti prepend
const existingIdx = changelog.findIndex(e => e.date === today);
if (existingIdx >= 0 && changelog[existingIdx].version === newVersion) {
    const merged = Array.from(new Set([...getNovita(changelog[existingIdx]), ...changes]));
    changelog[existingIdx].novita = merged;
    delete changelog[existingIdx].changes;
    if (!Array.isArray(changelog[existingIdx].bugfix)) changelog[existingIdx].bugfix = [];
    changelog[existingIdx].commit = commit;
} else if (existingIdx >= 0) {
    const merged = Array.from(new Set([...changes, ...getNovita(changelog[existingIdx])]));
    changelog[existingIdx].version = newVersion;
    changelog[existingIdx].novita = merged;
    delete changelog[existingIdx].changes;
    if (!Array.isArray(changelog[existingIdx].bugfix)) changelog[existingIdx].bugfix = [];
} else {
    changelog.unshift(newEntry);
}
// Normalizza tutte le entry alla nuova struttura
changelog = changelog.map(e => {
    if (Array.isArray(e.changes) && !Array.isArray(e.novita)) {
        e.novita = e.changes;
        delete e.changes;
    }
    if (!Array.isArray(e.bugfix)) e.bugfix = [];
    if (!Array.isArray(e.novita)) e.novita = [];
    return e;
});
// mantieni solo ultime 30 versioni
if (changelog.length > 30) changelog = changelog.slice(0, 30);
fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n', 'utf8');

console.log(`Bump: ${versionData.version} (${versionData.date}) -> ${newVersion} (${today})`);
console.log(`Changes: ${changes.join(' | ')}`);

// Rigenera README.md con lo stesso sistema del riquadro aggiornamenti
try {
    require('./generate-readme.js');
} catch (e) {
    // fallback: esegui come processo separato
    try { execSync('node ' + path.join(__dirname, 'generate-readme.js'), { cwd: root, stdio: 'inherit' }); } catch {}
}

// Aggiorna fallback incorporato in js/version.js per supporto file://
try {
    const versionJsPath = path.join(root, 'js', 'version.js');
    let jsContent = fs.readFileSync(versionJsPath, 'utf8');
    const embeddedVersionStr = JSON.stringify(newVersionData);
    const embeddedChangelogStr = JSON.stringify(changelog);
    jsContent = jsContent.replace(/const EMBEDDED_VERSION = \{.*?\};/s, `const EMBEDDED_VERSION = ${embeddedVersionStr};`);
    jsContent = jsContent.replace(/const EMBEDDED_CHANGELOG = \[.*?\];/s, `const EMBEDDED_CHANGELOG = ${embeddedChangelogStr};`);
    fs.writeFileSync(versionJsPath, jsContent, 'utf8');
    console.log('Fallback version.js aggiornato');
} catch (e) {
    console.warn('Impossibile aggiornare fallback version.js:', e.message);
}
