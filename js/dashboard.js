// js/dashboard.js

// Contatori "Mostra altro" (barre obiettivi e righe tolleranze)
let goalsShownCount = 4;
let tolShownCount = 5;

// Inizializza un gruppo di pulsanti periodo (stato salvato in localStorage).
function initPeriodGroup(groupId, storageKey) {
    const group = document.getElementById(groupId);
    if (!group) return;

    const saved = localStorage.getItem(storageKey);
    const savedBtn = saved ? group.querySelector(`.period-btn[data-period="${saved}"]`) : null;
    if (savedBtn) {
        group.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        savedBtn.classList.add('active');
    }

    group.addEventListener('click', (e) => {
        const btn = e.target.closest('.period-btn');
        if (!btn) return;
        group.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem(storageKey, btn.dataset.period);
        if (window.renderDashboard) window.renderDashboard();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('dash-tolerance-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (window.renderDashboard) window.renderDashboard();
        });
    }

    const skillFilter = document.getElementById('dash-tolerance-filter-skill');
    if (skillFilter) {
        skillFilter.addEventListener('change', () => {
            if (window.renderDashboard) window.renderDashboard();
        });
    }

    const goalsSearch = document.getElementById('dash-goals-search');
    if (goalsSearch) {
        goalsSearch.addEventListener('input', () => {
            if (window.renderDashboard) window.renderDashboard();
        });
    }

    initPeriodGroup('dash-goals-period', 'taDashGoalsPeriod');
    initPeriodGroup('dash-tolerance-period', 'taDashTolerancePeriod');
});

// Helper function to extract numeric value for employee & metric
// dateRange = { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } (opzionale, filtra per data)
// weightMetric (opzionale): per le metriche Performance, se valorizzato il risultato e'
// la media ponderata dei record usando quella metrica come peso (es. "Voice Inbound (#)").
function calculateEmployeeMetricValue(employee, metricStr, skillFilter, perfData, salesData, dateRange, weightMetric) {
    let isSales = metricStr.startsWith('Sales: ');
    let metricName = metricStr.replace('Performance: ', '').replace('Sales: ', '');

    function inRange(record) {
        if (!dateRange) return true;
        const d = record.date;
        if (!d) return true;
        return d >= dateRange.start && d <= dateRange.end;
    }

    if (isSales) {
        let records = salesData.filter(d => d.employee === employee && d.data && d.data[metricName] !== undefined && inRange(d));
        if (records.length === 0) return 0;
        return records.reduce((sum, r) => sum + (parseFloat(r.data[metricName]) || 0), 0);
    } else {
        let records = perfData.filter(d => d.employee === employee && d.data && d.data[metricName] !== undefined && inRange(d));
        if (skillFilter && skillFilter !== 'ALL') {
            records = records.filter(d => d.skill === skillFilter);
        }
        if (records.length === 0) return 0;

        // Media ponderata: il peso (es. numero chiamate) viene preso dallo stesso record mensile
        if (weightMetric) {
            const weightName = String(weightMetric).replace('Performance: ', '').trim();
            let sumW = 0;
            let sumWt = 0;
            records.forEach(r => {
                const w = parseFloat(r.data[weightName]) || 0;
                if (w > 0) {
                    sumW += (parseFloat(r.data[metricName]) || 0) * w;
                    sumWt += w;
                }
            });
            return sumWt > 0 ? sumW / sumWt : 0;
        }

        const sum = records.reduce((acc, r) => acc + (parseFloat(r.data[metricName]) || 0), 0);
        return sum / records.length;
    }
}

// Helper to calculate team aggregate value for a metric (opzionale dateRange)
// weightMetric (opzionale): per le metriche Performance usa il pool globale del team
// (somma secondi / somma peso) invece della media dei valori per-collaboratore.
function calculateTeamMetricValue(metricStr, skillFilter, perfData, salesData, activeEmployees, dateRange, weightMetric) {
    if (activeEmployees.length === 0) return 0;

    const isSales = metricStr.startsWith('Sales: ');
    if (!isSales && weightMetric) {
        const metricName = metricStr.replace('Performance: ', '').replace('Sales: ', '');
        const weightName = String(weightMetric).replace('Performance: ', '').trim();
        const inRange = (record) => {
            if (!dateRange) return true;
            const d = record.date;
            if (!d) return true;
            return d >= dateRange.start && d <= dateRange.end;
        };
        let sumW = 0;
        let sumWt = 0;
        (perfData || []).forEach(r => {
            if (!r.data || r.data[metricName] === undefined) return;
            if (!inRange(r)) return;
            if (skillFilter && skillFilter !== 'ALL' && r.skill !== skillFilter) return;
            const w = parseFloat(r.data[weightName]) || 0;
            if (w > 0) {
                sumW += (parseFloat(r.data[metricName]) || 0) * w;
                sumWt += w;
            }
        });
        return sumWt > 0 ? sumW / sumWt : 0;
    }

    const values = activeEmployees.map(emp => calculateEmployeeMetricValue(emp, metricStr, skillFilter, perfData, salesData, dateRange, weightMetric));
    if (isSales) {
        return values.reduce((a, b) => a + b, 0);
    } else {
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / activeEmployees.length;
    }
}

// Calcola l'intervallo di date (YYYY-MM-DD) in base al periodo scelto.
// 'current' = mese corrente; 'last' = mese scorso; '3'/'6' = ultimi N mesi; 'year' = da Gennaio a oggi.
function getGoalPeriodRange(period, year) {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Data di fine: oggi (o fine anno se si lavora su un anno diverso da quello corrente)
    let end = new Date();
    if (year && Number(year) !== currentYear) {
        end = new Date(Number(year), 11, 31); // 31 dicembre dell'anno attivo
    }

    function fmt(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }

    let start;
    if (period === 'year') {
        start = new Date(Number(year) || currentYear, 0, 1); // 1 gennaio
    } else if (period === 'current') {
        // Mese corrente: dal primo giorno del mese di 'end' fino a 'end'
        start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (period === 'last') {
        // Mese scorso: dal primo all'ultimo giorno del mese precedente
        start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
        end = new Date(end.getFullYear(), end.getMonth(), 0);
    } else {
        let monthsBack;
        if (period === '3') monthsBack = 3;
        else if (period === '6') monthsBack = 6;
        else monthsBack = 2; // fallback: mese scorso + corrente
        // Primo giorno del mese, (monthsBack-1) mesi indietro
        start = new Date(end.getFullYear(), end.getMonth() - (monthsBack - 1), 1);
    }

    return { start: fmt(start), end: fmt(end) };
}

// Etichetta leggibile del periodo selezionato (es. "ultimi 3 mesi").
function getGoalPeriodLabel(period) {
    if (period === 'year') return 'Da Gennaio a oggi';
    if (period === '3') return 'Ultimi 3 mesi';
    if (period === '6') return 'Ultimi 6 mesi';
    if (period === 'last') return 'Mese scorso';
    return 'Mese corrente';
}

// Costruisce una barra progressiva con zone colorate fisse (1/3 rosso, 1/3 giallo,
// 1/3 verde) e indicatore bianco posizionato secondo le soglie reali dell'obiettivo
// (target + tolleranze), in modo che la linea cada nella zona giusta:
// - direzione 'min' (>=): minTol -> inizio zona gialla, target -> inizio zona verde
// - direzione 'max' (<=): target -> inizio zona verde, maxTol -> inizio zona gialla
function buildGoalBarHTML(value, target, range, direction) {
    const minTol = (range && range.min !== undefined && range.min !== null) ? range.min : null;
    const maxTol = (range && range.max !== undefined && range.max !== null) ? range.max : null;

    // Scala massima visualizzata: copre valore, obiettivo e limiti di tolleranza
    const displayMax = Math.max(
        value || 0,
        target || 0,
        minTol || 0,
        maxTol || 0,
        1
    );
    if (displayMax <= 0) return '';

    const zones = `
        <div style="position:absolute; left:0; width:33.33%; top:0; bottom:0; background:#ef4444;"></div>
        <div style="position:absolute; left:33.33%; width:33.34%; top:0; bottom:0; background:#f59e0b;"></div>
        <div style="position:absolute; left:66.67%; width:33.33%; top:0; bottom:0; background:#10b981;"></div>
    `;

    const clamp = v => Math.max(0, Math.min(100, v));
    const isMaxDir = direction === 'max';

    function positionForValue(v) {
        const vNum = Number(v) || 0;

        if (isMaxDir) {
            // Verde a destra: basso valore = ok. low=target -> 66.67, high=maxTol -> 33.33
            const low = target;
            const high = (maxTol !== null && maxTol !== undefined) ? maxTol : target;
            if (low === high) {
                if (vNum <= low) return clamp(66.67 + (1 - vNum / Math.max(low, 1)) * 33.33);
                return clamp(66.67 - ((vNum - low) / Math.max(displayMax - low, 1)) * 66.67);
            }
            if (vNum <= low) return clamp(66.67 + (1 - vNum / Math.max(low, 1)) * 33.33);
            if (vNum <= high) return clamp(66.67 - ((vNum - low) / (high - low)) * 33.33);
            return clamp(33.33 - ((vNum - high) / Math.max(displayMax - high, 1)) * 33.33);
        }

        // Direzioni 'min' / bilaterali: basso valore = non ok. low=minTol -> 33.33, high=target -> 66.67
        const low = (minTol !== null && minTol !== undefined) ? minTol : target;
        const high = target;
        if (low === high || high <= low) {
            if (vNum < low) return clamp((vNum / Math.max(low, 1)) * 33.33);
            return clamp(33.33 + ((vNum - low) / Math.max(displayMax - low, 1)) * 66.67);
        }
        if (vNum <= low) return clamp((vNum / Math.max(low, 1)) * 33.33);
        if (vNum <= high) return clamp(33.33 + ((vNum - low) / (high - low)) * 33.33);
        return clamp(66.67 + ((vNum - high) / Math.max(displayMax - high, 1)) * 33.33);
    }

    const valuePct = positionForValue(value);

    return `
        <div style="position:relative; height:18px;">
            <div style="position:absolute; left:0; right:0; top:0; bottom:0; border-radius:9px; overflow:hidden; background:var(--bg-base); border:1px solid var(--border);">
                ${zones}
            </div>
            <div style="position:absolute; left:${valuePct}%; top:-5px; bottom:-5px; width:5px; background:#fff; border-radius:2px; box-shadow:0 0 4px rgba(0,0,0,0.6); transform:translateX(-2.5px);"></div>
        </div>
    `;
}

window.renderDashboard = async function() {
    const year = window.appState.activeYear;
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);

    // Get all unique active collaborators
    const activeEmployeesSet = new Set();
    perfData.forEach(d => { if (d.employee) activeEmployeesSet.add(d.employee); });
    salesData.forEach(d => { if (d.employee) activeEmployeesSet.add(d.employee); });
    const activeEmployees = Array.from(activeEmployeesSet).sort();

    renderCollaboratorsSummary(activeEmployees, perfData, salesData);
    await renderTeamSalesGoals(perfData, salesData);
    renderTeamGoalsProgress(goals, perfData, salesData, activeEmployees);
    await renderToleranceViolations(goals, perfData, salesData, activeEmployees);
};

// 1. Collaborators Summary & Breakdown by Skill
async function renderCollaboratorsSummary(activeEmployees, perfData, salesData) {
    const summaryContainer = document.getElementById('dashboard-collab-summary');
    if (!summaryContainer) return;

    // Get skills list
    const configuredSkills = await appDb.getSetting('skills', []);
    const skillCounts = {};
    configuredSkills.forEach(s => skillCounts[s] = new Set());

    perfData.forEach(d => {
        if (d.skill && d.employee) {
            if (!skillCounts[d.skill]) skillCounts[d.skill] = new Set();
            skillCounts[d.skill].add(d.employee);
        }
    });

    let salesEmpCount = new Set();
    salesData.forEach(d => { if (d.employee) salesEmpCount.add(d.employee); });

    let skillBadgesHtml = '';
    for (const [skillName, empSet] of Object.entries(skillCounts)) {
        skillBadgesHtml += `
            <div style="padding:10px 14px; border-radius:8px; background:var(--bg-base); border:1px solid var(--border); min-width:140px;">
                <span style="display:block; font-size:0.75rem; color:var(--text-muted); font-weight:500;">${skillName}</span>
                <strong style="font-size:1.2rem; color:var(--text-main);">${empSet.size}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">collab.</span>
            </div>
        `;
    }

    if (salesEmpCount.size > 0) {
        skillBadgesHtml += `
            <div style="padding:10px 14px; border-radius:8px; background:var(--bg-base); border:1px solid var(--border); min-width:140px;">
                <span style="display:block; font-size:0.75rem; color:var(--text-muted); font-weight:500;">Sales</span>
                <strong style="font-size:1.2rem; color:var(--text-main);">${salesEmpCount.size}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">collab.</span>
            </div>
        `;
    }

    summaryContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px;">
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:48px; height:48px; border-radius:12px; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center;">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="8" r="3.2" fill="currentColor" stroke="none" opacity="0.55"></circle>
                        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" fill="currentColor" stroke="none" opacity="0.55"></path>
                        <circle cx="16.5" cy="9.5" r="2.4"></circle>
                        <path d="M14.5 19c0-2.4 1.6-4 4-4s4 1.6 4 4"></path>
                    </svg>
                </div>
                <div>
                    <h3 style="margin:0; font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Collaboratori Totali</h3>
                    <div style="font-size:2rem; font-weight:700; color:var(--text-main); line-height:1.1;">${activeEmployees.length}</div>
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; flex:1; justify-content:flex-end;">
                ${skillBadgesHtml}
            </div>
        </div>
    `;
}

// Helper: nome metrica senza prefisso 'Performance: '/'Sales: '
function displayMetricName(metricStr) {
    return String(metricStr || '').replace('Performance: ', '').replace('Sales: ', '');
}

// 1b. Raggiungimento Obiettivi Sales per tutto il team (stile "Obiettivi di Vendita"
// dei singoli collaboratori, ma con target totale di team per ogni skill).
async function renderTeamSalesGoals(perfData, salesData) {
    const container = document.getElementById('dashboard-sales-goals-container');
    if (!container) return;

    const year = window.appState.activeYear;
    const salesTablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
    if (!salesTablesList || salesTablesList.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); padding:12px 0;">Nessun obiettivo Sales impostato per l\'anno attivo.</p>';
        return;
    }

    // Ultimo mese presente nei dati (per la card mensile)
    let allDates = [];
    salesData.forEach(d => { if (d.date) allDates.push(d.date); });
    perfData.forEach(d => { if (d.date) allDates.push(d.date); });

    let latestMonthStr = '';
    let latestMonthName = 'Corrente';
    let latestMonthIdx = 0;
    if (allDates.length > 0) {
        allDates.sort();
        const lastDate = allDates[allDates.length - 1];
        const parts = lastDate.split('-');
        if (parts.length >= 2) {
            latestMonthStr = `${parts[0]}-${parts[1]}`;
            const monthIdx = parseInt(parts[1], 10) - 1;
            const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
            if (monthIdx >= 0 && monthIdx < 12) latestMonthName = mesi[monthIdx];
            latestMonthIdx = monthIdx;
        }
    }

    let html = '';

    for (const table of salesTablesList) {
        const products = await appDb.getSetting(`sales_table_products_${table.id}`, []);
        const savedTargets = (await appDb.getSetting(`sales_table_targets_${year}_${table.id}`, {})) || {};

        let cardsHtml = '';
        let hasCards = false;
        let cardCount = 0;

        (products || []).forEach((product, idx) => {
            const label = product.label || product.key || 'Obiettivo';
            const isCHF = !!product.isCHF;
            const color = ['#3b82f6', '#059669', '#d97706', '#8b5cf6', '#ec4899'][idx % 5];

            const mappedMetrics = Array.isArray(product.mappedMetrics)
                ? product.mappedMetrics
                : (product.mappedMetric ? product.mappedMetric.split(',').map(s => s.trim()).filter(Boolean) : []);

            // Obiettivo totale di team: TEAM_ per modalità team, INDIV_TOTAL_ per la somma individuale
            const annualTarget = product.mode === 'team'
                ? Number(savedTargets['TEAM_' + product.key] || 0)
                : Number(savedTargets['INDIV_TOTAL_' + product.key] || 0);
            if (annualTarget <= 0 && (!mappedMetrics || mappedMetrics.length === 0)) return;

            cardCount++;

            const metricsToUse = mappedMetrics.length > 0 ? mappedMetrics : [label];

            // Valori realizzati per tutto il team (senza filtro collaboratore)
            const annualAchieved = calcActualForMetric(metricsToUse, perfData, salesData, null, isCHF);
            const monthlySalesData = latestMonthStr ? salesData.filter(r => r.date && r.date.startsWith(latestMonthStr)) : [];
            const monthlyPerfData = latestMonthStr ? perfData.filter(r => r.date && r.date.startsWith(latestMonthStr)) : [];
            const monthlyAchieved = calcActualForMetric(metricsToUse, monthlyPerfData, monthlySalesData, null, isCHF);

            // Target mensile: resta dell'anno diviso per i mesi rimanenti (incluso quello corrente)
            const remainingMonths = Math.max(1, 12 - latestMonthIdx);
            const remainingTarget = Math.max(0, annualTarget - annualAchieved);
            const monthlyTarget = annualTarget > 0 ? Math.round(remainingTarget / remainingMonths) : 0;

            const formatVal = (v) => {
                if (isCHF) return 'CHF ' + Math.round(v).toLocaleString('de-CH');
                return Math.round(v).toString();
            };

            const monthPct = monthlyTarget > 0 ? Math.round((monthlyAchieved / monthlyTarget) * 100) : 0;
            const annualPct = annualTarget > 0 ? Math.round((annualAchieved / annualTarget) * 100) : 0;
            const monthPctClamped = Math.min(Math.max(monthPct, 0), 100);
            const annualPctClamped = Math.min(Math.max(annualPct, 0), 100);

            cardsHtml += `
                <div class="goal-mini-card" style="justify-content:space-between;">
                    <div>
                        <div style="font-weight: 700; font-size: 13px; color: ${color}; margin-bottom: 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            <span>${label}</span>
                        </div>

                        <div class="goal-info-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px; gap:6px;">
                            <span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">Mensile ${latestMonthName}</span>
                            <span style="color:var(--text-muted); font-size:11px; font-weight:600; white-space:nowrap;">${formatVal(monthlyAchieved)} / ${formatVal(monthlyTarget)}</span>
                        </div>
                        <div class="goal-progress-track" style="height:16px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:8px; position:relative;">
                            <div class="goal-progress-fill" style="width:${monthPctClamped}%; height:100%; background:${color}; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:700; transition: width 0.3s ease;">
                                ${monthPct > 12 ? monthPct + '%' : ''}
                            </div>
                        </div>

                        <div class="goal-info-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px; gap:6px;">
                            <span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">Annuale</span>
                            <span style="color:var(--text-muted); font-size:11px; font-weight:600; white-space:nowrap;">${formatVal(annualAchieved)} / ${formatVal(annualTarget)}</span>
                        </div>
                        <div class="goal-progress-track" style="height:16px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; overflow:hidden; position:relative;">
                            <div class="goal-progress-fill" style="width:${annualPctClamped}%; height:100%; background:${color}; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:700; transition: width 0.3s ease;">
                                ${annualPct > 12 ? annualPct + '%' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            hasCards = true;
        });

        if (!hasCards) continue;

        const skillLabel = table.name || table.skill || 'Tutte le Skill';
        const gridMaxWidth = cardCount === 1 ? ' max-width:420px;' : '';
        html += `
            <div style="margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--primary); flex-shrink:0;"></span>
                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em;">${skillLabel}</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px;${gridMaxWidth}">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    if (!html) {
        container.innerHTML = '<p style="color:var(--text-muted); padding:12px 0;">Nessun obiettivo Sales impostato per l\'anno attivo.</p>';
        return;
    }

    container.innerHTML = html;
}

// Chiave stabile di un obiettivo per i pin (id se presente, altrimenti composita)
function goalPinKey(g) {
    return g.id ? `id:${g.id}` : `m:${g.metric}|s:${g.skill || 'ALL'}|e:${g.employee || 'TEAM'}`;
}

function loadPinnedGoals(year) {
    try {
        const raw = localStorage.getItem(`pinnedTeamGoals_${year}`);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function togglePinnedGoal(year, key) {
    let keys = loadPinnedGoals(year);
    const idx = keys.indexOf(key);
    if (idx !== -1) {
        keys.splice(idx, 1);
    } else if (keys.length < 4) {
        keys.push(key);
    }
    localStorage.setItem(`pinnedTeamGoals_${year}`, JSON.stringify(keys.slice(0, 4)));
}

// 2. Team Goals & Progressive Bars
function renderTeamGoalsProgress(goals, perfData, salesData, activeEmployees) {
    const goalsContainer = document.getElementById('dashboard-team-goals-container');
    if (!goalsContainer) return;

    const periodGroup = document.getElementById('dash-goals-period');
    const periodBtn = periodGroup ? periodGroup.querySelector('.period-btn.active') : null;
    const period = periodBtn ? periodBtn.dataset.period : '3';

    const goalsSearchInput = document.getElementById('dash-goals-search');
    const searchQuery = goalsSearchInput ? goalsSearchInput.value.toLowerCase().trim() : '';

    const teamGoals = goals.filter(g => {
        if (g.employee && g.employee !== '') return false;
        if (!searchQuery) return true;
        return displayMetricName(g.metric).toLowerCase().includes(searchQuery);
    });

    if (teamGoals.length === 0) {
        goalsContainer.innerHTML = '<p style="color:var(--text-muted); padding:12px 0;">Nessun obiettivo di team impostato per l\'anno attivo.</p>';
        return;
    }

    const year = window.appState.activeYear;
    const periodRange = getGoalPeriodRange(period, year);

    const pinnedKeys = loadPinnedGoals(year);
    const isPinned = (g) => pinnedKeys.includes(goalPinKey(g));
    const pinnedGoals = teamGoals.filter(isPinned).slice(0, 4);
    const otherGoals = teamGoals.filter(g => !isPinned(g));
    const shownGoals = pinnedGoals.concat(otherGoals.slice(0, goalsShownCount));

    let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">';

    shownGoals.forEach(g => {
        const targetVal = parseFloat(g.target) || 1;
        const range = window.computeGoalRange ? window.computeGoalRange(g) : { min: targetVal, max: targetVal };

        // Valore nel periodo selezionato
        const periodVal = calculateTeamMetricValue(g.metric, g.skill, perfData, salesData, activeEmployees, periodRange, g.weightMetric);

        const skillBadge = g.skill && g.skill !== 'ALL' ? ` | Skill: ${g.skill}` : '';

        const key = goalPinKey(g);
        const pinned = isPinned(g);
        const pinDisabled = !pinned && pinnedKeys.length >= 4;
        const pinTitle = pinned ? 'Togli dagli appuntati' : (pinDisabled ? 'Limite di 4 obiettivi appuntati raggiunto' : 'Appunta questo obiettivo');
        const pinColor = pinned ? 'var(--primary)' : (pinDisabled ? 'var(--border)' : 'var(--text-muted)');
        const pinFill = pinned ? 'var(--primary)' : 'none';

        html += `
            <div style="background:var(--bg-base); padding:14px 16px; border-radius:8px; border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px;">
                    <div style="min-width:0;">
                        <strong style="font-size:0.95rem; color:var(--text-main);">${displayMetricName(g.metric)}</strong>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${skillBadge}</span>
                    </div>
                    <button type="button" class="goal-pin-btn" data-key="${key}" title="${pinTitle}" ${pinDisabled ? 'disabled' : ''} style="background:none; border:none; cursor:${pinDisabled ? 'not-allowed' : 'pointer'}; padding:4px; display:inline-flex; align-items:center; color:${pinColor}; flex-shrink:0; opacity:${pinDisabled ? 0.35 : (pinned ? 1 : 0.65)};" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='${pinDisabled ? 0.35 : (pinned ? 1 : 0.65)}'">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="${pinFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"></path></svg>
                    </button>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">
                        <span>${getGoalPeriodLabel(period)}</span>
                        <span style="font-weight:600;">${Math.round(periodVal)} / ${Math.round(targetVal)}</span>
                    </div>
                    ${buildGoalBarHTML(periodVal, targetVal, range, g.direction)}
                </div>
            </div>
        `;
    });

    html += '</div>';

    const remaining = otherGoals.length - goalsShownCount;
    if (remaining > 0) {
        html += `
            <div style="text-align:center; margin-top:16px;">
                <button type="button" class="btn secondary" id="goals-show-more-btn">Mostra altro (${Math.min(4, remaining)})</button>
            </div>
        `;
    }

    goalsContainer.innerHTML = html;

    goalsContainer.querySelectorAll('.goal-pin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            togglePinnedGoal(year, btn.dataset.key);
            if (window.renderDashboard) window.renderDashboard();
        });
    });

    const showMoreBtn = document.getElementById('goals-show-more-btn');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            goalsShownCount += 4;
            if (window.renderDashboard) window.renderDashboard();
        });
    }
}

// 3. Tolerance Violations List ordered by Severity with Search & Filters
async function renderToleranceViolations(goals, perfData, salesData, activeEmployees) {
    const container = document.getElementById('dashboard-tolerance-container');
    const skillSelect = document.getElementById('dash-tolerance-filter-skill');
    const searchInput = document.getElementById('dash-tolerance-search');
    const dropdownEl = document.getElementById('dash-tolerance-dropdown');
    if (!container) return;

    // Populate skill select dropdown if empty or needed
    const skillsList = await appDb.getSetting('skills', []);
    if (skillSelect && skillSelect.children.length === 0) {
        let optHtml = '<option value="ALL">Tutti gli Skill</option>';
        skillsList.forEach(s => {
            optHtml += `<option value="${s}">${s}</option>`;
        });
        skillSelect.innerHTML = optHtml;
    }

    // Populate and attach searchable metrics dropdown
    const metricsSet = new Set();
    goals.forEach(g => { if (g.metric) metricsSet.add(g.metric); });
    perfData.forEach(d => {
        if (d.data) Object.keys(d.data).forEach(k => metricsSet.add(`Performance: ${k}`));
    });
    salesData.forEach(d => {
        if (d.data) Object.keys(d.data).forEach(k => { if (k !== 'Product') metricsSet.add(`Sales: ${k}`); });
    });
    const allMetrics = Array.from(metricsSet).sort();

    function displayMetric(m) {
        return m.replace('Performance: ', '').replace('Sales: ', '');
    }

    function renderMetricDropdown(filterText = '') {
        if (!dropdownEl) return;
        dropdownEl.innerHTML = '';
        const query = filterText.toLowerCase().trim();
        const filteredMetrics = allMetrics.filter(m => {
            if (m.startsWith('Sales: ')) return false;
            return !query || displayMetric(m).toLowerCase().includes(query);
        });
        
        if (filteredMetrics.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:8px 12px; color:var(--text-muted); font-size:0.85rem;';
            empty.textContent = 'Nessuna statistica trovata';
            dropdownEl.appendChild(empty);
            return;
        }

        filteredMetrics.forEach(m => {
            const item = document.createElement('div');
            item.className = 'searchable-dropdown-item' + (searchInput && searchInput.value === m ? ' selected' : '');
            item.textContent = displayMetric(m);
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (searchInput) searchInput.value = m;
                if (dropdownEl) dropdownEl.classList.remove('open');
                if (window.renderDashboard) window.renderDashboard();
            });
            dropdownEl.appendChild(item);
        });
    }

    if (searchInput && !searchInput.dataset.initialized) {
        searchInput.dataset.initialized = 'true';
        searchInput.addEventListener('focus', () => {
            renderMetricDropdown(searchInput.value);
            if (dropdownEl) dropdownEl.classList.add('open');
        });
        searchInput.addEventListener('input', (e) => {
            renderMetricDropdown(e.target.value);
            if (dropdownEl) dropdownEl.classList.add('open');
        });
        searchInput.addEventListener('blur', () => {
            if (dropdownEl) dropdownEl.classList.remove('open');
        });
    }

    const selectedSkill = skillSelect ? skillSelect.value : 'ALL';
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const periodGroup = document.getElementById('dash-tolerance-period');
    const periodBtn = periodGroup ? periodGroup.querySelector('.period-btn.active') : null;
    const period = periodBtn ? periodBtn.dataset.period : '3';
    const periodRange = getGoalPeriodRange(period, window.appState.activeYear);

    const violations = [];

    goals.forEach(g => {
        if (!g.toleranceType || g.toleranceType === 'none') return;
        const targetVal = parseFloat(g.target) || 0;
        const range = window.computeGoalRange ? window.computeGoalRange(g) : { min: targetVal, max: targetVal };
        const minVal = range.min;
        const maxVal = range.max;

        // Employees to check
        let empList = g.employee ? [g.employee] : activeEmployees;

        if (g.skill && g.skill !== 'ALL') {
            const assigned = empList.filter(emp => {
                const skills = window.appState?.collaboratorSkills?.[emp] || [];
                return Array.isArray(skills) && skills.includes(g.skill);
            });
            if (assigned.length > 0) empList = assigned;
        }

        empList.forEach(emp => {
            const actualVal = calculateEmployeeMetricValue(emp, g.metric, g.skill, perfData, salesData, periodRange, g.weightMetric);

            let isUnder = false;
            let scostamento = 0;

            if (g.direction === 'max') {
                if (maxVal === null || actualVal <= maxVal) return;
                isUnder = false;
                scostamento = actualVal - maxVal;
            } else if (g.direction === 'min') {
                if (minVal === null || actualVal >= minVal) return;
                isUnder = true;
                scostamento = minVal - actualVal;
            } else {
                if (minVal !== null && actualVal < minVal) {
                    isUnder = true;
                    scostamento = minVal - actualVal;
                } else if (maxVal !== null && actualVal > maxVal) {
                    isUnder = false;
                    scostamento = actualVal - maxVal;
                } else {
                    return;
                }
            }

            const severityRatio = targetVal !== 0 ? (scostamento / Math.abs(targetVal)) : scostamento;

            let severityClass = 'severity-low';
            let severityLabel = 'Lieve';
            if (severityRatio >= 0.25) {
                severityClass = 'severity-high';
                severityLabel = 'Critico';
            } else if (severityRatio >= 0.10) {
                severityClass = 'severity-medium';
                severityLabel = 'Alto';
            }

            const rangeLabel = (minVal === null)
                ? `≤ ${Math.round(maxVal)}`
                : (maxVal === null ? `≥ ${Math.round(minVal)}` : `${Math.round(minVal)} - ${Math.round(maxVal)}`);

            violations.push({
                employee: emp,
                displayName: window.getDisplayName(emp),
                goalMetric: g.metric,
                goalSkill: g.skill || 'ALL',
                target: targetVal,
                minVal,
                maxVal,
                rangeLabel,
                actualVal,
                scostamento,
                severityRatio,
                severityClass,
                severityLabel,
                type: isUnder ? 'Sotto la soglia' : 'Sopra la soglia'
            });
        });
    });

    // Filter by skill
    let filtered = violations;
    if (selectedSkill !== 'ALL') {
        filtered = filtered.filter(v => v.goalSkill === selectedSkill || v.goalSkill === 'ALL');
    }

    // Filter by search query (metric / statistic name)
    if (searchQuery) {
        filtered = filtered.filter(v => displayMetric(v.goalMetric).toLowerCase().includes(searchQuery));
    }

    // Sort by Severity Ratio descending (most critical first)
    filtered.sort((a, b) => b.severityRatio - a.severityRatio);

    if (filtered.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); padding:12px 0;">${violations.length === 0 ? 'Nessun collaboratore sfora le tolleranze stabilite.' : 'Nessuno sforamento trovato per la statistica selezionata.'}</p>`;
        return;
    }

    const shownViolations = filtered.slice(0, tolShownCount);

    let tableHtml = `
        <div style="overflow-x:auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th scope="col">${window.appState.isAnonymous ? 'Collab' : 'Collaboratore'}</th>
                        <th scope="col">Metrica / Skill</th>
                        <th scope="col">Target (Soglie)</th>
                        <th scope="col">Valore Reale</th>
                        <th scope="col">Scostamento</th>
                        <th scope="col" style="text-align:center;">Gravità</th>
                    </tr>
                </thead>
                <tbody>
    `;

    shownViolations.forEach(v => {
        const skillStr = v.goalSkill !== 'ALL' ? ` (${v.goalSkill})` : '';
        tableHtml += `
            <tr>
                <td><strong>${v.displayName}</strong></td>
                <td>${displayMetric(v.goalMetric)}${skillStr}</td>
                <td>${Math.round(v.target)} <span style="font-size:0.75rem; color:var(--text-muted);">(${v.rangeLabel})</span></td>
                <td style="font-weight:600;">${Math.round(v.actualVal)}</td>
                <td style="color:${v.type === 'Sotto la soglia' ? 'var(--danger)' : '#f59e0b'}; font-weight:500;">
                    ${v.type === 'Sotto la soglia' ? '-' : '+'}${Math.round(v.scostamento)}
                </td>
                <td style="text-align:center;">
                    <span class="severity-badge ${v.severityClass}">${v.severityLabel}</span>
                </td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    const remaining = filtered.length - tolShownCount;
    if (remaining > 0) {
        tableHtml += `
            <div style="text-align:center; margin-top:16px;">
                <button type="button" class="btn secondary" id="tol-show-more-btn">Mostra altro (${Math.min(5, remaining)})</button>
            </div>
        `;
    }

    container.innerHTML = tableHtml;

    const showMoreBtn = document.getElementById('tol-show-more-btn');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            tolShownCount += 5;
            if (window.renderDashboard) window.renderDashboard();
        });
    }
}
