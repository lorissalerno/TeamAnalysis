/**
 * TeamAnalysis
 * © Copyright 2026 Loris Salerno (TAASALO3) - loris.salerno@swisscom.com
 * Tutti i diritti riservati.
 * Vista Pivot Database: una SOLA tabella alla volta (skill / Sales / Stati).
 * Righe = collaboratore × mese, Colonne = metriche. Selettore = chip Filtra per fonte.
 */
(function() {
    const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    const MONTH_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

    function monthLabel(dateStr) {
        if (!dateStr || !dateStr.includes('-')) return dateStr || '-';
        const m = parseInt(dateStr.split('-')[1], 10);
        if (m >= 1 && m <= 12) return MONTH_SHORT[m-1];
        return dateStr;
    }
    function formatVal(v) {
        if (v === null || v === undefined || v === '') return '-';
        if (typeof v === 'number') {
            if (Number.isInteger(v)) return String(v);
            return v.toLocaleString('it-IT', { maximumFractionDigits: 2 });
        }
        const n = parseFloat(String(v).replace(',', '.'));
        if (!isNaN(n) && String(v).trim() !== '') {
            if (Number.isInteger(n)) return String(n);
            return n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
        }
        return String(v);
    }
    function getPivotSalesColumns(salesRecords) {
        const cols = new Set();
        salesRecords.forEach(r => {
            let prod = (r.data && r.data.Product) ? String(r.data.Product) : (r.skill || 'AOIT');
            if (prod.toLowerCase().includes('aoit')) prod = 'AOIT';
            cols.add(prod);
        });
        return Array.from(cols).sort((a,b)=> a.localeCompare(b,'it'));
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function computePivotColWidth(numCols) {
        const card = document.getElementById('db-pivot-card');
        const cardW = card ? card.clientWidth : (window.innerWidth - 320);
        const stickyW = 150 + 72;
        const avail = Math.max(200, cardW - stickyW - 16);
        const raw = Math.floor(avail / Math.max(1, numCols));
        const clamped = Math.max(80, Math.min(140, raw));
        return clamped + 'px';
    }
    function applyPivotColWidths() {
        const container = document.getElementById('db-pivot-container');
        if (!container) return;
        container.querySelectorAll('.db-pivot-table').forEach(tbl => {
            const ths = tbl.querySelectorAll('thead th');
            const numCols = Math.max(0, ths.length - 2);
            if (numCols <= 0) return;
            const w = computePivotColWidth(numCols);
            tbl.style.setProperty('--pivot-col-w', w);
        });
    }

    async function renderDatabasePivot() {
        const container = document.getElementById('db-pivot-container');
        const card = document.getElementById('db-pivot-card');
        if (!container || !card || !window.appDb || !window.appState) return;
        const activeYear = window.appState.activeYear;
        const perfRecords = await appDb.getAll('performance', 'year', activeYear);
        const salesRecords = await appDb.getAll('sales', 'year', activeYear);
        const statiRecords = await appDb.getAll('stati', 'year', activeYear);

        const yearBadge = document.getElementById('db-pivot-year-badge');
        if (yearBadge) yearBadge.textContent = activeYear;

        const searchTerm = (document.getElementById('db-search-input') ? document.getElementById('db-search-input').value : '').toLowerCase().trim();
        const activeFilters = window.appState.dbCategoryFilters || null;

        container.innerHTML = '';

        const skillSet = new Set();
        perfRecords.forEach(r => skillSet.add(r.skill || 'Performance (Generale)'));
        const skills = Array.from(skillSet).sort((a,b)=> a.localeCompare(b,'it'));

        // ordine come nelle chip: skill (in ordine alfabetico per pivot), poi Sales, poi Stati
        const orderedAvailable = [...skills];
        if (salesRecords.length > 0) orderedAvailable.push('Sales');
        if (statiRecords.length > 0) orderedAvailable.push('Stati');

        if (orderedAvailable.length === 0) {
            container.innerHTML = `<div class="db-pivot-empty">
                <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="opacity:0.5;"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                    <span>Nessun dato disponibile per l'anno selezionato.</span>
                </div>
            </div>`;
            const counter = document.getElementById('db-pivot-counter');
            if (counter) counter.textContent = '';
            return;
        }

        // seleziona UNA sola categoria: la prima attiva tra le disponibili, altrimenti la prima disponibile
        let selected = null;
        if (activeFilters && activeFilters.size > 0) {
            for (const cat of orderedAvailable) {
                if (activeFilters.has(cat)) { selected = cat; break; }
            }
        }
        if (!selected) selected = orderedAvailable[0];

        function rowMatchesSearch(emp, mLabel, metricsValues) {
            if (!searchTerm) return true;
            const disp = (window.getDisplayName ? window.getDisplayName(emp) : emp).toLowerCase();
            if (disp.includes(searchTerm) || emp.toLowerCase().includes(searchTerm)) return true;
            if (mLabel.toLowerCase().includes(searchTerm)) return true;
            for (const mv of metricsValues) {
                if (String(mv).toLowerCase().includes(searchTerm)) return true;
            }
            return false;
        }

        let rendered = false;

        // Se la selezione è una skill performance
        if (skills.includes(selected)) {
            const skill = selected;
            const recs = perfRecords.filter(r => (r.skill || 'Performance (Generale)') === skill);
            const metricSet = new Set();
            recs.forEach(r => { if (r.data) Object.keys(r.data).forEach(k => metricSet.add(k)); });
            const metrics = Array.from(metricSet).sort((a,b)=> a.localeCompare(b,'it'));
            if (metrics.length > 0 && recs.length > 0) {
                const map = new Map();
                recs.forEach(r => {
                    const key = `${r.employee}|${r.date}`;
                    if (!map.has(key)) map.set(key, { employee: r.employee, date: r.date, data: {} });
                    const entry = map.get(key);
                    Object.entries(r.data).forEach(([k,v]) => { entry.data[k] = v; });
                });
                let rows = Array.from(map.values());
                rows.sort((a,b) => {
                    const na = (window.getDisplayName ? window.getDisplayName(a.employee) : a.employee).toLowerCase();
                    const nb = (window.getDisplayName ? window.getDisplayName(b.employee) : b.employee).toLowerCase();
                    if (na !== nb) return na.localeCompare(nb,'it');
                    return (a.date||'').localeCompare(b.date||'');
                });
                if (searchTerm) {
                    rows = rows.filter(rw => {
                        const mLabel = MONTH_NAMES[parseInt(rw.date.split('-')[1],10)-1] || rw.date;
                        const vals = metrics.map(m => formatVal(rw.data[m]));
                        const metricNames = metrics.join(' ').toLowerCase();
                        return rowMatchesSearch(rw.employee, mLabel, vals) || metricNames.includes(searchTerm) || skill.toLowerCase().includes(searchTerm);
                    });
                }
                if (rows.length > 0 || !searchTerm) {
                    const section = document.createElement('div');
                    section.innerHTML = `
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
                            <div class="db-pivot-section-title">
                                <span style="width:10px; height:10px; border-radius:50%; background:var(--primary); display:inline-block;"></span>
                                <span>${escapeHtml(skill)}</span>
                                <span class="db-pivot-badge">${rows.length} righe · ${metrics.length} metriche</span>
                            </div>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${recs.length} record grezzi</span>
                        </div>
                        ${rows.length === 0 ? `<div class="db-pivot-empty" style="padding:18px;">Nessuna riga corrisponde alla ricerca.</div>` : `
                        <div class="db-pivot-scroll">
                            <table class="db-pivot-table">
                                <thead><tr><th>Collaboratore</th><th>Mese</th>${metrics.map(m => `<th title="${escapeHtml(m)}">${escapeHtml(m)}</th>`).join('')}</tr></thead>
                                <tbody>${rows.map(rw => {
                                    const disp = window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee;
                                    const mLbl = monthLabel(rw.date);
                                    return `<tr><td title="${escapeHtml(disp)}">${escapeHtml(disp)}</td><td>${escapeHtml(mLbl)}</td>${metrics.map(m => `<td>${escapeHtml(formatVal(rw.data[m]))}</td>`).join('')}</tr>`;
                                }).join('')}</tbody>
                            </table>
                        </div>`}
                    `;
                    container.appendChild(section);
                    rendered = true;
                }
            }
        } else if (selected === 'Sales') {
            const prodCols = getPivotSalesColumns(salesRecords);
            const map = new Map();
            salesRecords.forEach(r => {
                const ym = r.date ? r.date.substring(0,7) : '0000-00';
                const key = `${r.employee}|${ym}`;
                if (!map.has(key)) map.set(key, { employee: r.employee, ym, counts: {}, sums: {} });
                const entry = map.get(key);
                let prod = (r.data && r.data.Product) ? String(r.data.Product) : (r.skill || 'AOIT');
                if (prod.toLowerCase().includes('aoit')) prod = 'AOIT';
                entry.counts[prod] = (entry.counts[prod] || 0) + 1;
                let v = 0;
                if (r.data) {
                    if (r.data.AOIT !== undefined) v = parseFloat(r.data.AOIT) || 0;
                    else if (r.data['AOIT gew'] !== undefined) v = parseFloat(r.data['AOIT gew']) || 0;
                    else {
                        const k = Object.keys(r.data).find(k => k !== 'Product' && k !== 'Nb Events');
                        if (k) v = parseFloat(r.data[k]) || 0;
                    }
                }
                entry.sums[prod] = (entry.sums[prod] || 0) + (isNaN(v)?0:v);
            });
            let rows = Array.from(map.values());
            rows.sort((a,b) => {
                const na = (window.getDisplayName ? window.getDisplayName(a.employee) : a.employee).toLowerCase();
                const nb = (window.getDisplayName ? window.getDisplayName(b.employee) : b.employee).toLowerCase();
                if (na !== nb) return na.localeCompare(nb,'it');
                return (a.ym||'').localeCompare(b.ym||'');
            });
            if (searchTerm) {
                rows = rows.filter(rw => {
                    const disp = (window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee).toLowerCase();
                    const mIdx = parseInt(rw.ym.split('-')[1],10);
                    const mName = (mIdx>=1&&mIdx<=12) ? MONTH_NAMES[mIdx-1].toLowerCase() : rw.ym.toLowerCase();
                    if (disp.includes(searchTerm) || rw.employee.toLowerCase().includes(searchTerm) || mName.includes(searchTerm) || 'sales'.includes(searchTerm)) return true;
                    for (const pc of prodCols) {
                        if (pc.toLowerCase().includes(searchTerm)) return true;
                        if (String(rw.counts[pc]||0).includes(searchTerm)) return true;
                    }
                    return false;
                });
            }
            const hasAOIT = prodCols.includes('AOIT');
            const section = document.createElement('div');
            section.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
                    <div class="db-pivot-section-title">
                        <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                        <span>Sales</span>
                        <span class="db-pivot-badge">${rows.length} righe · ${prodCols.length} prodotti</span>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${salesRecords.length} vendite totali</span>
                </div>
                ${rows.length === 0 ? `<div class="db-pivot-empty" style="padding:18px;">Nessuna riga corrisponde alla ricerca.</div>` : `
                <div class="db-pivot-scroll">
                    <table class="db-pivot-table">
                        <thead><tr><th>Collaboratore</th><th>Mese</th>${prodCols.map(p => `<th>${escapeHtml(p)}</th>`).join('')}<th style="background:var(--bg-base); font-weight:800;">Totale</th></tr></thead>
                        <tbody>${rows.map(rw => {
                            const disp = window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee;
                            const ym = rw.ym;
                            const m = ym.includes('-') ? MONTH_SHORT[parseInt(ym.split('-')[1],10)-1] || ym : ym;
                            const total = prodCols.reduce((s,pc)=> s + (rw.counts[pc]||0), 0);
                            return `<tr><td title="${escapeHtml(disp)}">${escapeHtml(disp)}</td><td>${escapeHtml(m)}</td>${prodCols.map(pc => {
                                const c = rw.counts[pc] || 0;
                                if (c===0) return `<td style="color:var(--text-muted);">-</td>`;
                                if (pc==='AOIT' && rw.sums[pc]) return `<td title="CHF ${formatVal(rw.sums[pc])}">${c}</td>`;
                                return `<td>${c}</td>`;
                            }).join('')}<td style="font-weight:700; background:rgba(16,185,129,0.08);">${total}</td></tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
                ${hasAOIT ? '<div style="font-size:0.72rem; color:var(--text-muted); margin-top:6px;">Per AOIT il numero indica le vendite; al passaggio del mouse vedi la somma CHF.</div>' : ''}`}
            `;
            container.appendChild(section);
            rendered = true;
        } else if (selected === 'Stati') {
            const metricSet = new Set();
            statiRecords.forEach(r => { if (r.data) Object.keys(r.data).forEach(k => metricSet.add(k)); });
            const metrics = Array.from(metricSet).sort((a,b)=> a.localeCompare(b,'it'));
            if (metrics.length > 0) {
                const map = new Map();
                statiRecords.forEach(r => {
                    const key = `${r.employee}|${r.date}`;
                    if (!map.has(key)) map.set(key, { employee: r.employee, date: r.date, data: {} });
                    const entry = map.get(key);
                    Object.entries(r.data).forEach(([k,v]) => entry.data[k]=v);
                });
                let rows = Array.from(map.values());
                rows.sort((a,b) => {
                    const na = (window.getDisplayName ? window.getDisplayName(a.employee) : a.employee).toLowerCase();
                    const nb = (window.getDisplayName ? window.getDisplayName(b.employee) : b.employee).toLowerCase();
                    if (na !== nb) return na.localeCompare(nb,'it');
                    return (a.date||'').localeCompare(b.date||'');
                });
                if (searchTerm) {
                    rows = rows.filter(rw => {
                        const mLabel = MONTH_NAMES[parseInt(rw.date.split('-')[1],10)-1] || rw.date;
                        const vals = metrics.map(m => formatVal(rw.data[m]));
                        const metricNames = metrics.join(' ').toLowerCase();
                        return rowMatchesSearch(rw.employee, mLabel, vals) || metricNames.includes(searchTerm) || 'stati'.includes(searchTerm);
                    });
                }
                const section = document.createElement('div');
                section.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
                        <div class="db-pivot-section-title">
                            <span style="width:10px; height:10px; border-radius:50%; background:#8b5cf6; display:inline-block;"></span>
                            <span>Stati</span>
                            <span class="db-pivot-badge">${rows.length} righe · ${metrics.length} metriche</span>
                        </div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${statiRecords.length} record grezzi</span>
                    </div>
                    ${rows.length === 0 ? `<div class="db-pivot-empty" style="padding:18px;">Nessuna riga corrisponde alla ricerca.</div>` : `
                    <div class="db-pivot-scroll">
                        <table class="db-pivot-table">
                            <thead><tr><th>Collaboratore</th><th>Mese</th>${metrics.map(m => `<th title="${escapeHtml(m)}">${escapeHtml(m.replace(/^State Rcode - /,'').replace(/^State Duration /,''))}</th>`).join('')}</tr></thead>
                            <tbody>${rows.map(rw => {
                                const disp = window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee;
                                const mLbl = monthLabel(rw.date);
                                return `<tr><td title="${escapeHtml(disp)}">${escapeHtml(disp)}</td><td>${escapeHtml(mLbl)}</td>${metrics.map(m => `<td>${escapeHtml(formatVal(rw.data[m]))}</td>`).join('')}</tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>`}
                `;
                container.appendChild(section);
                rendered = true;
            }
        }

        if (!rendered) {
            const noFilterActive = activeFilters && activeFilters.size === 0;
            container.innerHTML = `<div class="db-pivot-empty">
                <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="opacity:0.5;"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                    <span>${noFilterActive ? 'Nessuna fonte selezionata nei filtri. Seleziona una chip sopra.' : (searchTerm ? 'Nessun dato corrisponde ai filtri attivi.' : 'Nessun dato disponibile per i filtri selezionati.')}</span>
                </div>
            </div>`;
        }

        // applica larghezza colonne fissa, uguale per tutte, in base alla pagina (con limite 80–140px)
        if (rendered) {
            // rinvia di un tick per avere cardW corretto dopo display:block
            requestAnimationFrame(() => applyPivotColWidths());
            setTimeout(applyPivotColWidths, 80);
        }

        const counter = document.getElementById('db-pivot-counter');
        if (counter) counter.textContent = rendered ? `1 tabella · ${escapeHtml(selected)}` : '';
    }

    function setDbView(mode) {
        const listBtn = document.getElementById('db-view-list-btn');
        const pivotBtn = document.getElementById('db-view-pivot-btn');
        const listTableWrap = document.querySelector('.db-table-scroll-container');
        const listPag = document.getElementById('db-pagination');
        const pivotCard = document.getElementById('db-pivot-card');
        const isPivot = mode === 'pivot';
        if (listBtn) listBtn.classList.toggle('active', !isPivot);
        if (pivotBtn) pivotBtn.classList.toggle('active', isPivot);
        if (listTableWrap) listTableWrap.style.display = isPivot ? 'none' : 'block';
        if (listPag) listPag.style.display = isPivot ? 'none' : 'flex';
        if (pivotCard) pivotCard.style.display = isPivot ? 'block' : 'none';
        if (window.appState) window.appState.dbViewMode = mode;
        if (isPivot && window.appState && window.appState.dbCategoryFilters) {
            const first = window.appState.dbCategoryFilters.values().next().value;
            if (first && window.appState.dbCategoryFilters.size !== 1) {
                window.appState.dbCategoryFilters = new Set([first]);
            }
        }
        if (window.appDb && window.appDb.setSetting) window.appDb.setSetting('db_view_mode', mode).catch(()=>{});
        if (isPivot) {
            if (window.renderImportedData) window.renderImportedData();
            else renderDatabasePivot();
        }
    }

    window.renderDatabasePivot = renderDatabasePivot;
    window.setDbView = setDbView;

    document.addEventListener('DOMContentLoaded', () => {
        const listBtn = document.getElementById('db-view-list-btn');
        const pivotBtn = document.getElementById('db-view-pivot-btn');
        if (listBtn) listBtn.addEventListener('click', () => setDbView('list'));
        if (pivotBtn) pivotBtn.addEventListener('click', () => setDbView('pivot'));

        (async () => {
            let saved = 'list';
            try { saved = await window.appDb.getSetting('db_view_mode', 'list'); } catch(e) {}
            if (window.appState && window.appState.dbViewMode) saved = window.appState.dbViewMode;
            setDbView(saved === 'pivot' ? 'pivot' : 'list');
        })();

        window.addEventListener('app-initialized', async () => {
            try {
                const s = await window.appDb.getSetting('db_view_mode', 'list');
                setDbView(s === 'pivot' ? 'pivot' : 'list');
            } catch(e) {}
            if (window.appState && window.appState.dbViewMode === 'pivot') renderDatabasePivot();
            else setTimeout(() => { if (window.appState) renderDatabasePivot(); }, 900);
        });

        let pivotResizeTimer = null;
        window.addEventListener('resize', () => {
            if (!window.appState || window.appState.dbViewMode !== 'pivot') return;
            clearTimeout(pivotResizeTimer);
            pivotResizeTimer = setTimeout(applyPivotColWidths, 120);
        });
    });
})();
