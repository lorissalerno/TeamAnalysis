/**
 * TeamAnalysis
 * © Copyright 2026 Loris Salerno (TAASALO3) - loris.salerno@swisscom.com
 * Tutti i diritti riservati.
 */
(function() {
    const VERSION_URL = 'version.json';
    const CHANGELOG_URL = 'changelog.json';
    const GITHUB_REPO_KEY = 'github_repo'; // es. "owner/repo"
    const LAST_CHECK_KEY = 'version_last_check';
    const DEFAULT_REPO = 'lorissalerno/TeamAnalysis';
    // Fallback incorporato per apertura via file:// (fetch bloccato) — aggiornato da bump-version.js
    const EMBEDDED_VERSION = {"version":"v1.26","date":"2026-08-21","commit":"60b7b09","description":"Database: vista Tabella mostra una sola tabella alla volta selezionata dai filtri"};
    const EMBEDDED_CHANGELOG = [{"version":"v1.26","date":"2026-08-21","novita":["Tasto Verifica aggiornamenti diventa Scarica aggiornamento se disponibile, altrimenti mostra Sei aggiornato senza messaggi extra","Torta: doppio toggle centro % e CHF con formato 27'000.-","Torta: se entrambi i toggle centro sono spenti non mostra nulla al centro","Ottimizza popup backup: layout compatto, gerarchia chiara, primary Scarica in evidenza, microcopy breve","Personalizzato popup chiusura: download automatico Backup Completo e chiarito limite popup nativo Chrome non modificabile","Fix altezza riquadri uguale e bug Stato Aggiornamenti con fallback file://","Popup avviso backup prima di chiudere il browser: beforeunload + modal se modifiche non salvate in backup","Changelog: testi semplificati e divisi in Novità e BugFix","Impostazioni: controllo aggiornamenti automatico da GitHub","Impostazioni: cronologia novità raggruppata per versione e giorno","README che si aggiorna da solo ad ogni versione","Tabella Obiettivi Vendita: modifica skill in modalità modifica tabella","Fix barra statistiche sticky: rimane in cima e non sparisce allo scroll","Fix barra statistiche sticky: top -32 e parent block per non sparire allo scroll","Fix: torte mostrano skill sotto al titolo come i grafici a colonne","Sforamenti tolleranze: esclusa parte vendite","Sforamenti tolleranza: memorizza skill selezionato dopo reload","Vista tabella pivot nel Database: righe collaboratore×mese, colonne metriche, una tabella per ogni skill + Sales/Stati","Database: switch Lista/Tabella con stessi filtri, icone SVG vicino a Dati Importati","Database: vista Tabella mostra una sola tabella alla volta selezionata dai filtri"],"bugfix":["Fix modifica torta che riapriva a barre","Filtro skill torta vendite: mostra solo skill assegnati ai collaboratori","Fix filtro skill grafico a torta vendite: ora seleziona skill collaboratori invece di includere tutti","Fix bug origine dati Vendita non mostra Tabella Obiettivi e anteprima destra buggata","Fix grafico a torta per origine dati Stati (0%)","Nasconde Contenuto della Torta per grafici non Sales","Fix warning file:// Unsafe attempt to load URL in console"],"commit":"60b7b09"},{"version":"v1.15","date":"2026-08-20","novita":["Nuova categoria Stati per import, obiettivi e statistiche","Storico modifiche con data e conservazione 30 giorni","Obiettivi Stati: calcolo efficienza con target e tolleranza","Obiettivi: metrica di influenza attivabile quando serve"],"bugfix":["Tab Obiettivi rimane selezionato dopo il reload","Titoli obiettivi più puliti senza prefissi inutili"]},{"version":"v1.14","date":"2026-08-18","novita":["Gestione Skill completa: crea, rinomina ed elimina con controllo dati","Finestre di conferma più chiare al posto dei popup del browser"],"bugfix":["Avviso se elimini uno Skill usato da un solo collaboratore"]},{"version":"v1.13","date":"2026-08-17","novita":["Dashboard: obiettivi Sales di team per ogni Skill"],"bugfix":[]}];

    let localVersion = null;
    let changelogData = null;

    async function fetchJson(url) {
        // file:// non permette fetch: fallisce subito, usiamo fallback
        if (location.protocol === 'file:') return null;
        try {
            const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    async function getLocalVersion() {
        if (localVersion) return localVersion;
        const fetched = await fetchJson(VERSION_URL);
        localVersion = fetched || EMBEDDED_VERSION;
        return localVersion;
    }

    async function getChangelog() {
        if (changelogData) return changelogData;
        const fetched = await fetchJson(CHANGELOG_URL);
        // Se fetch fallisce, usa fallback incorporato; se è array vuoto, comunque mostra fallback
        if (Array.isArray(fetched) && fetched.length > 0) {
            changelogData = fetched;
        } else {
            changelogData = fetched && Array.isArray(fetched) ? fetched : EMBEDDED_CHANGELOG;
            if (!Array.isArray(changelogData) || changelogData.length === 0) changelogData = EMBEDDED_CHANGELOG;
        }
        return changelogData;
    }

    async function getGithubRepo() {
        if (window.appDb) {
            const repo = await window.appDb.getSetting(GITHUB_REPO_KEY, '');
            const clean = (repo || '').trim();
            if (clean) return clean;
            return DEFAULT_REPO;
        }
        const ls = (localStorage.getItem(GITHUB_REPO_KEY) || '').trim();
        return ls || DEFAULT_REPO;
    }

    async function getConfiguredRepoRaw() {
        if (window.appDb) {
            const repo = await window.appDb.getSetting(GITHUB_REPO_KEY, '');
            return (repo || '').trim();
        }
        return (localStorage.getItem(GITHUB_REPO_KEY) || '').trim();
    }

    async function setGithubRepo(repo) {
        let clean = (repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
        if (!clean) clean = DEFAULT_REPO;
        if (window.appDb) await window.appDb.setSetting(GITHUB_REPO_KEY, clean);
        try { localStorage.setItem(GITHUB_REPO_KEY, clean); } catch(e) {}
        return clean;
    }

    // Confronta due versioni tipo v1.15 -> ritorna 1 se a>b, -1 se a<b, 0 se uguale
    function compareVersions(a, b) {
        const pa = (a || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
        const pb = (b || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na > nb) return 1;
            if (na < nb) return -1;
        }
        return 0;
    }

    function formatDateIT(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('it-IT');
        } catch(e) { return dateStr; }
    }

    // Verifica aggiornamenti: confronta version.json locale con quello remoto su GitHub raw
    async function checkForUpdates() {
        const local = await getLocalVersion();
        const localVer = local ? local.version : null;
        const repo = await getGithubRepo();
        const result = {
            localVersion: localVer,
            localDate: local ? local.date : null,
            repo: repo,
            status: 'unknown',
            message: '',
            remoteVersion: null,
            remoteDate: null,
            lastCommit: null
        };

        if (!repo) {
            result.status = 'no-repo';
            result.message = 'Repository GitHub non configurato. Inserisci owner/repo per abilitare il controllo.';
            return result;
        }

        // 1) Prova a leggere version.json remoto via raw.githubusercontent.com
        try {
            const rawUrl = 'https://raw.githubusercontent.com/' + repo + '/main/version.json';
            const remote = await fetch(rawUrl + '?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
            if (remote && remote.version) {
                result.remoteVersion = remote.version;
                result.remoteDate = remote.date || null;
                const cmp = compareVersions(remote.version, localVer);
                if (cmp > 0) {
                    result.status = 'update-available';
                    result.message = 'Aggiornamento disponibile: ' + remote.version + ' del ' + formatDateIT(remote.date) + '. La tua versione è ' + localVer + '.';
                } else if (cmp < 0) {
                    result.status = 'ahead';
                    result.message = 'Stai usando una versione più recente (' + localVer + ') rispetto a GitHub (' + remote.version + ').';
                } else {
                    result.status = 'up-to-date';
                    result.message = 'Sei aggiornato alla versione più recente (' + localVer + ').';
                }
                // salva timestamp ultimo check
                if (window.appDb) await window.appDb.setSetting(LAST_CHECK_KEY, Date.now());
                return result;
            }
        } catch(e) {}

        // 2) Fallback: GitHub API commits (mostra ultimo commit come indicatore di update)
        try {
            const apiUrl = 'https://api.github.com/repos/' + repo + '/commits?per_page=5';
            const res = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
            if (res.ok) {
                const commits = await res.json();
                if (Array.isArray(commits) && commits.length > 0) {
                    const last = commits[0];
                    result.lastCommit = {
                        sha: (last.sha || '').substring(0, 7),
                        message: last.commit ? last.commit.message.split('\n')[0] : '',
                        date: last.commit && last.commit.committer ? last.commit.committer.date : null,
                        url: last.html_url || ('https://github.com/' + repo + '/commit/' + last.sha)
                    };
                    // Se non abbiamo remote version, usiamo la data dell'ultimo commit per capire se c'è attività recente
                    if (!result.remoteVersion && result.lastCommit.date) {
                        const commitDate = result.lastCommit.date.substring(0, 10);
                        if (local && local.date && commitDate > local.date) {
                            result.status = 'update-available';
                            result.message = 'Nuovi commit su GitHub dopo la tua versione (' + localVer + ' del ' + formatDateIT(local.date) + '). Ultimo: ' + result.lastCommit.message;
                        } else {
                            result.status = 'up-to-date';
                            result.message = 'Nessun nuovo commit rilevato dopo la tua versione. Ultimo commit: ' + result.lastCommit.message;
                        }
                    } else if (!result.status || result.status === 'unknown') {
                        result.status = 'api-ok';
                        result.message = 'Ultimo commit su GitHub: ' + result.lastCommit.message;
                    }
                    if (window.appDb) await window.appDb.setSetting(LAST_CHECK_KEY, Date.now());
                    return result;
                }
            }
            if (res.status === 403) {
                result.status = 'rate-limit';
                result.message = 'Limite richieste GitHub API raggiunto. Riprova più tardi.';
                return result;
            }
            if (res.status === 404) {
                result.status = 'not-found';
                result.message = 'Repository non trovato: ' + repo + '. Verifica il nome owner/repo.';
                return result;
            }
        } catch(e) {}

        result.status = 'error';
        result.message = 'Impossibile verificare gli aggiornamenti. Controlla la connessione o il nome del repository.';
        return result;
    }

    function renderUpdateCard(container) {
        if (!container) return;
        // template statico gestito da renderVersionSection
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function buildChangelogHtml(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:12px;">Nessuna novità disponibile.</p>';
        }
        let html = '<div class="changelog-timeline">';
        data.forEach(entry => {
            const isLatest = entry === data[0];
            // Supporta sia formato nuovo (novita/bugfix) sia legacy (changes)
            const novita = Array.isArray(entry.novita) ? entry.novita : (Array.isArray(entry.changes) ? entry.changes : []);
            const bugfix = Array.isArray(entry.bugfix) ? entry.bugfix : [];
            const hasNovita = novita.length > 0;
            const hasBugfix = bugfix.length > 0;
            html += '<div class="changelog-entry' + (isLatest ? ' latest' : '') + '">'
                + '<div class="changelog-entry-header">'
                + '<span class="changelog-version">' + escapeHtml(entry.version) + '</span>'
                + '<span class="changelog-date">' + escapeHtml(formatDateIT(entry.date)) + '</span>'
                + (isLatest ? '<span class="changelog-badge-latest">Attuale</span>' : '')
                + '</div>';
            if (hasNovita || hasBugfix) {
                if (hasNovita) {
                    html += '<div style="margin-top:8px; font-size:0.75rem; font-weight:700; color:#10b981; letter-spacing:0.04em; text-transform:uppercase;">Novità</div><ul class="changelog-list">';
                    novita.forEach(c => { html += '<li>' + escapeHtml(c) + '</li>'; });
                    html += '</ul>';
                }
                if (hasBugfix) {
                    html += '<div style="margin-top:8px; font-size:0.75rem; font-weight:700; color:#f59e0b; letter-spacing:0.04em; text-transform:uppercase;">BugFix</div><ul class="changelog-list">';
                    bugfix.forEach(c => { html += '<li>' + escapeHtml(c) + '</li>'; });
                    html += '</ul>';
                }
            } else {
                html += '<p style="color:var(--text-muted); font-size:0.8rem; margin-top:6px;">Nessun dettaglio.</p>';
            }
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    async function renderVersionSection() {
        const local = await getLocalVersion();
        const changelog = await getChangelog();
        const repo = await getGithubRepo();
        const lastCheck = window.appDb ? await window.appDb.getSetting(LAST_CHECK_KEY, null) : null;

        // --- Card Aggiornamenti ---
        const verBadge = document.getElementById('update-version-badge');
        const verDate = document.getElementById('update-version-date');
        const repoInput = document.getElementById('github-repo-input');
        const statusEl = document.getElementById('update-status');
        const lastCheckEl = document.getElementById('update-last-check');
        const githubLink = document.getElementById('github-open-link');

        if (verBadge) verBadge.textContent = local ? local.version : '—';
        if (verDate) verDate.textContent = local ? formatDateIT(local.date) : '—';
        if (repoInput && repoInput.value === '' && repo) repoInput.value = repo;
        if (lastCheckEl) {
            lastCheckEl.textContent = lastCheck ? 'Ultimo controllo: ' + new Date(lastCheck).toLocaleString('it-IT') : 'Mai verificato';
        }
        if (githubLink) {
            if (repo) {
                githubLink.href = 'https://github.com/' + repo;
                githubLink.style.display = 'inline-flex';
            } else {
                githubLink.style.display = 'none';
            }
        }
        if (statusEl && !statusEl.dataset.initialized) {
            statusEl.innerHTML = '';
        }

        // --- Card Changelog ---
        const changelogContainer = document.getElementById('changelog-container');
        if (changelogContainer) {
            changelogContainer.innerHTML = buildChangelogHtml(changelog);
        }
        const changelogCount = document.getElementById('changelog-count');
        if (changelogCount && Array.isArray(changelog)) {
            changelogCount.textContent = changelog.length + ' versioni';
        }
    }

    async function handleCheckUpdates() {
        const btn = document.getElementById('check-updates-btn');
        const statusEl = document.getElementById('update-status');
        const lastCheckEl = document.getElementById('update-last-check');
        const githubLink = document.getElementById('github-open-link');
        // Se il bottone è già in modalità "scarica", il click scarica (reload)
        if (btn && btn.dataset.mode === 'download') {
            location.reload();
            return;
        }
        if (btn) { btn.disabled = true; }
        if (statusEl) {
            statusEl.dataset.initialized = '1';
        }
        const repoInput = document.getElementById('github-repo-input');
        if (repoInput) {
            const newRepo = await setGithubRepo(repoInput.value);
            if (githubLink) {
                if (newRepo) {
                    githubLink.href = 'https://github.com/' + newRepo;
                    githubLink.style.display = 'inline-flex';
                } else {
                    githubLink.style.display = 'none';
                }
            }
        }
        const result = await checkForUpdates();
        if (lastCheckEl) {
            const now = Date.now();
            lastCheckEl.textContent = 'Ultimo controllo: ' + new Date(now).toLocaleString('it-IT');
        }
        if (btn) {
            btn.disabled = false;
            if (result.status === 'update-available') {
                // Trasforma il bottone in "Scarica aggiornamento" — nessun messaggio in cima
                if (statusEl) statusEl.innerHTML = '';
                btn.dataset.mode = 'download';
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Scarica aggiornamento' + (result.remoteVersion ? ' (' + escapeHtml(result.remoteVersion) + ')' : '');
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.style.color = '';
                return;
            }
            if (result.status === 'up-to-date') {
                if (statusEl) statusEl.innerHTML = '';
                btn.dataset.mode = '';
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg> Sei aggiornato alla versione più recente' + (result.localVersion ? ' (' + escapeHtml(result.localVersion) + ')' : '');
                btn.style.background = 'rgba(16,185,129,0.15)';
                btn.style.borderColor = 'rgba(16,185,129,0.35)';
                btn.style.color = '#10b981';
                return;
            }
        }
        // Altri stati (errore, not-found, rate-limit, ahead): mostra solo messaggio sobrio in #update-status, bottone resta "Verifica aggiornamenti"
        if (statusEl) {
            let color = 'var(--text-muted)';
            let bg = 'var(--bg-base)';
            let border = 'var(--border)';
            let icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
            if (result.status === 'ahead') {
                color = '#3b82f6'; bg = 'rgba(59,130,246,0.1)'; border = 'rgba(59,130,246,0.3)';
                icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
            }
            let html = '<div style="display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border-radius:8px; background:' + bg + '; border:1px solid ' + border + '; color:' + color + '; font-size:0.85rem; line-height:1.5;">'
                + '<span style="margin-top:2px; flex-shrink:0;">' + icon + '</span>'
                + '<span>' + escapeHtml(result.message) + '</span></div>';
            statusEl.innerHTML = html;
        }
        if (btn) {
            btn.dataset.mode = '';
            btn.textContent = 'Verifica aggiornamenti';
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    }

    function setupVersionSection() {
        const checkBtn = document.getElementById('check-updates-btn');
        if (checkBtn && !checkBtn.dataset.bound) {
            checkBtn.dataset.bound = '1';
            checkBtn.addEventListener('click', handleCheckUpdates);
        }
        const saveRepoBtn = document.getElementById('save-github-repo-btn');
        if (saveRepoBtn && !saveRepoBtn.dataset.bound) {
            saveRepoBtn.dataset.bound = '1';
            saveRepoBtn.addEventListener('click', async () => {
                const input = document.getElementById('github-repo-input');
                const repo = await setGithubRepo(input ? input.value : '');
                if (window.appDialog) await window.appDialog.alert(repo ? 'Repository salvato: ' + repo : 'Repository rimosso.');
                renderVersionSection();
            });
        }
        const reloadBtn = document.getElementById('reload-app-btn');
        if (reloadBtn && !reloadBtn.dataset.bound) {
            reloadBtn.dataset.bound = '1';
            reloadBtn.addEventListener('click', () => location.reload());
        }
    }

    window.VersionManager = {
        getLocalVersion: getLocalVersion,
        getChangelog: getChangelog,
        checkForUpdates: checkForUpdates,
        renderVersionSection: renderVersionSection,
        setupVersionSection: setupVersionSection,
        handleCheckUpdates: handleCheckUpdates,
        compareVersions: compareVersions
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Setup iniziale se la sezione settings è già nel DOM
        setupVersionSection();
    });
    window.addEventListener('app-initialized', () => {
        renderVersionSection();
        setupVersionSection();
    });
})();
