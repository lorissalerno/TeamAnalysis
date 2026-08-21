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
    function ensurePivotSort() {
        if (!window.appState) window.appState = {};
        if (!window.appState.dbPivotSort) window.appState.dbPivotSort = { col: 'employee', dir: 'asc' };
        return window.appState.dbPivotSort;
    }
    function sortIconFor(col, sort) {
        const s = sort || ensurePivotSort();
        if (s.col !== col) {
            return '<span class="db-pivot-sort-icon" style="opacity:0.35;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg></span>';
        }
        if (s.dir === 'asc') {
            return '<span class="db-pivot-sort-icon" style="color:var(--primary);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></span>';
        }
        return '<span class="db-pivot-sort-icon" style="color:var(--primary);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg></span>';
    }
    function setPivotSort(col) {
        const sort = ensurePivotSort();
        if (sort.col === col) {
            sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            sort.col = col;
            sort.dir = col === 'employee' ? 'asc' : (col === 'month' ? 'asc' : 'desc');
            // metriche: primo click desc per vedere i più alti prima, come lista Valore
            if (col !== 'employee' && col !== 'month') sort.dir = 'desc';
            // ma per coerenza iniziale, se col è employee/month => asc
            if (col === 'employee' || col === 'month') sort.dir = 'asc';
        }
        renderDatabasePivot();
    }
    window.setPivotSort = setPivotSort;
    function bindPivotSortHandlers(container) {
        if (!container) return;
        container.querySelectorAll('th.db-pivot-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-col');
                if (col) setPivotSort(col);
            });
        });
    }

    // Helpers per colorazione in base a obiettivi
    function computeRangeLocal(g) {
        if (window.computeGoalRange) return window.computeGoalRange(g);
        const target = parseFloat(g && g.target) || 0;
        if (!g || !g.toleranceType || g.toleranceType === 'none') return { min: target, max: target };
        const isNumeric = g.toleranceType === 'numeric';
        const plus = parseFloat(g.tolerancePlus) || 0;
        const minus = parseFloat(g.toleranceMinus) || 0;
        if (g.direction === 'max') {
            const max = isNumeric ? target + plus : target * (1 + plus / 100);
            return { min: null, max: max };
        }
        if (g.direction === 'min') {
            const min = isNumeric ? target - minus : target * (1 - minus / 100);
            return { min: min, max: null };
        }
        const min = isNumeric ? target - minus : target * (1 - minus / 100);
        const max = isNumeric ? target + plus : target * (1 + plus / 100);
        return { min: min, max: max };
    }
    function findGoalForCell(goals, metricFull, employee, skill) {
        if (!goals || goals.length === 0) return null;
        // priorità: employee specifico > team, skill specifico > ALL
        let best = null;
        let bestScore = -1;
        for (const g of goals) {
            if ((g.metric || '') !== metricFull) continue;
            const gSkill = g.skill || 'ALL';
            if (gSkill !== 'ALL' && gSkill !== skill && skill !== 'Sales' && skill !== 'Stati') continue;
            // per Sales/Stati lo skill del goal può essere ALL, quindi ok
            const gEmp = (g.employee || '').trim();
            if (gEmp && gEmp !== employee) continue;
            let score = 0;
            if (gEmp) score += 2;
            if (gSkill !== 'ALL') score += 1;
            if (score > bestScore) {
                best = g;
                bestScore = score;
            }
        }
        return best;
    }
    function evalGoalStatus(val, goal) {
        if (!goal) return null;
        const v = parseFloat(String(val).replace(',', '.'));
        if (isNaN(v)) return null;
        const target = parseFloat(goal.target);
        if (isNaN(target)) return null;
        const range = computeRangeLocal(goal);
        const dir = goal.direction;
        const tolNone = !goal.toleranceType || goal.toleranceType === 'none';
        if (tolNone) {
            if (dir === 'max') return v <= target ? null : 'over';
            if (dir === 'min') return v >= target ? null : 'over';
            return v === target ? null : 'over';
        }
        if (dir === 'max') {
            if (v <= target) return null;
            if (range.max !== null && v <= range.max) return 'tol';
            return 'over';
        }
        if (dir === 'min') {
            if (v >= target) return null;
            if (range.min !== null && v >= range.min) return 'tol';
            return 'over';
        }
        // bilaterale
        const min = range.min;
        const max = range.max;
        let inside = true;
        if (min !== null && v < min) inside = false;
        if (max !== null && v > max) inside = false;
        return inside ? 'tol' : 'over';
    }
    function cellClassAndTitle(rawVal, goal) {
        const status = evalGoalStatus(rawVal, goal);
        if (!status) return { cls: '', title: goal ? `Target ${goal.target}` : '' };
        const range = computeRangeLocal(goal);
        const fmt = n => n === null || n === undefined ? '∞' : String(Math.round(n));
        let rangeLbl = '';
        if (goal.direction === 'max') rangeLbl = `≤ ${fmt(range.max)} (target ${goal.target})`;
        else if (goal.direction === 'min') rangeLbl = `≥ ${fmt(range.min)} (target ${goal.target})`;
        else rangeLbl = `${fmt(range.min)} – ${fmt(range.max)} (target ${goal.target})`;
        if (status === 'tol') return { cls: 'db-pivot-tol', title: `In tolleranza — ${rangeLbl}` };
        return { cls: 'db-pivot-over', title: `Oltre tolleranza — ${rangeLbl} — valore ${rawVal}` };
    }

    async function renderDatabasePivot() {
        const container = document.getElementById('db-pivot-container');
        const card = document.getElementById('db-pivot-card');
        if (!container || !card || !window.appDb || !window.appState) return;
        const activeYear = window.appState.activeYear;
        const perfRecords = await appDb.getAll('performance', 'year', activeYear);
        const salesRecords = await appDb.getAll('sales', 'year', activeYear);
        const statiRecords = await appDb.getAll('stati', 'year', activeYear);
        const goals = await appDb.getAll('goals', 'year', activeYear);

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
                if (searchTerm) {
                    rows = rows.filter(rw => {
                        const mLabel = MONTH_NAMES[parseInt(rw.date.split('-')[1],10)-1] || rw.date;
                        const vals = metrics.map(m => formatVal(rw.data[m]));
                        const metricNames = metrics.join(' ').toLowerCase();
                        return rowMatchesSearch(rw.employee, mLabel, vals) || metricNames.includes(searchTerm) || skill.toLowerCase().includes(searchTerm);
                    });
                }
                // Ordinamento A-Z / Z-A cliccando sull'header
                const pivotSort = ensurePivotSort();
                const isPivotMetric = pivotSort.col && metrics.includes(pivotSort.col);
                if (pivotSort.col === 'employee' || pivotSort.col === 'month' || isPivotMetric) {
                    const dir = pivotSort.dir === 'desc' ? -1 : 1;
                    rows.sort((a,b) => {
                        if (pivotSort.col === 'employee') {
                            const na = (window.getDisplayName ? window.getDisplayName(a.employee) : a.employee).toLowerCase();
                            const nb = (window.getDisplayName ? window.getDisplayName(b.employee) : b.employee).toLowerCase();
                            return na.localeCompare(nb,'it')*dir;
                        }
                        if (pivotSort.col === 'month') {
                            const ma = a.date ? parseInt(a.date.split('-')[1],10) : 0;
                            const mb = b.date ? parseInt(b.date.split('-')[1],10) : 0;
                            if (ma !== mb) return (ma - mb)*dir;
                            return (a.date||'').localeCompare(b.date||'')*dir;
                        }
                        const av = a.data[pivotSort.col];
                        const bv = b.data[pivotSort.col];
                        const na = parseFloat(String(av).replace(',','.'));
                        const nb = parseFloat(String(bv).replace(',','.'));
                        if (!isNaN(na) && !isNaN(nb)) return (na - nb)*dir;
                        return String(av||'').localeCompare(String(bv||''),'it')*dir;
                    });
                } else {
                    rows.sort((a,b) => {
                        const na = (window.getDisplayName ? window.getDisplayName(a.employee) : a.employee).toLowerCase();
                        const nb = (window.getDisplayName ? window.getDisplayName(b.employee) : b.employee).toLowerCase();
                        if (na !== nb) return na.localeCompare(nb,'it');
                        return (a.date||'').localeCompare(b.date||'');
                    });
                }
                if (rows.length > 0 || !searchTerm) {
                    const section = document.createElement('div');
                    const pSort = ensurePivotSort();
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
                                <thead><tr><th data-col="employee" class="db-pivot-sortable ${pSort.col==='employee'?'db-pivot-sorted':''}" title="Ordina per collaboratore">Collaboratore${sortIconFor('employee',pSort)}</th><th data-col="month" class="db-pivot-sortable ${pSort.col==='month'?'db-pivot-sorted':''}" title="Ordina per mese">Mese${sortIconFor('month',pSort)}</th>${metrics.map(m => `<th data-col="${escapeHtml(m)}" class="db-pivot-sortable ${pSort.col===m?'db-pivot-sorted':''}" title="Ordina per ${escapeHtml(m)}">${escapeHtml(m)}${sortIconFor(m,pSort)}</th>`).join('')}</tr></thead>
                                <tbody>${rows.map(rw => {
                                    const disp = window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee;
                                    const mLbl = monthLabel(rw.date);
                                    return `<tr><td title="${escapeHtml(disp)}">${escapeHtml(disp)}</td><td>${escapeHtml(mLbl)}</td>${metrics.map(m => {
                                        const raw = rw.data[m];
                                        const metricFull = `Performance: ${m}`;
                                        const goal = findGoalForCell(goals, metricFull, rw.employee, skill);
                                        const st = cellClassAndTitle(raw, goal);
                                        const clsAttr = st.cls ? ` class="${st.cls}"` : '';
                                        const titleAttr = st.title ? ` title="${escapeHtml(st.title)}"` : ` title="${escapeHtml(m)}"`;
                                        return `<td${clsAttr}${titleAttr}>${escapeHtml(formatVal(raw))}</td>`;
                                    }).join('')}</tr>`;
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
            if (searchTerm) {
                rows = rows.filter(rw => {
                    const disp = (window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee).toLowerCase();
                    const mIdx = parseInt(rw.ym.split('-')[1],10);
                    const mName = (mIdx>=1&&mIdx<=12) ? MONTH_NAMES[mIdx-1].toLowerCase() : rw.ym.toLowerCase();
                    if (disp.includes(searchTerm) || rw.employee.toLowerCase().includes(searchTerm) || mName.includes(searchTerm) || 'sales'.includes(searchTerm) || 'vendite'.includes(searchTerm)) return true;
                    for (const pc of prodCols) {
                        if (pc.toLowerCase().includes(searchTerm)) return true;
                        if (String(rw.counts[pc]||0).includes(searchTerm)) return true;
                    }
                    return false;
                });
            }
            // Ordinamento
            const sSort = ensurePivotSort();
            const isSalesCol = sSort.col && (prodCols.includes(sSort.col) || sSort.col==='total' || sSort.col==='employee' || sSort.col==='month');
            if (isSalesCol) {
                const dir = sSort.dir === 'desc' ? -1 : 1;
                rows.sort((a,b) => {
                    if (sSort.col==='employee') {
                        const na=(window.getDisplayName?window.getDisplayName(a.employee):a.employee).toLowerCase();
                        const nb=(window.getDisplayName?window.getDisplayName(b.employee):b.employee).toLowerCase();
                        return na.localeCompare(nb,'it')*dir;
                    }
                    if (sSort.col==='month') {
                        const ma = a.ym ? parseInt(a.ym.split('-')[1],10) : 0;
                        const mb = b.ym ? parseInt(b.ym.split('-')[1],10) : 0;
                        if (ma!==mb) return (ma-mb)*dir;
                        return (a.ym||'').localeCompare(b.ym||'')*dir;
                    }
                    if (sSort.col==='total') {
                        const av = prodCols.reduce((s,pc)=>s+(a.counts[pc]||0),0);
                        const bv = prodCols.reduce((s,pc)=>s+(b.counts[pc]||0),0);
                        return (av-bv)*dir;
                    }
                    const av = a.counts[sSort.col]||0;
                    const bv = b.counts[sSort.col]||0;
                    return (av-bv)*dir;
                });
            } else {
                rows.sort((a,b) => {
                    const na = (window.getDisplayName ? window.getDisplayName(a.employee) : a.employee).toLowerCase();
                    const nb = (window.getDisplayName ? window.getDisplayName(b.employee) : b.employee).toLowerCase();
                    if (na !== nb) return na.localeCompare(nb,'it');
                    return (a.ym||'').localeCompare(b.ym||'');
                });
            }
            const hasAOIT = prodCols.includes('AOIT');
            const section = document.createElement('div');
            const pSortS = ensurePivotSort();
            section.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
                    <div class="db-pivot-section-title">
                        <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                        <span>Vendite</span>
                        <span class="db-pivot-badge">${rows.length} righe · ${prodCols.length} prodotti</span>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${salesRecords.length} vendite totali</span>
                </div>
                ${rows.length === 0 ? `<div class="db-pivot-empty" style="padding:18px;">Nessuna riga corrisponde alla ricerca.</div>` : `
                <div class="db-pivot-scroll">
                    <table class="db-pivot-table">
                        <thead><tr><th data-col="employee" class="db-pivot-sortable ${pSortS.col==='employee'?'db-pivot-sorted':''}" title="Ordina per collaboratore">Collaboratore${sortIconFor('employee',pSortS)}</th><th data-col="month" class="db-pivot-sortable ${pSortS.col==='month'?'db-pivot-sorted':''}" title="Ordina per mese">Mese${sortIconFor('month',pSortS)}</th>${prodCols.map(p => `<th data-col="${escapeHtml(p)}" class="db-pivot-sortable ${pSortS.col===p?'db-pivot-sorted':''}" title="Ordina per ${escapeHtml(p)}">${escapeHtml(p)}${sortIconFor(p,pSortS)}</th>`).join('')}<th data-col="total" class="db-pivot-sortable ${pSortS.col==='total'?'db-pivot-sorted':''}" style="background:var(--bg-base); font-weight:800;" title="Ordina per totale">Totale${sortIconFor('total',pSortS)}</th></tr></thead>
                        <tbody>${rows.map(rw => {
                            const disp = window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee;
                            const ym = rw.ym;
                            const m = ym.includes('-') ? MONTH_SHORT[parseInt(ym.split('-')[1],10)-1] || ym : ym;
                            const total = prodCols.reduce((s,pc)=> s + (rw.counts[pc]||0), 0);
                            return `<tr><td title="${escapeHtml(disp)}">${escapeHtml(disp)}</td><td>${escapeHtml(m)}</td>${prodCols.map(pc => {
                                const c = rw.counts[pc] || 0;
                                if (c===0) return `<td style="color:var(--text-muted);">-</td>`;
                                // colora se esiste obiettivo Sales per questo prodotto/collaboratore
                                const metricFull = `Sales: ${pc}`;
                                const goal = findGoalForCell(goals, metricFull, rw.employee, 'Sales');
                                const st = c===0 ? {cls:'', title:''} : cellClassAndTitle(c, goal);
                                const clsAttr = st.cls ? ` class="${st.cls}"` : '';
                                const titleBase = pc==='AOIT' && rw.sums[pc] ? `CHF ${formatVal(rw.sums[pc])}` : pc;
                                const titleAttr = st.title ? ` title="${escapeHtml(st.title)} — ${escapeHtml(titleBase)}"` : ` title="${escapeHtml(titleBase)}"`;
                                if (pc==='AOIT' && rw.sums[pc] && !st.cls) return `<td${titleAttr}>${c}</td>`;
                                return `<td${clsAttr}${titleAttr}>${c}</td>`;
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
                if (searchTerm) {
                    rows = rows.filter(rw => {
                        const mLabel = MONTH_NAMES[parseInt(rw.date.split('-')[1],10)-1] || rw.date;
                        const vals = metrics.map(m => formatVal(rw.data[m]));
                        const metricNames = metrics.join(' ').toLowerCase();
                        return rowMatchesSearch(rw.employee, mLabel, vals) || metricNames.includes(searchTerm) || 'stati'.includes(searchTerm);
                    });
                }
                // Ordinamento
                const stSort = ensurePivotSort();
                const isStMetric = stSort.col && metrics.includes(stSort.col);
                if (stSort.col==='employee' || stSort.col==='month' || isStMetric) {
                    const dir = stSort.dir === 'desc' ? -1 : 1;
                    rows.sort((a,b) => {
                        if (stSort.col==='employee') {
                            const na=(window.getDisplayName?window.getDisplayName(a.employee):a.employee).toLowerCase();
                            const nb=(window.getDisplayName?window.getDisplayName(b.employee):b.employee).toLowerCase();
                            return na.localeCompare(nb,'it')*dir;
                        }
                        if (stSort.col==='month') {
                            const ma = a.date ? parseInt(a.date.split('-')[1],10) : 0;
                            const mb = b.date ? parseInt(b.date.split('-')[1],10) : 0;
                            if (ma!==mb) return (ma-mb)*dir;
                            return (a.date||'').localeCompare(b.date||'')*dir;
                        }
                        const av = a.data[stSort.col];
                        const bv = b.data[stSort.col];
                        const na = parseFloat(String(av).replace(',','.'));
                        const nb = parseFloat(String(bv).replace(',','.'));
                        if (!isNaN(na) && !isNaN(nb)) return (na-nb)*dir;
                        return String(av||'').localeCompare(String(bv||''),'it')*dir;
                    });
                } else {
                    rows.sort((a,b) => {
                        const na = (window.getDisplayName ? window.getDisplayName(a.employee) : a.employee).toLowerCase();
                        const nb = (window.getDisplayName ? window.getDisplayName(b.employee) : b.employee).toLowerCase();
                        if (na !== nb) return na.localeCompare(nb,'it');
                        return (a.date||'').localeCompare(b.date||'');
                    });
                }
                const section = document.createElement('div');
                const pSortSt = ensurePivotSort();
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
                            <thead><tr><th data-col="employee" class="db-pivot-sortable ${pSortSt.col==='employee'?'db-pivot-sorted':''}" title="Ordina per collaboratore">Collaboratore${sortIconFor('employee',pSortSt)}</th><th data-col="month" class="db-pivot-sortable ${pSortSt.col==='month'?'db-pivot-sorted':''}" title="Ordina per mese">Mese${sortIconFor('month',pSortSt)}</th>${metrics.map(m => `<th data-col="${escapeHtml(m)}" class="db-pivot-sortable ${pSortSt.col===m?'db-pivot-sorted':''}" title="Ordina per ${escapeHtml(m.replace(/^State Rcode - /,'').replace(/^State Duration /,''))}">${escapeHtml(m.replace(/^State Rcode - /,'').replace(/^State Duration /,''))}${sortIconFor(m,pSortSt)}</th>`).join('')}</tr></thead>
                            <tbody>${rows.map(rw => {
                                const disp = window.getDisplayName ? window.getDisplayName(rw.employee) : rw.employee;
                                const mLbl = monthLabel(rw.date);
                                return `<tr><td title="${escapeHtml(disp)}">${escapeHtml(disp)}</td><td>${escapeHtml(mLbl)}</td>${metrics.map(m => {
                                    const raw = rw.data[m];
                                    const metricFull = `Stati: ${m}`;
                                    const metricFull2 = `Stati: State Rcode - ${m}`;
                                    let goal = findGoalForCell(goals, metricFull, rw.employee, 'Stati');
                                    if (!goal) goal = findGoalForCell(goals, metricFull2, rw.employee, 'Stati');
                                    const st = cellClassAndTitle(raw, goal);
                                    const clsAttr = st.cls ? ` class="${st.cls}"` : '';
                                    const titleAttr = st.title ? ` title="${escapeHtml(st.title)}"` : ` title="${escapeHtml(m)}"`;
                                    return `<td${clsAttr}${titleAttr}>${escapeHtml(formatVal(raw))}</td>`;
                                }).join('')}</tr>`;
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
            bindPivotSortHandlers(container);
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
