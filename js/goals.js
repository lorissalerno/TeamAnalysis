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
        
        const year = window.appState.activeYear;
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

async function renderSalesGoalsTable() {
    const container = document.getElementById('goals-sales-table-container');
    if (!container) return;

    const year = window.appState.activeYear;
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const configuredSkills = (await appDb.getSetting('skills', [])) || [];
    const collabWorkPcts = (await appDb.getSetting('collab_work_pcts', {})) || {};

    let products = await appDb.getSetting('sales_table_products', null);
    if (!products || !Array.isArray(products) || products.length === 0) {
        products = [
            { key: 'AOIT', label: 'AOIT', isCHF: true },
            { key: 'My Service', label: 'My Service', isCHF: false },
            { key: 'My Security M+L', label: 'My Security M+L', isCHF: false },
            { key: 'RET', label: 'RET', isCHF: false },
            { key: 'MOBILE', label: 'MOBILE', isCHF: false },
            { key: 'INTERNET', label: 'INTERNET', isCHF: false },
            { key: 'TV', label: 'TV', isCHF: false }
        ];
        await appDb.setSetting('sales_table_products', products);
    }

    const savedTargets = (await appDb.getSetting(`sales_table_targets_${year}_${activeSalesSkillFilter}`, {})) || {};

    // Collaboratori attivi per l'anno e skill selezionata
    const empSet = new Set();
    perfData.forEach(d => {
        if (d.employee && (activeSalesSkillFilter === 'ALL' || d.skill === activeSalesSkillFilter)) {
            empSet.add(d.employee);
        }
    });
    salesData.forEach(d => {
        if (d.employee && (activeSalesSkillFilter === 'ALL' || d.skill === activeSalesSkillFilter)) {
            empSet.add(d.employee);
        }
    });

    if (empSet.size === 0) {
        Object.keys(window.appState.anonymousMap || {}).forEach(n => empSet.add(n));
    }

    const employees = Array.from(empSet).sort();

    const skillOptsHtml = `
        <option value="ALL" ${activeSalesSkillFilter === 'ALL' ? 'selected' : ''}>Tutte le Skill</option>
        ${configuredSkills.map(s => `<option value="${s}" ${activeSalesSkillFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
    `;

    container.innerHTML = `
        <div class="card" style="padding:16px 20px; margin-bottom:16px; border-radius:var(--radius); background:var(--bg-surface); border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <h2 style="font-size:1.15rem; font-weight:700; color:var(--text-main); margin:0;">AOIT – OBIETTIVI INDIVIDUALI FOCUS (${year})</h2>
                    <span style="font-size:0.75rem; padding:2px 8px; border-radius:12px; background:var(--accent-muted); color:var(--primary); font-weight:600; border:1px solid rgba(59,130,246,0.3);">
                        Skill: ${activeSalesSkillFilter === 'ALL' ? 'Tutte' : activeSalesSkillFilter}
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                        Skill:
                        <select id="sales-skill-select" style="padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-size:0.8rem;">
                            ${skillOptsHtml}
                        </select>
                    </label>
                    <button class="btn secondary btn-sm" id="calc-work-pct-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        Calcola da % Lavoro
                    </button>
                    <button class="btn secondary btn-sm" id="manage-products-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        Gestisci Prodotti
                    </button>
                    <button class="btn primary btn-sm" id="save-sales-table-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Salva Obiettivi
                    </button>
                </div>
            </div>
        </div>

        <div style="overflow-x:auto; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px;">
            <table class="sales-goals-table" style="width:100%; border-collapse:collapse; font-size:0.83rem; color:var(--text-main);">
                <thead>
                    <tr style="background:var(--bg-base); border-bottom:2px solid var(--border);">
                        <th rowspan="2" style="padding:10px 12px; text-align:left; border-right:1px solid var(--border); min-width:150px; font-weight:700;">Collaboratore</th>
                        <th rowspan="2" style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); width:75px; font-weight:700;">% Lavoro</th>
                        ${products.map(p => `<th colspan="2" style="padding:8px 10px; text-align:center; border-right:1px solid var(--border); font-weight:700; font-size:0.88rem; background:rgba(59,130,246,0.06);">${p.label}</th>`).join('')}
                    </tr>
                    <tr style="background:var(--bg-base); border-bottom:1px solid var(--border); font-size:0.72rem;">
                        ${products.map(p => `
                            <th style="padding:6px 8px; text-align:center; border-right:1px dashed var(--border); color:var(--text-muted); width:75px;">CURRENT</th>
                            <th style="padding:6px 8px; text-align:center; border-right:1px solid var(--border); color:var(--text-muted); width:85px;">TARGET</th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody id="sales-goals-tbody"></tbody>
                <tfoot id="sales-goals-tfoot" style="border-top:2px solid var(--border); background:var(--bg-base);"></tfoot>
            </table>

            <!-- Legenda Stato -->
            <div style="display:flex; align-items:center; justify-content:flex-end; gap:14px; margin-top:16px; font-size:0.78rem; flex-wrap:wrap; padding-top:10px; border-top:1px solid var(--border);">
                <span style="font-weight:600; color:var(--text-muted);">Legenda Stato:</span>
                <span style="padding:3px 10px; border-radius:12px; background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:600;">Manca (&lt; 70%)</span>
                <span style="padding:3px 10px; border-radius:12px; background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); font-weight:600;">Quasi raggiunto (70% - 99%)</span>
                <span style="padding:3px 10px; border-radius:12px; background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-weight:600;">Raggiunto (100% - 110%)</span>
                <span style="padding:3px 10px; border-radius:12px; background:rgba(168,85,247,0.2); color:#a855f7; border:1px solid rgba(168,85,247,0.3); font-weight:600;">Superato (&gt; 110%)</span>
            </div>
        </div>
    `;

    const skillSelect = container.querySelector('#sales-skill-select');
    if (skillSelect) {
        skillSelect.onchange = (e) => {
            activeSalesSkillFilter = e.target.value;
            renderSalesGoalsTable();
        };
    }

    const calcBtn = container.querySelector('#calc-work-pct-btn');
    if (calcBtn) {
        calcBtn.onclick = () => openCalcByWorkPctModal(products, employees, year, activeSalesSkillFilter);
    }

    const manageBtn = container.querySelector('#manage-products-btn');
    if (manageBtn) {
        manageBtn.onclick = () => openManageProductsModal(products);
    }

    const saveBtn = container.querySelector('#save-sales-table-btn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            await saveSalesTableData(container, products, employees, year, activeSalesSkillFilter);
            alert('Obiettivi salvati con successo!');
            await renderSalesGoalsTable();
            if (window.renderStatistics) window.renderStatistics();
        };
    }

    buildTableBodyAndFoot(container, products, employees, salesData, perfData, savedTargets, collabWorkPcts, activeSalesSkillFilter);
}

function getCellStatusStyle(current, target) {
    if (!target || target <= 0) return 'background:transparent; color:var(--text-main);';
    const pct = (current / target) * 100;
    if (pct < 70) {
        return 'background:rgba(239, 68, 68, 0.15); color:#ef4444; font-weight:700;';
    } else if (pct < 100) {
        return 'background:rgba(245, 158, 11, 0.2); color:#f59e0b; font-weight:700;';
    } else if (pct <= 110) {
        return 'background:rgba(16, 185, 129, 0.2); color:#10b981; font-weight:700;';
    } else {
        return 'background:rgba(168, 85, 247, 0.2); color:#a855f7; font-weight:700;';
    }
}

function getCollaboratorProductCurrent(emp, prodKey, salesData, perfData, skillFilter) {
    let total = 0;
    const keyLower = prodKey.toLowerCase();

    salesData.forEach(r => {
        if (r.employee !== emp || !r.data) return;
        if (skillFilter && skillFilter !== 'ALL' && r.skill && r.skill !== skillFilter) return;

        let val = 0;
        if (keyLower.includes('aoit')) {
            val = parseMetricValue(r.data['AOIT gew'] ?? r.data['AOIT (CHF)'] ?? r.data['AOIT'] ?? (r.data.Product === 'AOIT gew' ? r.data.Value : 0));
        } else if (keyLower.includes('my service')) {
            val = parseMetricValue(r.data['My Service'] ?? (r.data.Product === 'My Service' ? r.data.Value : 0));
        } else if (keyLower.includes('my security')) {
            val = parseMetricValue(r.data['My Security M+L'] ?? r.data['My Security'] ?? (r.data.Product && r.data.Product.includes('Security') ? r.data.Value : 0));
        } else if (keyLower.includes('ret')) {
            val = parseMetricValue(r.data['Retention'] ?? r.data['RET'] ?? (r.data.Product === 'Retention' ? r.data.Value : 0));
        } else if (keyLower.includes('mobile')) {
            val = parseMetricValue(r.data['Mobile'] ?? r.data['MOBILE'] ?? (r.data.Product === 'Mobile' ? r.data.Value : 0));
        } else if (keyLower.includes('internet')) {
            val = parseMetricValue(r.data['Internet'] ?? r.data['INTERNET'] ?? (r.data.Product === 'Internet' ? r.data.Value : 0));
        } else if (keyLower.includes('tv')) {
            val = parseMetricValue(r.data['TV'] ?? (r.data.Product === 'TV' ? r.data.Value : 0));
        } else {
            val = parseMetricValue(r.data[prodKey] ?? 0);
        }

        if (val) total += val;
    });

    if (total === 0) {
        perfData.forEach(r => {
            if (r.employee !== emp || !r.data) return;
            if (skillFilter && skillFilter !== 'ALL' && r.skill && r.skill !== skillFilter) return;
            const val = parseMetricValue(r.data[prodKey] ?? 0);
            if (val) total += val;
        });
    }

    return total;
}

function buildTableBodyAndFoot(container, products, employees, salesData, perfData, savedTargets, collabWorkPcts, activeSkillFilter) {
    const tbody = container.querySelector('#sales-goals-tbody');
    const tfoot = container.querySelector('#sales-goals-tfoot');
    if (!tbody || !tfoot) return;

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    const productCurrentTotals = {};
    const productTargetTotals = {};
    products.forEach(p => {
        productCurrentTotals[p.key] = 0;
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
            const currentVal = getCollaboratorProductCurrent(emp, p.key, salesData, perfData, activeSkillFilter);
            const targetVal = savedTargets[emp + '_' + p.key] ?? 0;

            productCurrentTotals[p.key] += currentVal;
            productTargetTotals[p.key] += targetVal;

            const formatVal = (v) => {
                if (p.isCHF) return v > 0 ? Math.round(v).toLocaleString('de-CH') + '.-' : '0.-';
                return Number.isInteger(v) ? v.toString() : v.toFixed(1);
            };

            const statusStyle = getCellStatusStyle(currentVal, targetVal);

            rowHtml += `
                <td style="padding:8px; text-align:center; border-right:1px dashed var(--border); ${statusStyle}">
                    ${formatVal(currentVal)}
                </td>
                <td style="padding:6px; text-align:center; border-right:1px solid var(--border); ${statusStyle}">
                    <input type="number" step="any" class="sales-target-input" data-emp="${emp}" data-key="${p.key}" value="${targetVal || ''}" placeholder="0" style="width:65px; text-align:center; padding:4px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:inherit; font-weight:bold; font-size:0.82rem;">
                </td>
            `;
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    // RIGA TOTALI TEAM
    const teamTr = document.createElement('tr');
    teamTr.style.cssText = 'background:var(--bg-base); font-weight:700; border-top:2px solid var(--border);';
    let teamHtml = `
        <td style="padding:10px 12px; border-right:1px solid var(--border); font-weight:700;">TOTALI TEAM</td>
        <td style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); font-weight:700;">${totalWorkPctSum}%</td>
    `;

    products.forEach(p => {
        const curTot = productCurrentTotals[p.key];
        const tgtTot = productTargetTotals[p.key];
        const formatVal = (v) => {
            if (p.isCHF) return Math.round(v).toLocaleString('de-CH') + '.-';
            return Number.isInteger(v) ? v.toString() : v.toFixed(1);
        };

        const statusStyle = getCellStatusStyle(curTot, tgtTot);

        teamHtml += `
            <td style="padding:10px 8px; text-align:center; border-right:1px dashed var(--border); ${statusStyle}">${formatVal(curTot)}</td>
            <td style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); ${statusStyle}">${formatVal(tgtTot)}</td>
        `;
    });
    teamTr.innerHTML = teamHtml;
    tfoot.appendChild(teamTr);

    // RIGA PERCENTUALE RAGGIUNTA TEAM
    const pctTr = document.createElement('tr');
    pctTr.style.cssText = 'background:var(--bg-base); font-weight:800; border-top:1px solid var(--border);';
    let pctHtml = `
        <td colspan="2" style="padding:10px 12px; text-align:right; border-right:1px solid var(--border); color:var(--primary); font-weight:800;">
            % Raggiunto Team
        </td>
    `;

    products.forEach(p => {
        const curTot = productCurrentTotals[p.key];
        const tgtTot = productTargetTotals[p.key];
        const pct = tgtTot > 0 ? Math.round((curTot / tgtTot) * 100) : 0;
        const statusStyle = getCellStatusStyle(curTot, tgtTot);

        pctHtml += `
            <td colspan="2" style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); ${statusStyle} font-size:0.92rem;">
                ${pct}%
            </td>
        `;
    });
    pctTr.innerHTML = pctHtml;
    tfoot.appendChild(pctTr);
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

    // Sincronizza lo store 'goals' IndexedDB per aggiornare anche le altre schermate
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
        modal.style.cssText = 'max-width: 520px; width: 92%; border-radius: 12px;';
        document.body.appendChild(modal);
    }

    const overlay = document.getElementById('modal-overlay');

    modal.innerHTML = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border);">
            <h2 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">Gestisci Colonne Prodotti Vendita</h2>
            <button class="close-modal" id="close-prod-modal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; max-height:65vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px;">
            <div id="manage-prods-list" style="display:flex; flex-direction:column; gap:8px;"></div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <input type="text" id="new-prod-name" placeholder="Nome nuovo prodotto (es. Nuovi Abo)" style="flex:1; padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main); font-size:0.85rem;">
                <label style="display:flex; align-items:center; gap:4px; font-size:0.8rem; color:var(--text-muted); cursor:pointer;">
                    <input type="checkbox" id="new-prod-chf"> Valore in CHF
                </label>
                <button class="btn secondary" id="add-prod-item-btn" style="padding:6px 12px; font-size:0.8rem;">+ Aggiungi</button>
            </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--border);">
            <button class="btn secondary" id="cancel-prod-btn">Annulla</button>
            <button class="btn primary" id="save-prod-btn">Salva Colonne</button>
        </div>
    `;

    let activeProds = JSON.parse(JSON.stringify(currentProducts));

    const renderProdList = () => {
        const listDiv = modal.querySelector('#manage-prods-list');
        listDiv.innerHTML = '';
        activeProds.forEach((p, idx) => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; background:var(--bg-base); border:1px solid var(--border); border-radius:6px;';
            div.innerHTML = `
                <span style="font-weight:600; font-size:0.88rem; color:var(--text-main);">${p.label} ${p.isCHF ? '(CHF)' : ''}</span>
                <button class="btn secondary" style="padding:3px 8px; font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="removeProductItem(${idx})">Rimuovi</button>
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
        const input = modal.querySelector('#new-prod-name');
        const name = input ? input.value.trim() : '';
        const isCHF = modal.querySelector('#new-prod-chf').checked;
        if (!name) return;
        activeProds.push({ key: name, label: name, isCHF });
        input.value = '';
        renderProdList();
    };

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    modal.querySelector('#close-prod-modal').onclick = closeModal;
    modal.querySelector('#cancel-prod-btn').onclick = closeModal;

    modal.querySelector('#save-prod-btn').onclick = async () => {
        await appDb.setSetting('sales_table_products', activeProds);
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
    const year = window.appState.activeYear;
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
        year: window.appState.activeYear
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
