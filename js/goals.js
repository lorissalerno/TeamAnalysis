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

let activeSalesTableId = 'default';

async function getSalesTablesList(year) {
    let tables = await appDb.getSetting(`sales_tables_list_${year}`, null);
    if (!tables || !Array.isArray(tables)) {
        tables = [];
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

    if (tablesList.length === 0) {
        container.innerHTML = `
            <div style="overflow-x:auto; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px;">
                <div style="padding:48px 20px; text-align:center; color:var(--text-muted);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom:12px; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:6px;">Nessuna Tabella Obiettivi</h3>
                    <p style="font-size:0.85rem; margin-bottom:18px;">Crea una nuova tabella obiettivi sales configurando collaboratori, prodotti e target.</p>
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

    if (!tablesList.some(t => t.id === activeSalesTableId)) {
        activeSalesTableId = tablesList[0].id;
    }

    const currentTableObj = tablesList.find(t => t.id === activeSalesTableId) || tablesList[0];

    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const collabWorkPcts = (await appDb.getSetting('collab_work_pcts', {})) || {};

    let products = await appDb.getSetting(`sales_table_products_${activeSalesTableId}`, null);
    if (!products || !Array.isArray(products)) {
        products = [];
        await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, products);
    }

    const savedTargets = (await appDb.getSetting(`sales_table_targets_${year}_${activeSalesTableId}`, {})) || {};
    const manualCollabs = (await appDb.getSetting(`sales_table_collabs_${year}_${activeSalesTableId}`, null)) || null;

    // Collaboratori per la tabella attiva
    const empSet = new Set();
    if (manualCollabs && Array.isArray(manualCollabs)) {
        manualCollabs.forEach(n => empSet.add(n));
    } else {
        const skillFilter = currentTableObj.skill || 'ALL';
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

    const tableSelectOpts = tablesList.map(t => `<option value="${t.id}" ${t.id === activeSalesTableId ? 'selected' : ''}>${t.name}</option>`).join('');

    const skillOptsHtml = `
        <option value="ALL" ${currentTableObj.skill === 'ALL' ? 'selected' : ''}>Tutte le Skill</option>
        ${configuredSkills.map(s => `<option value="${s}" ${currentTableObj.skill === s ? 'selected' : ''}>${s}</option>`).join('')}
    `;

    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${tablesList.length > 0 ? tablesList.map(t => `
                    <button class="table-tab-btn ${t.id === activeSalesTableId ? 'active' : ''}" data-id="${t.id}" style="padding:6px 14px; border-radius:8px; border:1px solid ${t.id === activeSalesTableId ? 'var(--primary)' : 'var(--border)'}; background:${t.id === activeSalesTableId ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)'}; color:${t.id === activeSalesTableId ? 'var(--primary)' : 'var(--text-main)'}; font-weight:700; font-size:0.85rem; cursor:pointer;">
                        ${t.name}
                    </button>
                `).join('') : ''}
                <button class="btn primary btn-sm" id="create-new-table-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; border-radius:8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Aggiungi Tabella Obiettivi
                </button>
            </div>
            ${employees.length > 0 ? `
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button class="btn secondary btn-sm" id="add-collab-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        + Collaboratore
                    </button>
                    <button class="btn secondary btn-sm" id="calc-work-pct-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem;">
                        Calcola da % Lavoro
                    </button>
                    <button class="btn primary btn-sm" id="save-sales-table-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem;">
                        Salva Obiettivi
                    </button>
                    <button class="btn secondary btn-sm" id="delete-current-table-btn" title="Elimina questa tabella" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem; color:#ef4444; border-color:rgba(239,68,68,0.3); padding:5px 8px;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            ` : ''}
        </div>

        <div style="overflow-x:auto; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px;">
            ${employees.length === 0 ? `
                <div style="padding:48px 20px; text-align:center; color:var(--text-muted);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom:12px; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:6px;">Nessuna Tabella Obiettivi</h3>
                    <p style="font-size:0.85rem; margin-bottom:18px;">Crea una nuova tabella obiettivi sales configurando collaboratori, prodotti e target.</p>
                    <button class="btn primary" id="empty-add-table-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:8px 18px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Aggiungi Tabella Obiettivi
                    </button>
                </div>
            ` : `
                <table class="sales-goals-table" style="width:auto; border-collapse:collapse; font-size:0.85rem; color:var(--text-main);">
                    <thead>
                        <tr style="background:var(--bg-base); border-bottom:2px solid var(--border);">
                            <th style="padding:12px; text-align:left; border-right:1px solid var(--border); width:200px; min-width:180px; font-weight:700;">Collaboratore</th>
                            <th style="padding:12px 8px; text-align:center; border-right:1px solid var(--border); width:90px; font-weight:700;">% Lavoro</th>
                            ${products.map((p, idx) => `
                                <th style="padding:10px 12px; text-align:center; border-right:1px solid var(--border); font-weight:700; font-size:0.88rem; background:rgba(59,130,246,0.06); width:140px; min-width:140px; position:relative;">
                                    <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                                        <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; width:100%;">
                                            <input type="text" class="header-col-label-input" data-idx="${idx}" value="${p.label}" style="background:transparent; border:1px solid transparent; color:inherit; font-weight:700; text-align:center; font-size:0.88rem; flex:1; border-radius:4px; padding:2px;" onfocus="this.style.background='var(--bg-base)'; this.style.borderColor='var(--primary)';" onblur="this.style.background='transparent'; this.style.borderColor='transparent';">
                                            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                                                <button class="edit-col-btn" data-idx="${idx}" title="Modifica Colonna" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:3px; display:inline-flex; align-items:center; border-radius:4px;" onmouseover="this.style.color='var(--primary)';" onmouseout="this.style.color='var(--text-muted)';">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                                </button>
                                                <button class="delete-col-btn" data-idx="${idx}" title="Elimina Colonna" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:3px; display:inline-flex; align-items:center; border-radius:4px; opacity:0.8;" onmouseover="this.style.opacity='1';" onmouseout="this.style.opacity='0.8';">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span class="toggle-mode-btn" data-idx="${idx}" title="Clicca per cambiare modalità" style="cursor:pointer; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:600; ${p.mode === 'team' ? 'background:rgba(99,102,241,0.25); color:var(--primary); border:1px solid rgba(99,102,241,0.4);' : 'background:rgba(16,185,129,0.25); color:#10b981; border:1px solid rgba(16,185,129,0.4);'}">
                                                ${p.mode === 'team' ? 'TEAM' : 'INDIV.'}
                                            </span>
                                            <span class="toggle-chf-btn" data-idx="${idx}" title="Clicca per cambiare tipo di valore" style="cursor:pointer; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:600; background:rgba(255,255,255,0.06); border:1px solid var(--border); color:var(--text-muted);">
                                                ${p.isCHF ? 'CHF' : 'Qtà'}
                                            </span>
                                        </div>
                                    </div>
                                </th>
                            `).join('')}
                            <th style="padding:6px; text-align:center; width:55px; min-width:55px; background:rgba(99,102,241,0.05); border-right:1px solid var(--border);">
                                <button class="btn primary" id="add-table-col-header-btn" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; font-weight:700; cursor:pointer; margin:0 auto;" title="Aggiungi Obiettivo">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody id="sales-goals-tbody"></tbody>
                    <tfoot id="sales-goals-tfoot" style="border-top:2px solid var(--border); background:var(--bg-base);"></tfoot>
                </table>
            `}
        </div>
    `;

    // Event handlers for Table tabs
    container.querySelectorAll('.table-tab-btn').forEach(btn => {
        btn.onclick = () => {
            activeSalesTableId = btn.dataset.id;
            renderSalesGoalsTable();
        };
    });

    ['#create-new-table-btn', '#empty-add-table-btn'].forEach(selector => {
        const btn = container.querySelector(selector);
        if (btn) {
            btn.onclick = () => {
                openCreateNewTableModal(year, configuredSkills, tablesList);
            };
        }
    });

    const deleteTabBtn = container.querySelector('#delete-current-table-btn');
    if (deleteTabBtn) {
        deleteTabBtn.onclick = async () => {
            if (!confirm(`Sei sicuro di voler eliminare la tabella "${currentTableObj.name}"?`)) return;

            // Rimuovi impostazioni salvate per questa tabella
            await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, []);
            await appDb.setSetting(`sales_table_targets_${year}_${activeSalesTableId}`, {});
            await appDb.setSetting(`sales_table_collabs_${year}_${activeSalesTableId}`, []);

            const idx = tablesList.findIndex(t => t.id === activeSalesTableId);
            if (idx !== -1) tablesList.splice(idx, 1);
            await appDb.setSetting(`sales_tables_list_${year}`, tablesList);

            if (tablesList.length > 0) {
                activeSalesTableId = tablesList[0].id;
            } else {
                activeSalesTableId = null;
            }

            renderSalesGoalsTable();
        };
    }

    const skillSelect = container.querySelector('#sales-skill-select');
    if (skillSelect) {
        skillSelect.onchange = async (e) => {
            currentTableObj.skill = e.target.value;
            await appDb.setSetting(`sales_tables_list_${year}`, tablesList);
            renderSalesGoalsTable();
        };
    }

    // Direct Header Editing Listeners
    container.querySelectorAll('.edit-col-btn').forEach(btn => {
        btn.onclick = (e) => {
            openManageProductsModal(products);
        };
    });

    container.querySelectorAll('.header-col-label-input').forEach(inp => {
        inp.onchange = async (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (products[idx]) {
                products[idx].label = e.target.value.trim() || products[idx].key;
                await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, products);
            }
        };
    });

    container.querySelectorAll('.delete-col-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (products[idx]) {
                products.splice(idx, 1);
                await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, products);
                renderSalesGoalsTable();
            }
        };
    });

    container.querySelectorAll('.toggle-mode-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (products[idx]) {
                products[idx].mode = products[idx].mode === 'team' ? 'individual' : 'team';
                await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, products);
                renderSalesGoalsTable();
            }
        };
    });

    container.querySelectorAll('.toggle-chf-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (products[idx]) {
                products[idx].isCHF = !products[idx].isCHF;
                await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, products);
                renderSalesGoalsTable();
            }
        };
    });

    const addColHeaderBtn = container.querySelector('#add-table-col-header-btn');
    if (addColHeaderBtn) {
        addColHeaderBtn.onclick = async () => {
            const newIdx = products.length;
            const newKey = 'Obiettivo_' + Date.now();
            products.push({
                key: newKey,
                label: 'Nuovo Obiettivo',
                mappedMetric: '',
                isCHF: false,
                mode: 'individual'
            });
            await appDb.setSetting(`sales_table_products_${activeSalesTableId}`, products);
            await renderSalesGoalsTable();

            setTimeout(() => {
                const newInp = container.querySelector(`.header-col-label-input[data-idx="${newIdx}"]`);
                if (newInp) {
                    newInp.focus();
                    newInp.select();
                }
            }, 50);
        };
    }

    const addCollabBtn = container.querySelector('#add-collab-btn') || container.querySelector('#empty-add-collab-btn');
    if (addCollabBtn) {
        addCollabBtn.onclick = () => openAddCollaboratorModal(employees, year, activeSalesTableId);
    }

    const calcBtn = container.querySelector('#calc-work-pct-btn');
    if (calcBtn) {
        calcBtn.onclick = () => openCalcByWorkPctModal(products, employees, year, activeSalesTableId);
    }

    const saveBtn = container.querySelector('#save-sales-table-btn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            await saveSalesTableData(container, products, employees, year, activeSalesTableId);
            alert('Obiettivi salvati con successo!');
            await renderSalesGoalsTable();
            if (window.renderStatistics) window.renderStatistics();
        };
    }

    if (employees.length > 0) {
        buildTableBodyAndFoot(container, products, employees, savedTargets, collabWorkPcts);
    }
}

function buildTableBodyAndFoot(container, products, employees, savedTargets, collabWorkPcts) {
    const tbody = container.querySelector('#sales-goals-tbody');
    const tfoot = container.querySelector('#sales-goals-tfoot');
    if (!tbody || !tfoot) return;

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    const productTargetTotals = {};
    products.forEach(p => {
        productTargetTotals[p.key] = 0;
    });

    let totalWorkPctSum = 0;

    employees.forEach(emp => {
        const empWorkPct = collabWorkPcts[emp] ?? 100;
        totalWorkPctSum += empWorkPct;
        const displayName = window.getDisplayName(emp);

        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom:1px solid var(--border);';

        let rowHtml = `
            <td style="padding:10px 12px; font-weight:600; border-right:1px solid var(--border); white-space:nowrap;">
                ${displayName}
            </td>
            <td style="padding:6px; text-align:center; border-right:1px solid var(--border);">
                <input type="number" class="collab-work-pct-input" data-emp="${emp}" value="${empWorkPct}" min="0" max="200" style="width:55px; text-align:center; padding:4px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-weight:600; font-size:0.8rem;">%
            </td>
        `;

        products.forEach(p => {
            const targetVal = savedTargets[emp + '_' + p.key] ?? 0;
            productTargetTotals[p.key] += targetVal;

            rowHtml += `
                <td style="padding:6px; text-align:center; border-right:1px solid var(--border);">
                    <input type="number" step="any" class="sales-target-input" data-emp="${emp}" data-key="${p.key}" value="${targetVal || ''}" placeholder="0" style="width:90px; text-align:center; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-weight:700; font-size:0.88rem;">
                </td>
            `;
        });

        rowHtml += `<td></td>`; // empty cell for action column
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    // RIGA TOTALI TEAM OBIETTIVI
    const teamTr = document.createElement('tr');
    teamTr.style.cssText = 'background:var(--bg-base); font-weight:700; border-top:2px solid var(--border);';
    let teamHtml = `
        <td style="padding:12px; border-right:1px solid var(--border); font-weight:800; color:var(--primary);">TOTALI OBIETTIVI TEAM</td>
        <td style="padding:12px 8px; text-align:center; border-right:1px solid var(--border); font-weight:800;">${totalWorkPctSum}%</td>
    `;

    products.forEach(p => {
        const tgtTot = productTargetTotals[p.key];
        const formatVal = (v) => {
            if (p.isCHF) return Math.round(v).toLocaleString('de-CH') + '.-';
            return Number.isInteger(v) ? v.toString() : v.toFixed(1);
        };

        teamHtml += `
            <td style="padding:12px 8px; text-align:center; border-right:1px solid var(--border); font-weight:800; font-size:0.95rem; color:var(--text-main);">
                ${formatVal(tgtTot)}
            </td>
        `;
    });
    teamHtml += `<td></td>`;
    teamTr.innerHTML = teamHtml;
    tfoot.appendChild(teamTr);
}

async function saveSalesTableData(container, products, employees, year, activeSkillFilter) {
    const collabWorkPcts = {};
    const savedTargets = {};

    container.querySelectorAll('.collab-work-pct-input').forEach(inp => {
        const emp = inp.dataset.emp;
        const val = parseFloat(inp.value) || 100;
        collabWorkPcts[emp] = val;
    });

    container.querySelectorAll('.sales-target-input').forEach(inp => {
        const emp = inp.dataset.emp;
        const key = inp.dataset.key;
        const val = parseFloat(inp.value) || 0;
        savedTargets[emp + '_' + key] = val;
    });

    await appDb.setSetting('collab_work_pcts', collabWorkPcts);
    await appDb.setSetting(`sales_table_targets_${year}_${activeSkillFilter}`, savedTargets);

    // Sincronizza lo store 'goals' IndexedDB
    const goalsToSave = [];
    employees.forEach(emp => {
        products.forEach(p => {
            const tgt = savedTargets[emp + '_' + p.key];
            if (tgt && tgt > 0) {
                goalsToSave.push({
                    id: `salestable_${year}_${activeSkillFilter}_${emp}_${p.key}`,
                    metric: `Sales: ${p.key}`,
                    skill: activeSkillFilter,
                    employee: emp,
                    target: tgt,
                    year: year
                });
            }
        });
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
            const mappedMetric = p.mappedMetric || p.key;
            const mode = p.mode || 'individual';
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; flex-wrap:wrap;';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:220px;">
                    <input type="text" class="prod-label-input" data-idx="${idx}" value="${p.label}" style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-weight:600; font-size:0.88rem; width:130px;">
                    <select class="prod-metric-select" data-idx="${idx}" style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.8rem; flex:1;">
                        ${availableMetrics.map(m => `<option value="${m}" ${m === mappedMetric ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
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
        modal.querySelectorAll('.prod-metric-select').forEach(sel => {
            const idx = parseInt(sel.dataset.idx, 10);
            if (activeProds[idx]) activeProds[idx].mappedMetric = sel.value;
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
            <h2 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">Crea Nuova Tabella Obiettivi Sales</h2>
            <button class="close-modal" id="close-create-tab-modal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; max-height:68vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px;">
            <div>
                <label style="font-size:0.85rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:4px;">Nome Tabella:</label>
                <input type="text" id="new-table-name-input" placeholder="es. Obiettivi Sales 2026 Wireline" style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-weight:600; font-size:0.88rem;">
            </div>

            <div>
                <label style="font-size:0.85rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:4px;">Skill Associata:</label>
                <select id="new-table-skill-select" style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-size:0.88rem;">
                    <option value="ALL">Tutte le Skill</option>
                    ${configuredSkills.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--border);">
            <button class="btn secondary" id="cancel-create-tab-btn">Annulla</button>
            <button class="btn primary" id="confirm-create-tab-btn">Crea Tabella</button>
        </div>
    `;

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    modal.querySelector('#close-create-tab-modal').onclick = closeModal;
    modal.querySelector('#cancel-create-tab-btn').onclick = closeModal;

    modal.querySelector('#confirm-create-tab-btn').onclick = async () => {
        const name = modal.querySelector('#new-table-name-input').value.trim();
        const skill = modal.querySelector('#new-table-skill-select').value;

        if (!name) {
            alert('Inserisci un nome per la tabella.');
            return;
        }

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
