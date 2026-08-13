// js/goals.js

let editingGoalId = null;
let activeSalesSkillFilter = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('add-goal-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openGoalModal());
    }

    const searchInput = document.getElementById('goals-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (window.renderGoals) window.renderGoals();
        });
    }

    // Gestione Tab Obiettivi (Tabella Obiettivi Vendita vs Tutti gli Obiettivi)
    const tabSalesBtn = document.getElementById('goals-tab-sales-btn');
    const tabListBtn = document.getElementById('goals-tab-list-btn');
    const containerSales = document.getElementById('goals-sales-container');
    const containerList = document.getElementById('goals-list-container');

    if (tabSalesBtn && tabListBtn) {
        tabSalesBtn.addEventListener('click', () => {
            tabSalesBtn.classList.add('active');
            tabListBtn.classList.remove('active');
            if (containerSales) containerSales.style.display = 'block';
            if (containerList) containerList.style.display = 'none';
            if (addBtn) addBtn.style.display = 'none';
            renderSalesGoalsTable();
        });

        tabListBtn.addEventListener('click', () => {
            tabListBtn.classList.add('active');
            tabSalesBtn.classList.remove('active');
            if (containerList) containerList.style.display = 'block';
            if (containerSales) containerSales.style.display = 'none';
            if (addBtn) addBtn.style.display = 'inline-flex';
            if (window.renderGoals) window.renderGoals();
        });
    }

    // Render iniziale
    renderSalesGoalsTable();
    
    window.renderGoals = async function() {
        const list = document.getElementById('goals-list');
        if (!list) return;
        
        const year = window.appState?.activeYear || new Date().getFullYear();
        const goals = await appDb.getAll('goals', 'year', year);
        
        const searchInput = document.getElementById('goals-search-input');
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        list.innerHTML = '';
        
        const filteredGoals = goals.filter(g => {
            if (!query) return true;
            const metricStr = (g.metric || '').toLowerCase();
            const skillStr = (g.skill || '').toLowerCase();
            const empStr = (g.employee ? window.getDisplayName(g.employee) : 'tutto il team').toLowerCase();
            const targetStr = String(g.target || '');
            return metricStr.includes(query) || skillStr.includes(query) || empStr.includes(query) || targetStr.includes(query);
        });

        if (filteredGoals.length === 0) {
            list.innerHTML = `<p style="color:var(--text-muted)">${goals.length === 0 ? 'Nessun obiettivo impostato.' : 'Nessun obiettivo trovato per la ricerca.'}</p>`;
            return;
        }
        
        filteredGoals.forEach(g => {
            const card = document.createElement('div');
            card.className = 'card';
            const skillText = g.skill && g.skill !== 'ALL' ? g.skill : 'Tutte le Skill';
            const empText = g.employee ? window.getDisplayName(g.employee) : 'Tutto il Team';
            
            let minVal = null;
            let maxVal = null;
            let tolLabel = '';
            
            if (g.toleranceType && g.toleranceType !== 'none') {
                const plus = parseFloat(g.tolerancePlus) || 0;
                const minus = parseFloat(g.toleranceMinus) || 0;
                if (g.toleranceType === 'numeric') {
                    minVal = g.target - minus;
                    maxVal = g.target + plus;
                    tolLabel = plus === minus ? `±${plus}` : `-${minus} / +${plus}`;
                } else {
                    minVal = Math.round(g.target * (1 - minus / 100));
                    maxVal = Math.round(g.target * (1 + plus / 100));
                    tolLabel = plus === minus ? `±${plus}%` : `-${minus}% / +${plus}%`;
                }
            }

            card.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:20px; padding:16px 20px; flex-wrap:wrap; margin-bottom:12px;';

            card.innerHTML = `
                <div style="flex:1; min-width:240px;">
                    <h3 style="font-size:1rem; font-weight:700; color:var(--text-main); margin:0 0 6px 0; line-height:1.35; word-break:break-word;">
                        ${g.metric}
                    </h3>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span style="font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:12px; background:rgba(99,102,241,0.15); color:var(--primary, #6366f1); border:1px solid rgba(99,102,241,0.25); white-space:nowrap;">
                            Skill: ${skillText}
                        </span>
                        <span style="font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:12px; background:var(--bg-alt, rgba(255,255,255,0.05)); color:var(--text-muted); border:1px solid var(--border, rgba(255,255,255,0.1)); white-space:nowrap;">
                            ${empText}
                        </span>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:16px; flex-shrink:0; flex-wrap:wrap;">
                    <div style="background:var(--bg-alt, rgba(255,255,255,0.03)); border:1px solid var(--border, rgba(255,255,255,0.08)); border-radius:8px; padding:8px 14px; display:flex; align-items:center; gap:14px; white-space:nowrap;">
                        <div style="display:flex; align-items:baseline; gap:6px;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">Target:</span>
                            <span style="font-size:1.15rem; font-weight:800; color:var(--primary, #6366f1); font-family:monospace;">${g.target}</span>
                        </div>

                        ${minVal !== null ? `
                        <div style="border-left:1px solid var(--border, rgba(255,255,255,0.1)); padding-left:14px; display:flex; align-items:baseline; gap:6px;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">Range <span style="font-size:0.7rem; font-weight:500; text-transform:none;">(${tolLabel})</span>:</span>
                            <span style="font-size:1rem; font-weight:700; color:var(--text-main); font-family:monospace;">${minVal} – ${maxVal}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn secondary" style="padding:6px 14px; font-size:0.8rem;" onclick="openGoalModal('${g.id}')">Modifica</button>
                        <button class="btn secondary" style="padding:6px 14px; font-size:0.8rem; color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="deleteGoal('${g.id}')">Elimina</button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    };
});

// ==========================================
// TABELLA OBIETTIVI VENDITA (STILE EXCEL)
// ==========================================
let isSalesTableEditMode = false;
let activeSalesTableId = 'default';

async function getSalesTablesList(year) {
    let tables = await appDb.getSetting(`sales_tables_list_${year}`, null);
    if (!tables || !Array.isArray(tables)) {
        tables = [];
    }
    const filtered = tables.filter(t => t.name !== 'Tabella Principale Obiettivi' && t.name !== 'Tabella Principale');
    if (filtered.length !== tables.length) {
        tables = filtered;
        await appDb.setSetting(`sales_tables_list_${year}`, tables);
    }
    return tables;
}

async function renderSalesGoalsTable() {
    const container = document.getElementById('goals-sales-table-container');
    if (!container) return;

    const year = window.appState?.activeYear || new Date().getFullYear();
    const tablesList = await getSalesTablesList(year);
    const configuredSkills = (await appDb.getSetting('skills', [])) || [];

    // Sposta il tasto Visualizza / Modifica nella barra in alto sulla destra
    const topActionsContainer = document.getElementById('goals-top-actions');
    if (topActionsContainer) {
        topActionsContainer.innerHTML = `
            <button class="btn btn-sm" id="toggle-sales-table-edit-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; border-radius:8px; padding:6px 14px; ${isSalesTableEditMode ? 'background:var(--primary); color:#fff; border:1px solid var(--primary);' : 'background:var(--bg-surface); color:var(--text-main); border:1px solid var(--border);'}">
                ${isSalesTableEditMode ? `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Modifica
                ` : `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Visualizza
                `}
            </button>
        `;
        const toggleBtn = topActionsContainer.querySelector('#toggle-sales-table-edit-btn');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                isSalesTableEditMode = !isSalesTableEditMode;
                renderSalesGoalsTable();
            };
        }
    }

    if (tablesList.length === 0) {
        container.innerHTML = `
            <div style="overflow-x:auto; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px;">
                <div style="padding:48px 20px; text-align:center; color:var(--text-muted);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom:12px; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:6px;">Nessuna Tabella Obiettivi</h3>
                    <p style="font-size:0.85rem; margin-bottom:18px;">Crea una nuova tabella obiettivi sales per skill.</p>
                    <button class="btn primary" id="empty-add-table-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:8px 18px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Aggiungi Tabella Obiettivi
                    </button>
                </div>
            </div>
        `;
        const emptyTabBtn = container.querySelector('#empty-add-table-btn');
        if (emptyTabBtn) {
            emptyTabBtn.onclick = () => openCreateNewTableModal(year, configuredSkills, tablesList);
        }
        return;
    }

    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const collabWorkPcts = (await appDb.getSetting('collab_work_pcts', {})) || {};

    const salesMetricsSet = new Set(['AOIT gew', 'My Service', 'My Security M+L', 'Retention', 'Mobile', 'Internet', 'TV']);
    salesData.forEach(d => {
        if (d.data?.Product) salesMetricsSet.add(d.data.Product);
        if (d.category) salesMetricsSet.add(d.category);
        Object.keys(d.data || {}).forEach(k => {
            if (k !== 'Product') salesMetricsSet.add(k);
        });
    });
    perfData.forEach(d => {
        Object.keys(d.data || {}).forEach(k => salesMetricsSet.add(k));
    });
    const availableSalesMetrics = Array.from(salesMetricsSet).sort();

    // Rendi tutte le tabelle in fila una sotto l'altra
    container.innerHTML = `
        <div style="display:flex; justify-content:flex-start; margin-bottom:16px;">
            <button class="btn primary btn-sm" id="create-new-table-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; border-radius:8px; padding:8px 16px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Aggiungi Tabella Obiettivi
            </button>
        </div>
        <div id="sales-tables-stack" style="display:flex; flex-direction:column; gap:24px;"></div>
    `;

    const stackDiv = container.querySelector('#sales-tables-stack');

    const addTableBtn = container.querySelector('#create-new-table-btn');
    if (addTableBtn) {
        addTableBtn.onclick = () => openCreateNewTableModal(year, configuredSkills, tablesList);
    }

    for (const t of tablesList) {
        let products = await appDb.getSetting(`sales_table_products_${t.id}`, null);
        if (!products || !Array.isArray(products)) {
            products = [];
            await appDb.setSetting(`sales_table_products_${t.id}`, products);
        }

        const savedTargets = (await appDb.getSetting(`sales_table_targets_${year}_${t.id}`, {})) || {};
        const manualCollabs = (await appDb.getSetting(`sales_table_collabs_${year}_${t.id}`, null)) || null;

        const empSet = new Set();
        if (manualCollabs && Array.isArray(manualCollabs)) {
            manualCollabs.forEach(n => empSet.add(n));
        } else {
            const skillFilter = t.skill || 'ALL';
            perfData.forEach(d => {
                if (d.employee && (skillFilter === 'ALL' || d.skill === skillFilter)) {
                    empSet.add(d.employee);
                }
            });
            salesData.forEach(d => {
                if (d.employee && (skillFilter === 'ALL' || d.skill === skillFilter)) {
                    empSet.add(d.employee);
                }
            });

            if (empSet.size === 0) {
                Object.keys(window.appState.anonymousMap || {}).forEach(n => empSet.add(n));
            }
        }

        const employees = Array.from(empSet).sort();

        const tableCard = document.createElement('div');
        tableCard.className = 'card sales-table-card';
        tableCard.dataset.tableId = t.id;
        tableCard.style.cssText = 'padding:18px; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg-surface);';

        tableCard.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <h2 style="font-size:1.15rem; font-weight:800; color:var(--text-main); margin:0;">${t.name}</h2>
                    <span style="font-size:0.72rem; padding:3px 10px; border-radius:12px; background:rgba(99,102,241,0.15); color:var(--primary); font-weight:700; letter-spacing:0.02em;">Skill: ${t.skill === 'ALL' ? 'Tutte' : t.skill}</span>
                </div>
                ${isSalesTableEditMode ? `
                    <button class="btn secondary btn-sm delete-table-btn" data-id="${t.id}" title="Elimina questa tabella" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem; color:#ef4444; border-color:rgba(239,68,68,0.3); padding:6px 12px;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Elimina Tabella
                    </button>
                ` : ''}
            </div>

            <div style="overflow-x:auto;">
                ${employees.length === 0 ? `
                    <p style="font-size:0.85rem; color:var(--text-muted); margin:12px 0;">Nessun collaboratore trovato per questa skill.</p>
                ` : `
                    <table class="sales-goals-table" data-table-id="${t.id}" style="width:auto; border-collapse:collapse; font-size:0.88rem; color:var(--text-main);">
                        <thead>
                            <tr style="background:var(--bg-base); border-bottom:2px solid var(--border);">
                                <th style="padding:12px; text-align:left; border-right:1px solid var(--border); width:180px; min-width:160px; font-weight:700;">Collaboratore</th>
                                <th style="padding:12px 6px; text-align:center; border-right:1px solid var(--border); width:90px; min-width:80px; font-weight:700;">% Lavoro</th>
                                ${products.map((p, idx) => `
                                    <th style="padding:12px 10px; text-align:center; border-right:1px solid var(--border); font-weight:700; background:rgba(59,130,246,0.05); width:155px; min-width:145px; position:relative;">
                                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                                            ${isSalesTableEditMode ? `
                                                <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; width:100%; background:var(--bg-surface); padding:4px 8px; border-radius:8px; border:1px solid var(--border);">
                                                    <input type="text" class="header-col-label-input" data-table-id="${t.id}" data-idx="${idx}" value="${p.label}" style="background:transparent; border:none; color:var(--text-main); font-weight:700; text-align:center; font-size:0.88rem; width:100%; outline:none;" placeholder="Titolo...">
                                                    <div style="display:flex; align-items:center; gap:3px; flex-shrink:0;">
                                                        <button class="edit-col-btn" data-table-id="${t.id}" data-idx="${idx}" title="Modifica Titolo" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:3px; display:inline-flex; align-items:center; border-radius:4px;" onmouseover="this.style.color='var(--primary)';" onmouseout="this.style.color='var(--text-muted)';">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                                        </button>
                                                        <button class="delete-col-btn" data-table-id="${t.id}" data-idx="${idx}" title="Elimina Colonna" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:3px; display:inline-flex; align-items:center; border-radius:4px; opacity:0.8;" onmouseover="this.style.opacity='1';" onmouseout="this.style.opacity='0.8';">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div style="display:flex; align-items:center; justify-content:center; gap:6px; width:100%;">
                                                    <span class="toggle-mode-btn" data-table-id="${t.id}" data-idx="${idx}" title="Clicca per cambiare modalità" style="cursor:pointer; font-size:0.68rem; padding:3px 7px; border-radius:6px; font-weight:700; letter-spacing:0.03em; ${p.mode === 'team' ? 'background:rgba(99,102,241,0.2); color:var(--primary); border:1px solid rgba(99,102,241,0.4);' : 'background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4);'}">
                                                        ${p.mode === 'team' ? 'TEAM' : 'INDIV.'}
                                                    </span>
                                                    <span class="toggle-chf-btn" data-table-id="${t.id}" data-idx="${idx}" title="Clicca per cambiare tipo di valore" style="cursor:pointer; font-size:0.68rem; padding:3px 7px; border-radius:6px; font-weight:700; letter-spacing:0.03em; background:var(--bg-surface); border:1px solid var(--border); color:var(--text-muted);">
                                                        ${p.isCHF ? 'CHF' : 'Qtà'}
                                                    </span>
                                                </div>
                                                <div class="col-metrics-picker" data-table-id="${t.id}" data-idx="${idx}" style="position:relative; width:100%;">
                                                    <button type="button" class="col-metrics-btn" data-table-id="${t.id}" data-idx="${idx}" style="background:var(--bg-surface); border:1px solid var(--border); color:var(--text-main); font-size:0.72rem; border-radius:6px; padding:4px 8px; width:100%; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:space-between; overflow:hidden;" title="Associa Prodotti DB (${(Array.isArray(p.mappedMetrics) ? p.mappedMetrics : (p.mappedMetric ? [p.mappedMetric] : [])).join(', ')})">
                                                        <span class="col-metrics-label" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; text-align:center;">
                                                            ${(() => {
                                                                const sel = Array.isArray(p.mappedMetrics) ? p.mappedMetrics : (p.mappedMetric ? [p.mappedMetric] : (p.key ? [p.key] : []));
                                                                return sel.length === 0 ? '-- Prodotti DB --' : (sel.length === 1 ? sel[0] : `${sel.length} Prodotti DB`);
                                                            })()}
                                                        </span>
                                                        <span style="font-size:0.55rem; opacity:0.6; margin-left:3px;">▼</span>
                                                    </button>
                                                    <div class="col-metrics-dropdown" data-table-id="${t.id}" data-idx="${idx}" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:100; background:var(--bg-surface); border:1px solid var(--border); border-radius:8px; box-shadow:0 8px 20px rgba(0,0,0,0.45); padding:8px; max-height:240px; overflow-y:auto; text-align:left;">
                                                        <div style="position:sticky; top:0; background:var(--bg-surface); padding-bottom:6px; margin-bottom:6px; border-bottom:1px solid var(--border); z-index:2;">
                                                            <input type="text" class="metric-search-input" data-table-id="${t.id}" data-idx="${idx}" placeholder="🔍 Cerca prodotto..." style="width:100%; padding:5px 8px; font-size:0.75rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); box-sizing:border-box;">
                                                        </div>
                                                        <div class="metric-items-list" data-table-id="${t.id}" data-idx="${idx}">
                                                            ${availableSalesMetrics.map(m => {
                                                                const sel = Array.isArray(p.mappedMetrics) ? p.mappedMetrics : (p.mappedMetric ? [p.mappedMetric] : (p.key === m ? [m] : []));
                                                                const isChecked = sel.includes(m);
                                                                return `
                                                                    <label class="metric-item-label" data-table-id="${t.id}" data-idx="${idx}" data-metric="${m}" style="display:flex; align-items:center; gap:6px; font-size:0.75rem; padding:4px 6px; color:var(--text-main); cursor:pointer; border-radius:4px; white-space:nowrap;">
                                                                        <input type="checkbox" class="metric-cb" data-table-id="${t.id}" data-idx="${idx}" data-metric="${m}" ${isChecked ? 'checked' : ''} style="margin:0;">
                                                                        <span style="overflow:hidden; text-overflow:ellipsis;">${m}</span>
                                                                    </label>
                                                                `;
                                                            }).join('')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : `
                                                <span style="font-weight:700; font-size:0.9rem; color:var(--text-main); line-height:1.2; word-break:break-word;">${p.label}</span>
                                            `}
                                        </div>
                                    </th>
                                `).join('')}
                                ${isSalesTableEditMode ? `
                                    <th style="padding:6px; text-align:center; width:50px; min-width:50px; background:rgba(99,102,241,0.05); border-right:1px solid var(--border);">
                                        <button class="btn primary add-table-col-header-btn" data-table-id="${t.id}" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; font-weight:700; cursor:pointer; margin:0 auto;" title="Aggiungi Obiettivo">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        </button>
                                    </th>
                                ` : ''}
                            </tr>
                        </thead>
                        <tbody class="sales-goals-tbody" data-table-id="${t.id}"></tbody>
                        <tfoot class="sales-goals-tfoot" data-table-id="${t.id}" style="border-top:2px solid var(--border); background:var(--bg-base);"></tfoot>
                    </table>
                `}
            </div>
        `;

        stackDiv.appendChild(tableCard);

        const deleteBtn = tableCard.querySelector('.delete-table-btn');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (!confirm(`Sei sicuro di voler eliminare la tabella "${t.name}"?`)) return;

                await appDb.setSetting(`sales_table_products_${t.id}`, []);
                await appDb.setSetting(`sales_table_targets_${year}_${t.id}`, {});
                await appDb.setSetting(`sales_table_collabs_${year}_${t.id}`, []);

                const idx = tablesList.findIndex(item => item.id === t.id);
                if (idx !== -1) tablesList.splice(idx, 1);
                await appDb.setSetting(`sales_tables_list_${year}`, tablesList);

                renderSalesGoalsTable();
            };
        }

        // Direct Header Editing Listeners
        tableCard.querySelectorAll('.edit-col-btn').forEach(btn => {
            btn.onclick = () => {
                const idx = btn.dataset.idx;
                const inp = tableCard.querySelector(`.header-col-label-input[data-idx="${idx}"]`);
                if (inp) {
                    inp.focus();
                    inp.select();
                }
            };
        });

        tableCard.querySelectorAll('.header-col-label-input').forEach(inp => {
            inp.onchange = async (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                if (products[idx]) {
                    products[idx].label = e.target.value.trim() || products[idx].key;
                    await appDb.setSetting(`sales_table_products_${t.id}`, products);
                    await saveSalesTableData(tableCard, t.id, products, employees, year, t.skill);
                }
            };
        });

        tableCard.querySelectorAll('.delete-col-btn').forEach(btn => {
            btn.onclick = async () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (!isNaN(idx) && products[idx]) {
                    products.splice(idx, 1);
                    await appDb.setSetting(`sales_table_products_${t.id}`, products);
                    await renderSalesGoalsTable();
                }
            };
        });

        tableCard.querySelectorAll('.toggle-mode-btn').forEach(btn => {
            btn.onclick = async () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (!isNaN(idx) && products[idx]) {
                    products[idx].mode = products[idx].mode === 'team' ? 'individual' : 'team';
                    await appDb.setSetting(`sales_table_products_${t.id}`, products);
                    await renderSalesGoalsTable();
                }
            };
        });

        tableCard.querySelectorAll('.toggle-chf-btn').forEach(btn => {
            btn.onclick = async () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (!isNaN(idx) && products[idx]) {
                    products[idx].isCHF = !products[idx].isCHF;
                    await appDb.setSetting(`sales_table_products_${t.id}`, products);
                    await renderSalesGoalsTable();
                }
            };
        });

        tableCard.querySelectorAll('.col-metrics-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = btn.dataset.idx;
                tableCard.querySelectorAll('.col-metrics-dropdown').forEach(dd => {
                    if (dd.dataset.idx === idx) {
                        const willShow = dd.style.display !== 'block';
                        dd.style.display = willShow ? 'block' : 'none';
                        if (willShow) {
                            const sInp = dd.querySelector('.metric-search-input');
                            if (sInp) {
                                sInp.value = '';
                                sInp.focus();
                                dd.querySelectorAll('.metric-item-label').forEach(lbl => lbl.style.display = 'flex');
                            }
                        }
                    } else {
                        dd.style.display = 'none';
                    }
                });
            };
        });

        tableCard.querySelectorAll('.metric-search-input').forEach(inp => {
            inp.onclick = (e) => e.stopPropagation();
            inp.oninput = (e) => {
                const q = e.target.value.toLowerCase().trim();
                const idx = inp.dataset.idx;
                tableCard.querySelectorAll(`.metric-item-label[data-idx="${idx}"]`).forEach(lbl => {
                    const metricText = (lbl.dataset.metric || '').toLowerCase();
                    lbl.style.display = metricText.includes(q) ? 'flex' : 'none';
                });
            };
        });

        tableCard.querySelectorAll('.metric-cb').forEach(cb => {
            cb.onchange = async () => {
                const idx = parseInt(cb.dataset.idx, 10);
                if (products[idx]) {
                    const checked = Array.from(tableCard.querySelectorAll(`.metric-cb[data-idx="${idx}"]:checked`)).map(c => c.dataset.metric);
                    products[idx].mappedMetrics = checked;
                    products[idx].mappedMetric = checked.join(', ');
                    await appDb.setSetting(`sales_table_products_${t.id}`, products);

                    const labelEl = tableCard.querySelector(`.col-metrics-btn[data-idx="${idx}"] .col-metrics-label`);
                    if (labelEl) {
                        labelEl.textContent = checked.length === 0 ? '-- Prodotti DB --' : (checked.length === 1 ? checked[0] : `${checked.length} Prodotti DB`);
                    }
                }
            };
        });

        const addColBtn = tableCard.querySelector('.add-table-col-header-btn');
        if (addColBtn) {
            addColBtn.onclick = async () => {
                const newIdx = products.length;
                const newKey = 'Obiettivo_' + Date.now();
                products.push({
                    key: newKey,
                    label: 'Nuovo Obiettivo',
                    mappedMetric: '',
                    isCHF: false,
                    mode: 'individual'
                });
                await appDb.setSetting(`sales_table_products_${t.id}`, products);
                await renderSalesGoalsTable();

                setTimeout(() => {
                    const newInp = container.querySelector(`.header-col-label-input[data-table-id="${t.id}"][data-idx="${newIdx}"]`);
                    if (newInp) {
                        newInp.focus();
                        newInp.select();
                    }
                }, 50);
            };
        }

        if (employees.length > 0) {
            buildTableBodyAndFoot(tableCard, t.id, products, employees, savedTargets, collabWorkPcts, t.skill);
        }
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.col-metrics-picker')) {
            container.querySelectorAll('.col-metrics-dropdown').forEach(dd => {
                dd.style.display = 'none';
            });
        }
    });
}

function buildTableBodyAndFoot(tableCard, tableId, products, employees, savedTargets, collabWorkPcts, skillFilter) {
    const tbody = tableCard.querySelector('.sales-goals-tbody');
    const tfoot = tableCard.querySelector('.sales-goals-tfoot');
    if (!tbody || !tfoot) return;

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    const year = window.appState?.activeYear || new Date().getFullYear();

    let totalWorkPctSum = 0;
    employees.forEach(emp => {
        totalWorkPctSum += (collabWorkPcts[emp] ?? 100);
    });

    const formatVal = (v, isCHF) => {
        if (v === null || v === undefined || v === '') return '—';
        const num = parseFloat(v);
        if (isNaN(num)) return '—';
        if (isCHF) return Math.round(num).toLocaleString('de-CH') + '.-';
        return Number.isInteger(num) ? num.toString() : num.toFixed(1);
    };

    employees.forEach((emp, empIdx) => {
        const empWorkPct = collabWorkPcts[emp] ?? 100;
        const displayName = window.getDisplayName(emp);

        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom:1px solid var(--border);';

        let rowHtml = `
            <td style="padding:10px 12px; font-weight:600; font-size:0.9rem; border-right:1px solid var(--border); white-space:nowrap;">
                ${displayName}
            </td>
            <td style="padding:6px; text-align:center; border-right:1px solid var(--border);">
                ${isSalesTableEditMode ? `
                    <input type="number" class="collab-work-pct-input" data-emp="${emp}" value="${empWorkPct}" min="0" max="200" style="width:54px; text-align:center; padding:4px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-weight:600; font-size:0.85rem;">%
                ` : `
                    <span style="font-weight:600; font-size:0.88rem; color:var(--text-muted);">${empWorkPct}%</span>
                `}
            </td>
        `;

        products.forEach(p => {
            if (p.mode === 'team') {
                if (empIdx === 0) {
                    const teamTotal = savedTargets['TEAM_' + p.key] ?? 0;
                    rowHtml += `
                        <td rowspan="${employees.length}" style="padding:16px; text-align:center; vertical-align:middle; border-right:1px solid var(--border); background:rgba(99,102,241,0.03);">
                            <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                                <span style="font-size:0.72rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.06em; opacity:0.9;">Obiettivo Team</span>
                                <span class="team-total-display" data-key="${p.key}" style="font-size:1.3rem; font-weight:800; color:var(--text-main); font-family:monospace;">${formatVal(teamTotal, p.isCHF)}</span>
                            </div>
                        </td>
                    `;
                }
            } else {
                const indivTotal = savedTargets['INDIV_TOTAL_' + p.key] ?? 0;
                const calcVal = totalWorkPctSum > 0 ? Math.round(indivTotal * (empWorkPct / totalWorkPctSum)) : 0;

                rowHtml += `
                    <td style="padding:8px; text-align:center; border-right:1px solid var(--border);">
                        ${isSalesTableEditMode ? `
                            <span class="indiv-calc-display" data-emp="${emp}" data-key="${p.key}" style="display:inline-block; width:95px; text-align:center; padding:5px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-muted); font-weight:700; font-size:0.88rem;">${formatVal(calcVal, p.isCHF)}</span>
                        ` : `
                            <span class="indiv-calc-display" data-emp="${emp}" data-key="${p.key}" style="font-weight:700; font-size:0.92rem; color:var(--text-main); font-family:monospace;">${formatVal(calcVal, p.isCHF)}</span>
                        `}
                    </td>
                `;
            }
        });

        if (isSalesTableEditMode) rowHtml += `<td></td>`;
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    // RIGA TOTALI TEAM
    const teamTr = document.createElement('tr');
    teamTr.style.cssText = 'background:var(--bg-base); font-weight:700; border-top:2px solid var(--border);';
    let teamHtml = `
        <td style="padding:12px; border-right:1px solid var(--border); font-weight:800; color:var(--primary); font-size:0.92rem;">TOTALI OBIETTIVI TEAM</td>
        <td style="padding:12px 6px; text-align:center; border-right:1px solid var(--border); font-weight:800; font-size:0.92rem;" class="total-work-pct-sum-cell">${totalWorkPctSum}%</td>
    `;

    products.forEach(p => {
        const storedVal = p.mode === 'team'
            ? (savedTargets['TEAM_' + p.key] ?? 0)
            : (savedTargets['INDIV_TOTAL_' + p.key] ?? 0);

        const inputClass = p.mode === 'team' ? 'sales-team-target-input' : 'sales-indiv-total-input';
        const borderColor = p.mode === 'team' ? 'var(--primary, #6366f1)' : 'var(--border)';

        if (isSalesTableEditMode) {
            teamHtml += `
                <td style="padding:6px; text-align:center; border-right:1px solid var(--border);">
                    <input type="number" step="any" class="${inputClass}" data-key="${p.key}" data-mode="${p.mode}" value="${storedVal || ''}" placeholder="0" style="width:95px; text-align:center; padding:6px; border-radius:6px; border:2px solid ${borderColor}; background:var(--bg-surface); color:var(--text-main); font-weight:800; font-size:0.95rem;">
                </td>
            `;
        } else {
            teamHtml += `
                <td style="padding:12px 6px; text-align:center; border-right:1px solid var(--border); font-weight:800; font-size:0.95rem; color:var(--primary); font-family:monospace;">
                    ${formatVal(storedVal, p.isCHF)}
                </td>
            `;
        }
    });
    if (isSalesTableEditMode) teamHtml += `<td></td>`;
    teamTr.innerHTML = teamHtml;
    tfoot.appendChild(teamTr);

    const handleDynamicRecalc = async () => {
        let currentTotalWork = 0;
        tableCard.querySelectorAll('.collab-work-pct-input').forEach(inp => {
            currentTotalWork += (parseFloat(inp.value) || 0);
        });

        const totalWorkEl = tableCard.querySelector('.total-work-pct-sum-cell');
        if (totalWorkEl) totalWorkEl.textContent = `${currentTotalWork}%`;

        products.forEach(p => {
            const selector = p.mode === 'team'
                ? `.sales-team-target-input[data-key="${p.key}"]`
                : `.sales-indiv-total-input[data-key="${p.key}"]`;
            const totalInp = tableCard.querySelector(selector);
            const totalVal = totalInp ? (parseFloat(totalInp.value) || 0) : (savedTargets[p.mode === 'team' ? 'TEAM_' + p.key : 'INDIV_TOTAL_' + p.key] || 0);

            if (p.mode === 'team') {
                const display = tableCard.querySelector(`.team-total-display[data-key="${p.key}"]`);
                if (display) display.textContent = formatVal(totalVal, p.isCHF);
            } else {
                employees.forEach(emp => {
                    const empWorkInp = tableCard.querySelector(`.collab-work-pct-input[data-emp="${emp}"]`);
                    const empWorkPct = empWorkInp ? (parseFloat(empWorkInp.value) || 0) : (collabWorkPcts[emp] ?? 100);
                    const calcVal = currentTotalWork > 0 ? Math.round(totalVal * (empWorkPct / currentTotalWork)) : 0;

                    const display = tableCard.querySelector(`.indiv-calc-display[data-emp="${emp}"][data-key="${p.key}"]`);
                    if (display) display.textContent = formatVal(calcVal, p.isCHF);
                });
            }
        });

        await saveSalesTableData(tableCard, tableId, products, employees, year, skillFilter);
    };

    tableCard.querySelectorAll('.sales-team-target-input, .sales-indiv-total-input, .collab-work-pct-input').forEach(inp => {
        inp.removeEventListener('input', handleDynamicRecalc);
        inp.addEventListener('input', handleDynamicRecalc);
    });
}

async function saveSalesTableData(tableCard, tableId, products, employees, year, activeSkillFilter) {
    const collabWorkPcts = {};
    const savedTargets = {};

    tableCard.querySelectorAll('.collab-work-pct-input').forEach(inp => {
        const emp = inp.dataset.emp;
        const val = parseFloat(inp.value) || 100;
        collabWorkPcts[emp] = val;
    });

    tableCard.querySelectorAll('.sales-team-target-input').forEach(inp => {
        const key = inp.dataset.key;
        const val = parseFloat(inp.value) || 0;
        savedTargets['TEAM_' + key] = val;
    });

    tableCard.querySelectorAll('.sales-indiv-total-input').forEach(inp => {
        const key = inp.dataset.key;
        const val = parseFloat(inp.value) || 0;
        savedTargets['INDIV_TOTAL_' + key] = val;
    });

    await appDb.setSetting('collab_work_pcts', collabWorkPcts);
    await appDb.setSetting(`sales_table_targets_${year}_${tableId}`, savedTargets);

    // Sincronizza lo store 'goals' IndexedDB
    const goalsToSave = [];
    products.forEach(p => {
        if (p.mode === 'team') {
            const tgt = savedTargets['TEAM_' + p.key];
            if (tgt && tgt > 0) {
                goalsToSave.push({
                    id: `salestable_${year}_${tableId}_TEAM_${p.key}`,
                    year: year,
                    metric: p.mappedMetric || p.label,
                    mappedMetrics: p.mappedMetrics || [],
                    target: tgt,
                    skill: activeSkillFilter,
                    employee: '',
                    toleranceType: 'percentage',
                    tolerancePlus: 0,
                    toleranceMinus: 0
                });
            }
        } else {
            const indivTotal = savedTargets['INDIV_TOTAL_' + p.key] || 0;
            let totalWork = 0;
            employees.forEach(e => totalWork += (collabWorkPcts[e] ?? 100));

            employees.forEach(emp => {
                const workPct = collabWorkPcts[emp] ?? 100;
                const calcVal = totalWork > 0 ? Math.round(indivTotal * (workPct / totalWork)) : 0;
                if (calcVal > 0) {
                    goalsToSave.push({
                        metric: `Sales: ${p.key}`,
                        skill: activeSkillFilter,
                        employee: emp,
                        target: tgt,
                        year: year
                    });
                }
            });
        }
    });

    if (goalsToSave.length > 0) {
        await appDb.addMultiple('goals', goalsToSave);
    }
}

async function openAddCollaboratorModal(existingEmployees, year, skillFilter) {
    let modal = document.getElementById('add-collab-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-collab-modal';
        modal.className = 'modal';
        modal.style.cssText = 'max-width: 480px; width: 92%; border-radius: 12px;';
        document.body.appendChild(modal);
    }

    const overlay = document.getElementById('modal-overlay');
    const allNames = Object.keys(window.appState.anonymousMap || {}).sort();

    modal.innerHTML = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border);">
            <h2 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">Aggiungi Collaboratore alla Tabella</h2>
            <button class="close-modal" id="close-add-collab-modal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; display:flex; flex-direction:column; gap:14px;">
            <label style="font-size:0.85rem; font-weight:600; color:var(--text-main);">Seleziona dai Collaboratori Esistenti:</label>
            <select id="select-existing-collab" style="padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
                <option value="">Seleziona...</option>
                ${allNames.map(n => `<option value="${n}">${window.getDisplayName(n)}</option>`).join('')}
            </select>
            <div style="text-align:center; font-weight:600; font-size:0.8rem; color:var(--text-muted);">OPPURE</div>
            <label style="font-size:0.85rem; font-weight:600; color:var(--text-main);">Inserisci un Nuovo Nome:</label>
            <input type="text" id="input-new-collab" placeholder="Nome Cognome" style="padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
        </div>
        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--border);">
            <button class="btn secondary" id="cancel-add-collab-btn">Annulla</button>
            <button class="btn primary" id="confirm-add-collab-btn">Aggiungi</button>
        </div>
    `;

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    modal.querySelector('#close-add-collab-modal').onclick = closeModal;
    modal.querySelector('#cancel-add-collab-btn').onclick = closeModal;

    modal.querySelector('#confirm-add-collab-btn').onclick = async () => {
        const sel = modal.querySelector('#select-existing-collab').value;
        const inp = modal.querySelector('#input-new-collab').value.trim();
        const empName = sel || inp;

        if (!empName) {
            alert('Seleziona o inserisci un nome.');
            return;
        }

        const currentList = new Set(existingEmployees);
        currentList.add(empName);

        await appDb.setSetting(`sales_table_collabs_${year}_${skillFilter}`, Array.from(currentList));
        closeModal();
        await renderSalesGoalsTable();
    };

    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
}

async function openCalcByWorkPctModal(products, employees, year, skillFilter) {
    let modal = document.getElementById('calc-by-work-pct-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'calc-by-work-pct-modal';
        modal.className = 'modal';
        modal.style.cssText = 'max-width: 520px; width: 92%; border-radius: 12px;';
        document.body.appendChild(modal);
    }

    const overlay = document.getElementById('modal-overlay');

    modal.innerHTML = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border);">
            <h2 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">Calcola Obiettivi da % Lavoro</h2>
            <button class="close-modal" id="close-calc-modal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; max-height:65vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px;">
            <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
                Inserisci il target base per un collaboratore a tempo pieno (100%). Gli obiettivi di ciascun collaboratore verranno calcolati proporzionalmente alla loro % di lavoro.
            </p>
            <div id="calc-products-form" style="display:flex; flex-direction:column; gap:10px;"></div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--border);">
            <button class="btn secondary" id="cancel-calc-btn">Annulla</button>
            <button class="btn primary" id="apply-calc-btn">Calcola e Applica</button>
        </div>
    `;

    const form = modal.querySelector('#calc-products-form');
    products.forEach(p => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 12px; background:var(--bg-base); border:1px solid var(--border); border-radius:6px;';
        div.innerHTML = `
            <span style="font-weight:600; font-size:0.88rem; color:var(--text-main);">${p.label} (Base 100%)</span>
            <input type="number" step="any" class="base-100-target-input" data-key="${p.key}" placeholder="0" style="width:110px; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-weight:bold; font-size:0.85rem;">
        `;
        form.appendChild(div);
    });

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    modal.querySelector('#close-calc-modal').onclick = closeModal;
    modal.querySelector('#cancel-calc-btn').onclick = closeModal;

    modal.querySelector('#apply-calc-btn').onclick = async () => {
        const baseTargets = {};
        modal.querySelectorAll('.base-100-target-input').forEach(inp => {
            baseTargets[inp.dataset.key] = parseFloat(inp.value) || 0;
        });

        const container = document.getElementById('goals-sales-table-container');
        if (!container) return;

        employees.forEach(emp => {
            const workPctInput = container.querySelector(`.collab-work-pct-input[data-emp="${emp}"]`);
            const workPct = workPctInput ? (parseFloat(workPctInput.value) || 100) : 100;

            products.forEach(p => {
                const baseTgt = baseTargets[p.key] || 0;
                const calcTgt = Math.round(baseTgt * (workPct / 100));
                const tgtInput = container.querySelector(`.sales-target-input[data-emp="${emp}"][data-key="${p.key}"]`);
                if (tgtInput) {
                    tgtInput.value = calcTgt > 0 ? calcTgt : '';
                }
            });
        });

        closeModal();
        await saveSalesTableData(container, products, employees, year, skillFilter);
        await renderSalesGoalsTable();
    };

    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
}

async function getAvailableDbMetrics(year) {
    const activeYear = year || window.appState?.activeYear || new Date().getFullYear();
    const perfData = await appDb.getAll('performance', 'year', activeYear);
    const salesData = await appDb.getAll('sales', 'year', activeYear);

    const salesMetricsSet = new Set(['AOIT gew', 'My Service', 'My Security M+L', 'Retention', 'Mobile', 'Internet', 'TV']);
    salesData.forEach(d => {
        if (d.data?.Product) salesMetricsSet.add(d.data.Product);
        if (d.category) salesMetricsSet.add(d.category);
        Object.keys(d.data || {}).forEach(k => {
            if (k !== 'Product') salesMetricsSet.add(k);
        });
    });
    perfData.forEach(d => {
        Object.keys(d.data || {}).forEach(k => salesMetricsSet.add(k));
    });
    return Array.from(salesMetricsSet).sort();
}

async function openManageProductsModal(currentProducts) {
    let modal = document.getElementById('manage-products-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'manage-products-modal';
        modal.className = 'modal';
        modal.style.cssText = 'max-width: 680px; width: 92%; border-radius: 12px;';
        document.body.appendChild(modal);
    }

    const overlay = document.getElementById('modal-overlay');
    const year = window.appState?.activeYear || new Date().getFullYear();
    const availableMetrics = await getAvailableDbMetrics(year);

    let activeProds = JSON.parse(JSON.stringify(currentProducts));

    modal.innerHTML = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border);">
            <h2 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">Gestisci Colonne Prodotti & Metriche</h2>
            <button class="close-modal" id="close-prod-modal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; max-height:65vh; overflow-y:auto; display:flex; flex-direction:column; gap:16px;">
            <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
                Aggiungi o modifica le colonne della tabella, collega ciascuna colonna ad una metrica rilevata nel database e definisci se l'obiettivo è individuale o di team.
            </p>
            <div id="manage-prods-list" style="display:flex; flex-direction:column; gap:12px;"></div>
            
            <div style="padding:14px; border-radius:8px; background:var(--bg-base); border:1px solid var(--border); display:flex; flex-direction:column; gap:10px;">
                <h4 style="font-size:0.9rem; font-weight:700; margin:0; color:var(--text-main);">+ Aggiungi Nuova Colonna</h4>
                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                    <input type="text" id="new-prod-name" placeholder="Titolo colonna (es. Nuovi Abo)" style="flex:1; min-width:140px; padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.85rem;">
                    <select id="new-prod-metric" style="flex:1; min-width:140px; padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.85rem;">
                        <option value="">Collega a metrica DB...</option>
                        ${availableMetrics.map(m => `<option value="${m}">${m}</option>`).join('')}
                    </select>
                    <select id="new-prod-mode" style="padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.85rem;">
                        <option value="individual">Individuale</option>
                        <option value="team">Di Team</option>
                    </select>
                    <label style="display:flex; align-items:center; gap:4px; font-size:0.8rem; color:var(--text-muted); cursor:pointer; white-space:nowrap;">
                        <input type="checkbox" id="new-prod-chf"> Valore CHF
                    </label>
                    <button class="btn secondary" id="add-prod-item-btn" style="padding:6px 14px; font-size:0.8rem;">Aggiungi</button>
                </div>
            </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--border);">
            <button class="btn secondary" id="cancel-prod-btn">Annulla</button>
            <button class="btn primary" id="save-prod-btn">Salva Colonne</button>
        </div>
    `;

    const renderProdList = () => {
        const listDiv = modal.querySelector('#manage-prods-list');
        listDiv.innerHTML = '';
        activeProds.forEach((p, idx) => {
            const selMetrics = Array.isArray(p.mappedMetrics) ? p.mappedMetrics : (p.mappedMetric ? [p.mappedMetric] : []);
            const mode = p.mode || 'individual';
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; flex-wrap:wrap;';
            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:240px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="text" class="prod-label-input" data-idx="${idx}" value="${p.label}" style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-weight:600; font-size:0.88rem; width:140px;">
                        <input type="text" class="modal-metric-search" data-idx="${idx}" placeholder="🔍 Filtra prodotti DB..." style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.75rem; flex:1;">
                    </div>
                    <div class="modal-metrics-box" data-idx="${idx}" style="max-height:90px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; padding:6px; background:var(--bg-surface);">
                        ${availableMetrics.map(m => `
                            <label class="modal-metric-label" data-idx="${idx}" data-metric="${m}" style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--text-main); cursor:pointer; padding:2px;">
                                <input type="checkbox" class="modal-metric-cb" data-idx="${idx}" data-metric="${m}" ${selMetrics.includes(m) ? 'checked' : ''}>
                                <span>${m}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <select class="prod-mode-select" data-idx="${idx}" style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.8rem;">
                        <option value="individual" ${mode === 'individual' ? 'selected' : ''}>Individuale</option>
                        <option value="team" ${mode === 'team' ? 'selected' : ''}>Di Team</option>
                    </select>
                    <label style="display:flex; align-items:center; gap:4px; font-size:0.78rem; color:var(--text-muted); cursor:pointer;">
                        <input type="checkbox" class="prod-chf-cb" data-idx="${idx}" ${p.isCHF ? 'checked' : ''}> CHF
                    </label>
                    <button class="btn secondary" style="padding:3px 8px; font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="removeProductItem(${idx})">Rimuovi</button>
                </div>
            `;
            listDiv.appendChild(div);
        });

        // Search listener for modal items
        listDiv.querySelectorAll('.modal-metric-search').forEach(sInp => {
            sInp.oninput = (e) => {
                const q = e.target.value.toLowerCase().trim();
                const idx = sInp.dataset.idx;
                listDiv.querySelectorAll(`.modal-metric-label[data-idx="${idx}"]`).forEach(lbl => {
                    const text = (lbl.dataset.metric || '').toLowerCase();
                    lbl.style.display = text.includes(q) ? 'flex' : 'none';
                });
            };
        });
    };

    window.removeProductItem = (idx) => {
        activeProds.splice(idx, 1);
        renderProdList();
    };

    renderProdList();

    modal.querySelector('#add-prod-item-btn').onclick = () => {
        const inputName = modal.querySelector('#new-prod-name');
        const metricSelect = modal.querySelector('#new-prod-metric');
        const modeSelect = modal.querySelector('#new-prod-mode');
        const chfCb = modal.querySelector('#new-prod-chf');

        const name = inputName ? inputName.value.trim() : '';
        const mappedMetric = metricSelect ? metricSelect.value : name;
        const mode = modeSelect ? modeSelect.value : 'individual';
        const isCHF = chfCb ? chfCb.checked : false;

        if (!name) return;
        activeProds.push({
            key: name,
            label: name,
            mappedMetrics: mappedMetric ? [mappedMetric] : [],
            mappedMetric: mappedMetric || name,
            isCHF: isCHF,
            mode: mode
        });
        inputName.value = '';
        renderProdList();
    };

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    modal.querySelector('#close-prod-modal').onclick = closeModal;
    modal.querySelector('#cancel-prod-btn').onclick = closeModal;

    modal.querySelector('#save-prod-btn').onclick = async () => {
        modal.querySelectorAll('.prod-label-input').forEach(inp => {
            const idx = parseInt(inp.dataset.idx, 10);
            if (activeProds[idx]) activeProds[idx].label = inp.value.trim() || activeProds[idx].key;
        });
        activeProds.forEach((p, idx) => {
            const checked = Array.from(modal.querySelectorAll(`.modal-metric-cb[data-idx="${idx}"]:checked`)).map(c => c.dataset.metric);
            p.mappedMetrics = checked;
            p.mappedMetric = checked.join(', ');
        });
        modal.querySelectorAll('.prod-mode-select').forEach(sel => {
            const idx = parseInt(sel.dataset.idx, 10);
            if (activeProds[idx]) activeProds[idx].mode = sel.value;
        });
        modal.querySelectorAll('.prod-chf-cb').forEach(cb => {
            const idx = parseInt(cb.dataset.idx, 10);
            if (activeProds[idx]) activeProds[idx].isCHF = cb.checked;
        });

        await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, activeProds);
        closeModal();
        await renderSalesGoalsTable();
    };

    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
}

window.deleteGoal = async function(id) {
    if (!confirm("Sei sicuro di voler eliminare questo obiettivo?")) return;
    const transaction = appDb._db.transaction(['goals'], 'readwrite');
    const store = transaction.objectStore('goals');
    store.delete(id);
    transaction.oncomplete = () => {
        renderGoals();
        if (window.renderStatistics) renderStatistics();
    };
}

async function openGoalModal(goalId = null) {
    editingGoalId = (typeof goalId === 'string') ? goalId : null;
    let modal = document.getElementById('goal-config-modal');
    if (!modal) {
        modal = createGoalModalHTML();
    }
    
    const modalTitle = modal.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = editingGoalId ? 'Modifica Obiettivo' : 'Nuovo Obiettivo';
    }
    
    // Populate metrics
    const year = window.appState?.activeYear || new Date().getFullYear();
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    
    const metricsSet = new Set();
    perfData.forEach(d => Object.keys(d.data).forEach(k => metricsSet.add(`Performance: ${k}`)));
    salesData.forEach(d => {
        Object.keys(d.data).forEach(k => {
            if (k !== 'Product') metricsSet.add(`Sales: ${k}`);
        });
    });
    
    const allMetrics = Array.from(metricsSet).sort();

    const metricSearchInput = document.getElementById('goal-metric-search');
    const metricDropdown = document.getElementById('goal-metric-dropdown');
    const metricHidden = document.getElementById('goal-metric');

    let goalSelectedMetric = '';

    function renderGoalDropdown(filterText = '') {
        metricDropdown.innerHTML = '';
        const query = filterText.toLowerCase().trim();
        const filtered = allMetrics.filter(m => !query || m.toLowerCase().includes(query));
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:8px 12px; color:var(--text-muted); font-size:0.85rem;';
            empty.textContent = 'Nessun risultato';
            metricDropdown.appendChild(empty);
            return;
        }
        filtered.forEach(m => {
            const item = document.createElement('div');
            item.className = 'searchable-dropdown-item' + (m === goalSelectedMetric ? ' selected' : '');
            item.textContent = m;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                goalSelectedMetric = m;
                metricHidden.value = m;
                metricSearchInput.value = m;
                metricDropdown.classList.remove('open');
                renderGoalDropdown(m);
            });
            metricDropdown.appendChild(item);
        });
    }

    metricSearchInput.value = '';
    goalSelectedMetric = allMetrics.length > 0 ? allMetrics[0] : '';
    metricHidden.value = goalSelectedMetric;
    if (goalSelectedMetric) metricSearchInput.value = goalSelectedMetric;
    renderGoalDropdown('');

    metricSearchInput.addEventListener('focus', () => {
        metricSearchInput.select();
        renderGoalDropdown(metricSearchInput.value === goalSelectedMetric ? '' : metricSearchInput.value);
        metricDropdown.classList.add('open');
    });
    metricSearchInput.addEventListener('input', (e) => {
        renderGoalDropdown(e.target.value);
        metricDropdown.classList.add('open');
    });
    metricSearchInput.addEventListener('blur', () => {
        metricDropdown.classList.remove('open');
        if (goalSelectedMetric) metricSearchInput.value = goalSelectedMetric;
    });

    // Populate skills
    const skillSelect = document.getElementById('goal-skill');
    skillSelect.innerHTML = '<option value="ALL">Tutti gli Skill (Default)</option>';
    const skillsSet = new Set();
    const savedSkills = await appDb.getSetting('skills', null);
    if (savedSkills && Array.isArray(savedSkills)) {
        savedSkills.forEach(s => skillsSet.add(s));
    }
    perfData.forEach(d => { if (d.skill) skillsSet.add(d.skill); });
    Array.from(skillsSet).sort().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        skillSelect.appendChild(opt);
    });
    
    // Populate employees
    const empSelect = document.getElementById('goal-employee');
    empSelect.innerHTML = '<option value="">Tutto il Team (Default)</option>';
    const names = Object.keys(window.appState.anonymousMap || {}).sort();
    names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = window.getDisplayName(n);
        empSelect.appendChild(opt);
    });

    // Live calculation logic between target, tolerance percentage, and numeric values
    const targetInput = document.getElementById('goal-target');
    const minusPctInput = document.getElementById('goal-tolerance-minus-pct');
    const minusNumInput = document.getElementById('goal-tolerance-minus-num');
    const plusPctInput = document.getElementById('goal-tolerance-plus-pct');
    const plusNumInput = document.getElementById('goal-tolerance-plus-num');

    function syncToleranceFromPct() {
        const target = parseFloat(targetInput.value);
        const mPct = parseFloat(minusPctInput.value);
        const pPct = parseFloat(plusPctInput.value);

        if (!isNaN(target)) {
            if (!isNaN(mPct)) {
                minusNumInput.value = Math.round(target * (mPct / 100));
            }
            if (!isNaN(pPct)) {
                plusNumInput.value = Math.round(target * (pPct / 100));
            }
        }
    }

    function syncToleranceMinusFromNum() {
        const target = parseFloat(targetInput.value);
        const mNum = parseFloat(minusNumInput.value);
        if (!isNaN(target) && target !== 0 && !isNaN(mNum)) {
            minusPctInput.value = Math.round((mNum / target) * 100);
        }
    }

    function syncTolerancePlusFromNum() {
        const target = parseFloat(targetInput.value);
        const pNum = parseFloat(plusNumInput.value);
        if (!isNaN(target) && target !== 0 && !isNaN(pNum)) {
            plusPctInput.value = Math.round((pNum / target) * 100);
        }
    }

    targetInput.oninput = () => { syncToleranceFromPct(); setSuffixes(); };
    minusPctInput.oninput = () => { syncToleranceFromPct(); };
    plusPctInput.oninput = () => { syncToleranceFromPct(); };
    minusNumInput.oninput = () => { syncToleranceMinusFromNum(); setSuffixes(); };
    plusNumInput.oninput = () => { syncTolerancePlusFromNum(); setSuffixes(); };

    // Suffix % visibility management
    const minusPctSuffix = document.getElementById('tol-minus-pct-suffix');
    const plusPctSuffix = document.getElementById('tol-plus-pct-suffix');

    function updateSuffix(input, suffix) {
        suffix.style.display = input.value !== '' ? 'block' : 'none';
    }

    function setSuffixes() {
        updateSuffix(minusPctInput, minusPctSuffix);
        updateSuffix(plusPctInput, plusPctSuffix);
    }

    // Load existing goal values if editing
    if (editingGoalId) {
        const goals = await appDb.getAll('goals', 'year', year);
        const existing = goals.find(g => g.id === editingGoalId);
        if (existing) {
            goalSelectedMetric = existing.metric || '';
            metricHidden.value = goalSelectedMetric;
            metricSearchInput.value = goalSelectedMetric;
            renderGoalDropdown('');
            targetInput.value = existing.target ?? '';
            skillSelect.value = existing.skill || 'ALL';
            empSelect.value = existing.employee || '';
            
            if (existing.toleranceType === 'percentage') {
                minusPctInput.value = existing.toleranceMinus ?? '';
                plusPctInput.value = existing.tolerancePlus ?? '';
                syncToleranceFromPct();
            } else if (existing.toleranceType === 'numeric') {
                minusNumInput.value = existing.toleranceMinus ?? '';
                plusNumInput.value = existing.tolerancePlus ?? '';
                syncToleranceMinusFromNum();
                syncTolerancePlusFromNum();
            } else {
                minusPctInput.value = '';
                plusPctInput.value = '';
                minusNumInput.value = '';
                plusNumInput.value = '';
            }
            setSuffixes();
        }
    } else {
        targetInput.value = '';
        skillSelect.value = 'ALL';
        empSelect.value = '';
        minusPctInput.value = '';
        plusPctInput.value = '';
        minusNumInput.value = '';
        plusNumInput.value = '';
        setSuffixes();
    }

    modal.classList.add('open');
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('open');
}

function createGoalModalHTML() {
    const html = `
    <div id="goal-config-modal" class="modal">
        <div class="modal-header">
            <h2>Nuovo Obiettivo</h2>
            <button class="close-modal" onclick="document.getElementById('goal-config-modal').classList.remove('open'); const ov = document.getElementById('modal-overlay'); if (ov) ov.classList.remove('open');">&times;</button>
        </div>
        <div class="modal-body">
            <label>Dato / Metrica:</label>
            <div style="position:relative; margin-bottom:16px;">
                <input type="text" id="goal-metric-search" placeholder="Cerca metrica..." autocomplete="off" style="width:100%; padding:8px 32px 8px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
                <svg style="position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:0.4;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                <input type="hidden" id="goal-metric">
                <div id="goal-metric-dropdown" class="searchable-dropdown"></div>
            </div>

            <!-- Single Row layout for Tolerance (-) | Target | Tolerance (+) -->
            <div style="display:flex; gap:12px; align-items:flex-end; margin-bottom:16px;">
                <!-- Left: Tolleranza in meno -->
                <div style="flex:1;">
                    <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:4px;">Tolleranza -</label>
                    <div style="display:flex; gap:4px;">
                        <div style="flex:1; position:relative;">
                            <input type="number" step="any" id="goal-tolerance-minus-pct" placeholder="%" style="width:100%; padding:6px 24px 6px 6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); box-sizing:border-box;">
                            <span id="tol-minus-pct-suffix" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:0.8rem; color:var(--text-muted); pointer-events:none; display:none;">%</span>
                        </div>
                        <div style="flex:1; position:relative;">
                            <input type="number" step="any" id="goal-tolerance-minus-num" placeholder="Valore" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); box-sizing:border-box;">
                        </div>
                    </div>
                </div>

                <!-- Center: Target / Obiettivo -->
                <div style="flex:1;">
                    <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:4px; text-align:center;">Obiettivo (Target)</label>
                    <input type="number" step="any" id="goal-target" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-weight:bold; text-align:center;">
                </div>

                <!-- Right: Tolleranza in più -->
                <div style="flex:1;">
                    <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:4px;">Tolleranza +</label>
                    <div style="display:flex; gap:4px;">
                        <div style="flex:1; position:relative;">
                            <input type="number" step="any" id="goal-tolerance-plus-pct" placeholder="%" style="width:100%; padding:6px 24px 6px 6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); box-sizing:border-box;">
                            <span id="tol-plus-pct-suffix" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:0.8rem; color:var(--text-muted); pointer-events:none; display:none;">%</span>
                        </div>
                        <div style="flex:1; position:relative;">
                            <input type="number" step="any" id="goal-tolerance-plus-num" placeholder="Valore" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); box-sizing:border-box;">
                        </div>
                    </div>
                </div>
            </div>

            <label>Skill:</label>
            <select id="goal-skill" style="width:100%; padding:8px; margin-bottom:16px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);"></select>
            
            <label>Assegna a dipendente:</label>
            <select id="goal-employee" style="width:100%; padding:8px; margin-bottom:16px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);"></select>
        </div>
        <div class="modal-footer">
            <button class="btn primary" onclick="saveNewGoal()">Salva Obiettivo</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    return document.getElementById('goal-config-modal');
}

async function saveNewGoal() {
    const metric = document.getElementById('goal-metric').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const tolerancePlus = parseFloat(document.getElementById('goal-tolerance-plus-pct').value) || 0;
    const toleranceMinus = parseFloat(document.getElementById('goal-tolerance-minus-pct').value) || 0;
    const skill = document.getElementById('goal-skill').value;
    const employee = document.getElementById('goal-employee').value;
    
    if (!metric) {
        alert("Seleziona una metrica.");
        return;
    }
    if (isNaN(target)) {
        alert("Inserisci un target numerico valido.");
        return;
    }
    
    const toleranceType = (tolerancePlus !== 0 || toleranceMinus !== 0) ? 'percentage' : 'none';

    const newGoal = {
        id: editingGoalId || ('goal_' + Date.now()),
        metric,
        target,
        toleranceType,
        tolerancePlus,
        toleranceMinus,
        skill,
        employee,
        year: window.appState?.activeYear || new Date().getFullYear()
    };
    
    await appDb.addMultiple('goals', [newGoal]);
    document.getElementById('goal-config-modal').classList.remove('open');
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
    editingGoalId = null;
    renderGoals();
    
    // Re-render statistics to show the new goal line if it's open
    if (document.getElementById('statistics').classList.contains('active') && window.renderStatistics) {
        renderStatistics();
    }
}

async function openCreateNewTableModal(year, configuredSkills, tablesList) {
    let modal = document.getElementById('create-table-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'create-table-modal';
        modal.className = 'modal';
        modal.style.cssText = 'max-width: 540px; width: 92%; border-radius: 12px;';
        document.body.appendChild(modal);
    }

    const overlay = document.getElementById('modal-overlay');

    modal.innerHTML = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border);">
            <h2 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">Aggiungi Tabella Obiettivi Sales</h2>
            <button class="close-modal" id="close-create-tab-modal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; max-height:68vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px;">
            <div>
                <label style="font-size:0.85rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:4px;">Skill:</label>
                <select id="new-table-skill-select" style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-size:0.88rem;">
                    <option value="ALL">Tutte le Skill</option>
                    ${configuredSkills.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <p style="font-size:0.78rem; color:var(--text-muted); margin-top:6px;">Il nome della tabella corrisponderà allo skill selezionato.</p>
            </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--border);">
            <button class="btn secondary" id="cancel-create-tab-btn">Annulla</button>
            <button class="btn primary" id="confirm-create-tab-btn">Aggiungi</button>
        </div>
    `;

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    modal.querySelector('#close-create-tab-modal').onclick = closeModal;
    modal.querySelector('#cancel-create-tab-btn').onclick = closeModal;

    modal.querySelector('#confirm-create-tab-btn').onclick = async () => {
        const skill = modal.querySelector('#new-table-skill-select').value;
        const name = skill === 'ALL' ? 'Tutte le Skill' : skill;

        const newId = 'table_' + Date.now();
        tablesList.push({ id: newId, name: name, skill: skill });

        await appDb.setSetting(`sales_tables_list_${year}`, tablesList);
        await appDb.setSetting(`sales_table_products_${newId}`, []);

        activeSalesTableId = newId;
        closeModal();
        renderSalesGoalsTable();
    };

    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
}
