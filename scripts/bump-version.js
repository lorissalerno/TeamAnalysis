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
const newEntry = { version: newVersion, date: today, changes: changes };

// Aggiorna version.json
const newVersionData = { version: newVersion, date: today, commit: commit, description: changes[0] || '' };
fs.writeFileSync(versionPath, JSON.stringify(newVersionData, null, 2) + '\n', 'utf8');

// Aggiorna changelog.json: sostituisci entry di oggi se già esiste, altrimenti prepend
const existingIdx = changelog.findIndex(e => e.date === today);
if (existingIdx >= 0 && changelog[existingIdx].version === newVersion) {
    // merge changes
    const set = new Set([...changelog[existingIdx].changes, ...changes]);
    changelog[existingIdx].changes = Array.from(set);
    changelog[existingIdx].commit = commit;
} else if (existingIdx >= 0) {
    // stesso giorno ma versione diversa -> aggiorna versione e merge
    changelog[existingIdx].version = newVersion;
    changelog[existingIdx].changes = Array.from(new Set([...changes, ...changelog[existingIdx].changes]));
} else {
    changelog.unshift(newEntry);
}
// mantieni solo ultime 30 versioni
if (changelog.length > 30) changelog = changelog.slice(0, 30);
fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n', 'utf8');

console.log(`Bump: ${versionData.version} (${versionData.date}) -> ${newVersion} (${today})`);
console.log(`Changes: ${changes.join(' | ')}`);
