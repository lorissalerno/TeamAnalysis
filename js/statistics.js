// Plugin per aggiungere spaziatura sotto la legenda del grafico
const legendMarginPlugin = {
    id: 'legendMarginPlugin',
    afterFit(legend) {
        if (legend.options && legend.options.display) {
            legend.height += 20;
        }
    }
};

// Plugin globale per estendere la linea dell'obiettivo viola da estremo a estremo (sinistra a destra)
const fullWidthGoalPlugin = {
    id: 'fullWidthGoalPlugin',
    afterDatasetsDraw(chart) {
        try {
            const goalConfig = chart.options && chart.options.plugins && chart.options.plugins.fullWidthGoal;
            if (!goalConfig || goalConfig.target === undefined || goalConfig.target === null) return;
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const y = chart.scales ? chart.scales.y : null;
            if (!ctx || !chartArea || !y) return;

            const left = chartArea.left;
            const right = chartArea.right;

            ctx.save();

            // Linea Obiettivo Viola
            const yTarget = y.getPixelForValue(goalConfig.target);
            if (!isNaN(yTarget)) {
                ctx.beginPath();
                ctx.setLineDash([]);
                ctx.strokeStyle = '#9333EA';
                ctx.lineWidth = 2;
                ctx.moveTo(left, yTarget);
                ctx.lineTo(right, yTarget);
                ctx.stroke();
            }

            ctx.restore();
        } catch (e) {
            console.error('Goal plugin error:', e);
        }
    }
};

// Helper for templates
// Helper for templates
async function getTemplates() {
    let tpls = await appDb.getSetting('stat_templates', null);
    if (!tpls || !Array.isArray(tpls) || tpls.length === 0) {
        tpls = [{ id: 'default', name: 'Default' }];
        await appDb.setSetting('stat_templates', tpls);
    }
    return tpls;
}

async function getActiveTemplateId() {
    let activeId = await appDb.getSetting('active_stat_template', null);
    const tpls = await getTemplates();
    if (!activeId || !tpls.find(t => t.id === activeId)) {
        activeId = tpls[0].id;
        await appDb.setSetting('active_stat_template', activeId);
    }
    return activeId;
}

async function duplicateTemplate(templateId) {
    const tpls = await getTemplates();
    const source = tpls.find(t => t.id === templateId);
    if (!source) return;

    const newId = 'tpl_' + Date.now();
    const newName = source.name + ' (Copia)';
    tpls.push({ id: newId, name: newName });
    await appDb.setSetting('stat_templates', tpls);

    // Copy all custom_stats of source template
    const allStats = await appDb.getAll('custom_stats');
    const sourceStats = allStats.filter(s => s.templateId === templateId || (!s.templateId && templateId === 'default'));
    const newStats = sourceStats.map((s, index) => {
        const cloned = { ...s };
        cloned.id = 'stat_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substring(2, 6);
        cloned.templateId = newId;
        return cloned;
    });

    if (newStats.length > 0) {
        await appDb.addMultiple('custom_stats', newStats);
    }

    await appDb.setSetting('active_stat_template', newId);
    await initTemplateControls();
    await renderStatistics();
    const modal = document.getElementById('templates-modal');
    if (modal && modal.classList.contains('open')) {
        await renderTemplatesModalList();
    }
}

async function renameTemplate(templateId, newName) {
    if (!newName || !newName.trim()) return;
    const cleanName = newName.trim();
    const tpls = await getTemplates();
    const target = tpls.find(t => t.id === templateId);
    if (!target) return;
    target.name = cleanName;
    await appDb.setSetting('stat_templates', tpls);
    await initTemplateControls();
    const modal = document.getElementById('templates-modal');
    if (modal && modal.classList.contains('open')) {
        await renderTemplatesModalList();
    }
}

async function deleteTemplate(templateId) {
    const tpls = await getTemplates();
    if (tpls.length <= 1) {
        alert("Impossibile eliminare l'unico template rimasto.");
        return;
    }
    const target = tpls.find(t => t.id === templateId);
    if (!target) return;

    if (!confirm(`Eliminare il template "${target.name}" e tutte le sue statistiche?`)) return;

    const allStats = await appDb.getAll('custom_stats');
    for (const s of allStats) {
        if (s.templateId === templateId || (!s.templateId && templateId === 'default')) {
            await appDb.deleteRecord('custom_stats', s.id);
        }
    }

    const remaining = tpls.filter(t => t.id !== templateId);
    await appDb.setSetting('stat_templates', remaining);

    const activeId = await getActiveTemplateId();
    if (activeId === templateId) {
        await appDb.setSetting('active_stat_template', remaining[0].id);
    }

    await initTemplateControls();
    await renderStatistics();
    const modal = document.getElementById('templates-modal');
    if (modal && modal.classList.contains('open')) {
        await renderTemplatesModalList();
    }
}

async function createNewTemplate(name) {
    let cleanName = name ? name.trim() : '';
    if (!cleanName) {
        const inputName = prompt('Nome del nuovo template:');
        if (!inputName || !inputName.trim()) return;
        cleanName = inputName.trim();
    }
    const currentTpls = await getTemplates();
    const newId = 'tpl_' + Date.now();
    currentTpls.push({ id: newId, name: cleanName });
    await appDb.setSetting('stat_templates', currentTpls);
    await appDb.setSetting('active_stat_template', newId);
    await initTemplateControls();
    await renderStatistics();
    const modal = document.getElementById('templates-modal');
    if (modal && modal.classList.contains('open')) {
        await renderTemplatesModalList();
    }
}

async function renderTemplatesModalList() {
    const container = document.getElementById('templates-list-container');
    if (!container) return;

    const tpls = await getTemplates();
    const activeId = await getActiveTemplateId();

    container.innerHTML = '';
    tpls.forEach(t => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:var(--bg-base); border:1px solid var(--border); border-radius:var(--radius);';

        const isCurrentActive = (t.id === activeId);

        const leftDiv = document.createElement('div');
        leftDiv.style.cssText = 'display:flex; align-items:center; gap:8px; flex:1;';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = t.name;
        input.className = 'template-name-input';
        input.dataset.id = t.id;
        input.style.cssText = 'padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.9rem; flex:1;';
        leftDiv.appendChild(input);

        if (isCurrentActive) {
            const badge = document.createElement('span');
            badge.style.cssText = 'font-size:0.75rem; background:var(--primary); color:#fff; padding:3px 8px; border-radius:12px; font-weight:600; white-space:nowrap;';
            badge.textContent = 'Attivo';
            leftDiv.appendChild(badge);
        } else {
            const actBtn = document.createElement('button');
            actBtn.className = 'btn secondary activate-tpl-btn';
            actBtn.dataset.id = t.id;
            actBtn.style.cssText = 'padding:4px 8px; font-size:0.8rem; white-space:nowrap;';
            actBtn.textContent = 'Attiva';
            leftDiv.appendChild(actBtn);
        }

        const rightDiv = document.createElement('div');
        rightDiv.style.cssText = 'display:flex; align-items:center; gap:6px;';

        const dupBtn = document.createElement('button');
        dupBtn.className = 'btn secondary duplicate-tpl-btn';
        dupBtn.dataset.id = t.id;
        dupBtn.title = 'Duplica Template';
        dupBtn.style.cssText = 'padding:6px 8px; display:inline-flex; align-items:center; gap:4px; font-size:0.8rem;';
        dupBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Duplica`;
        rightDiv.appendChild(dupBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn danger delete-tpl-btn';
        delBtn.dataset.id = t.id;
        delBtn.title = 'Elimina Template';
        if (tpls.length <= 1) {
            delBtn.disabled = true;
            delBtn.style.cssText = 'opacity:0.5; cursor:not-allowed; padding:6px 8px; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px;';
        } else {
            delBtn.style.cssText = 'padding:6px 8px; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px;';
        }
        delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Elimina`;
        rightDiv.appendChild(delBtn);

        item.appendChild(leftDiv);
        item.appendChild(rightDiv);
        container.appendChild(item);
    });

    container.querySelectorAll('.template-name-input').forEach(input => {
        const id = input.dataset.id;
        const saveName = async () => {
            const val = input.value.trim();
            if (val) {
                await renameTemplate(id, val);
            }
        };
        input.addEventListener('blur', saveName);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    });

    container.querySelectorAll('.activate-tpl-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await appDb.setSetting('active_stat_template', id);
            await initTemplateControls();
            await renderStatistics();
            await renderTemplatesModalList();
        });
    });

    container.querySelectorAll('.duplicate-tpl-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await duplicateTemplate(id);
        });
    });

    container.querySelectorAll('.delete-tpl-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await deleteTemplate(id);
        });
    });
}

function setupTemplatesModal() {
    const manageBtn = document.getElementById('manage-templates-btn');
    const modal = document.getElementById('templates-modal');
    const closeBtn = document.getElementById('close-templates-modal');
    const saveBtn = document.getElementById('save-templates-modal-btn');
    const addBtn = document.getElementById('modal-add-template-btn');
    const overlay = document.getElementById('modal-overlay');

    const openModal = async () => {
        if (!modal) return;
        await renderTemplatesModalList();
        modal.classList.add('open');
        if (overlay) overlay.classList.add('open');
    };

    const closeModal = () => {
        if (!modal) return;
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    if (manageBtn) {
        manageBtn.onclick = openModal;
    }
    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }
    if (saveBtn) {
        saveBtn.onclick = closeModal;
    }
    if (addBtn) {
        addBtn.onclick = async () => {
            await createNewTemplate();
        };
    }
}

async function initTemplateControls() {
    const select = document.getElementById('stat-template-select');
    const newBtn = document.getElementById('new-template-btn');
    const duplicateBtn = document.getElementById('duplicate-template-btn');
    const deleteBtn = document.getElementById('delete-template-btn');
    if (!select) return;

    const tpls = await getTemplates();
    const activeId = await getActiveTemplateId();

    select.innerHTML = '';
    tpls.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if (t.id === activeId) opt.selected = true;
        select.appendChild(opt);
    });

    select.onchange = async () => {
        await appDb.setSetting('active_stat_template', select.value);
        await renderStatistics();
    };

    if (newBtn) {
        newBtn.onclick = async () => {
            await createNewTemplate();
        };
    }

    if (duplicateBtn) {
        duplicateBtn.onclick = async () => {
            const currentId = await getActiveTemplateId();
            await duplicateTemplate(currentId);
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            const currentId = await getActiveTemplateId();
            await deleteTemplate(currentId);
        };
    }

    setupTemplatesModal();
}

// Team view mode: 'all' = tutti i collaboratori, 'avg' = solo media team
let teamViewMode = 'all';
let showTeamAvgInTeam = false;
let showTeamGoalInTeam = false;
let showIndividualTeamAvg = false;
let showIndividualTeamGoal = false;

// Initialize statistics module
document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('create-stat-btn');
    if(createBtn) {
        createBtn.addEventListener('click', openStatModal);
    }
    
    const reorderBtn = document.getElementById('reorder-stats-btn');
    if(reorderBtn) {
        reorderBtn.addEventListener('click', openReorderModal);
    }
    
    // Setup Individual Select change listener
    const indSelect = document.getElementById('individual-select');
    if(indSelect) {
        indSelect.addEventListener('change', renderIndividualStats);
    }

    const indAvgToggle = document.getElementById('show-team-avg-individual-toggle');
    if (indAvgToggle) {
        indAvgToggle.addEventListener('change', async (e) => {
            showIndividualTeamAvg = e.target.checked;
            await appDb.setSetting('stat_show_team_avg_ind', showIndividualTeamAvg);
            renderIndividualStats();
        });
    }

    const indGoalToggle = document.getElementById('show-team-goal-individual-toggle');
    if (indGoalToggle) {
        indGoalToggle.addEventListener('change', async (e) => {
            showIndividualTeamGoal = e.target.checked;
            await appDb.setSetting('stat_show_team_goal_ind', showIndividualTeamGoal);
            renderIndividualStats();
        });
    }

    const teamAvgToggle = document.getElementById('show-team-avg-team-toggle');
    if (teamAvgToggle) {
        teamAvgToggle.addEventListener('change', async (e) => {
            showTeamAvgInTeam = e.target.checked;
            await appDb.setSetting('stat_show_team_avg_team', showTeamAvgInTeam);
            renderTeamStats();
        });
    }

    const teamGoalToggle = document.getElementById('show-team-goal-team-toggle');
    if (teamGoalToggle) {
        teamGoalToggle.addEventListener('change', async (e) => {
            showTeamGoalInTeam = e.target.checked;
            await appDb.setSetting('stat_show_team_goal_team', showTeamGoalInTeam);
            renderTeamStats();
        });
    }

    // Setup Team view mode toggle
    const allBtn = document.getElementById('team-view-all-btn');
    const avgBtn = document.getElementById('team-view-avg-btn');
    if (allBtn && avgBtn) {
        allBtn.addEventListener('click', async () => {
            teamViewMode = 'all';
            await appDb.setSetting('stat_team_view_mode', 'all');
            allBtn.classList.add('active');
            avgBtn.classList.remove('active');
            renderTeamStats();
        });
        avgBtn.addEventListener('click', async () => {
            teamViewMode = 'avg';
            await appDb.setSetting('stat_team_view_mode', 'avg');
            avgBtn.classList.add('active');
            allBtn.classList.remove('active');
            renderTeamStats();
        });
    }

    // Setup search filter
    const searchInput = document.getElementById('stat-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            const container = document.getElementById('team-stats-container');
            if (!container) return;
            const cards = container.querySelectorAll('.stat-card');
            cards.forEach(card => {
                const text = (card.getAttribute('data-search-text') || '').toLowerCase();
                card.style.display = text.includes(query) || query === '' ? '' : 'none';
            });
        });
    }
    
    // We export a function to be called from app.js when year changes
    window.renderStatistics = async function() {
        await initTemplateControls();

        // Restore saved toggle states from IndexedDB
        showTeamAvgInTeam = await appDb.getSetting('stat_show_team_avg_team', false);
        showTeamGoalInTeam = await appDb.getSetting('stat_show_team_goal_team', false);
        showIndividualTeamAvg = await appDb.getSetting('stat_show_team_avg_ind', false);
        showIndividualTeamGoal = await appDb.getSetting('stat_show_team_goal_ind', false);
        teamViewMode = await appDb.getSetting('stat_team_view_mode', 'all');

        if (teamAvgToggle) teamAvgToggle.checked = showTeamAvgInTeam;
        if (teamGoalToggle) teamGoalToggle.checked = showTeamGoalInTeam;
        if (indAvgToggle) indAvgToggle.checked = showIndividualTeamAvg;
        if (indGoalToggle) indGoalToggle.checked = showIndividualTeamGoal;

        if (allBtn && avgBtn) {
            if (teamViewMode === 'avg') {
                avgBtn.classList.add('active');
                allBtn.classList.remove('active');
            } else {
                allBtn.classList.add('active');
                avgBtn.classList.remove('active');
            }
        }

        // Populate individual select
        const select = document.getElementById('individual-select');
        const currentVal = select.value;
        const placeholder = window.appState.isAnonymous ? 'Seleziona Collab...' : 'Seleziona Collaboratore...';
        select.innerHTML = `<option value="">${placeholder}</option>`;
        
        const names = Object.keys(window.appState.anonymousMap || {}).sort();
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name; // Always real name for Individual section as per spec interpretation
            if(name === currentVal) opt.selected = true;
            select.appendChild(opt);
        });
        
        await renderTeamStats();
        if (currentVal) await renderIndividualStats();
    };
});

const DISTINCT_COLORS = [
    '#2563EB', '#10B981', '#8B5CF6', '#F97316', 
    '#EC4899', '#06B6D4', '#F59E0B', '#EF4444', '#64748B'
];

let currentEditingStatId = null;

async function openStatModal(editingStat = null) {
    currentEditingStatId = editingStat ? editingStat.id : null;
    // 1. Gather all unique metrics from current year DB
    const year = window.appState.activeYear;
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    
    const metrics = new Set();
    perfData.forEach(d => Object.keys(d.data).forEach(k => metrics.add(`Performance: ${k}`)));
    salesData.forEach(d => {
        Object.keys(d.data).forEach(k => {
            if(k !== 'Product') metrics.add(`Sales: ${k}`);
        });
    });
    
    const tablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
    (tablesList || []).forEach(t => {
        metrics.add(`Tabella Obiettivi: ${t.name}`);
    });
    
    // Gather unique skills from performance
    const skills = new Set();
    perfData.forEach(d => { if (d.skill) skills.add(d.skill); });

    // 2. Show Modal
    let modal = document.getElementById('stat-config-modal');
    if (!modal) {
        modal = createStatModalHTML();
    }

    const modalTitle = modal.querySelector('.modal-header h2');
    const saveBtn = modal.querySelector('.modal-footer .btn.primary');
    if (editingStat) {
        if (modalTitle) modalTitle.textContent = 'Modifica Statistica';
        if (saveBtn) saveBtn.textContent = 'Salva Modifiche';
    } else {
        if (modalTitle) modalTitle.textContent = 'Nuova Statistica';
        if (saveBtn) saveBtn.textContent = 'Salva Statistica';
    }

    const showAvgToggle = modal.querySelector('#preview-show-team-avg');
    const showGoalToggle = modal.querySelector('#preview-show-team-goal');
    const viewAllBtn = modal.querySelector('#preview-view-all-btn');
    const viewAvgBtn = modal.querySelector('#preview-view-avg-btn');
    const modeTeamBtn = modal.querySelector('#preview-mode-team-btn');
    const modeIndBtn = modal.querySelector('#preview-mode-ind-btn');
    const teamTabs = modal.querySelector('#preview-team-tabs');
    const indSelectContainer = modal.querySelector('#preview-individual-select-container');
    const indSelect = modal.querySelector('#preview-individual-select');

    if (showAvgToggle) showAvgToggle.checked = true;
    if (showGoalToggle) showGoalToggle.checked = true;
    if (viewAllBtn && viewAvgBtn) {
        viewAllBtn.classList.add('active');
        viewAvgBtn.classList.remove('active');
    }

    if (indSelect) {
        const placeholder = window.appState.isAnonymous ? 'Seleziona Collab...' : 'Seleziona Collaboratore...';
        indSelect.innerHTML = `<option value="">${placeholder}</option>`;
        const names = Object.keys(window.appState.anonymousMap || {}).sort();
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            indSelect.appendChild(opt);
        });
        const mainIndSelect = document.getElementById('individual-select');
        if (mainIndSelect && mainIndSelect.value) {
            indSelect.value = mainIndSelect.value;
        } else if (names.length > 0) {
            indSelect.value = names[0];
        }
    }

    const mainIndTabActive = document.querySelector('.tab-btn[data-target="stat-individual"]')?.classList.contains('active');
    if (modeTeamBtn && modeIndBtn) {
        if (mainIndTabActive) {
            modeIndBtn.classList.add('active');
            modeTeamBtn.classList.remove('active');
            if (teamTabs) teamTabs.style.display = 'none';
            if (indSelectContainer) indSelectContainer.style.display = 'inline-flex';
        } else {
            modeTeamBtn.classList.add('active');
            modeIndBtn.classList.remove('active');
            if (teamTabs) teamTabs.style.display = 'inline-flex';
            if (indSelectContainer) indSelectContainer.style.display = 'none';
        }
    }

    const allMetrics = Array.from(metrics).sort();
    const metricsContainer = document.getElementById('stat-metrics-container');
    const addMetricBtn = document.getElementById('add-metric-btn');
    metricsContainer.innerHTML = '';

    function createMetricRow(initialValue = '', initialColor = '') {
        const rowIndex = metricsContainer.children.length;
        const defaultColor = initialColor || DISTINCT_COLORS[rowIndex % DISTINCT_COLORS.length];
        const row = document.createElement('div');
        row.className = 'metric-input-row';
        row.style.cssText = 'margin-bottom: 12px;';
        
        const isFirst = rowIndex === 0;
        let selectedMetric = initialValue || '';

        row.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label style="margin:0;">${isFirst ? 'Dato / Metrica principale:' : 'Dato / Metrica aggiuntiva:'}</label>
                ${!isFirst ? `<button type="button" class="remove-metric-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.8rem; padding:2px 4px;">Rimuovi</button>` : ''}
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <div style="position:relative; flex:1;">
                    <input type="text" class="stat-metric-search" placeholder="Cerca metrica" autocomplete="off" style="width:100%; padding:8px 32px 8px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);" value="${selectedMetric}">
                    <svg style="position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:0.4;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    <input type="hidden" class="stat-metric-value" value="${selectedMetric}">
                    <div class="searchable-dropdown stat-metric-dropdown"></div>
                </div>
                <input type="color" class="stat-metric-color" value="${defaultColor}" title="Colore metrica" style="width:38px; height:36px; padding:2px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); cursor:pointer;">
            </div>
        `;

        metricsContainer.appendChild(row);

        const searchInput = row.querySelector('.stat-metric-search');
        const hiddenInput = row.querySelector('.stat-metric-value');
        const colorInput = row.querySelector('.stat-metric-color');
        const dropdown = row.querySelector('.stat-metric-dropdown');
        const removeBtn = row.querySelector('.remove-metric-btn');

        colorInput.addEventListener('input', schedulePreview);

        function renderDropdown(filterText = '') {
            dropdown.innerHTML = '';
            const query = filterText.toLowerCase().trim();
            const selectedInOtherRows = new Set(
                Array.from(metricsContainer.querySelectorAll('.stat-metric-value'))
                    .filter(inp => inp !== hiddenInput && inp.value)
                    .map(inp => inp.value)
            );
            const filtered = allMetrics.filter(m => (!query || m.toLowerCase().includes(query)) && (!selectedInOtherRows.has(m) || m === selectedMetric));
            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'padding:8px 12px; color:var(--text-muted); font-size:0.85rem;';
                empty.textContent = 'Nessun risultato';
                dropdown.appendChild(empty);
                return;
            }
            filtered.forEach(m => {
                const item = document.createElement('div');
                item.className = 'searchable-dropdown-item' + (m === selectedMetric ? ' selected' : '');
                item.textContent = m;
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectedMetric = m;
                    hiddenInput.value = m;
                    searchInput.value = m;
                    dropdown.classList.remove('open');
                    renderDropdown(m);

                    if (m.startsWith('Tabella Obiettivi: ')) {
                        const tableName = m.replace('Tabella Obiettivi: ', '');
                        const foundTable = (tablesList || []).find(tbl => tbl.name === tableName);
                        const typeSel = document.getElementById('stat-type');
                        const goalsTableSel = document.getElementById('stat-goals-table-id');
                        if (typeSel) {
                            typeSel.value = 'goals_table';
                            typeSel.dispatchEvent(new Event('change'));
                        }
                        if (goalsTableSel && foundTable) {
                            goalsTableSel.value = foundTable.id;
                        }
                    }

                    schedulePreview();
                });
                dropdown.appendChild(item);
            });
        }

        renderDropdown('');

        searchInput.onfocus = () => {
            if (selectedMetric && searchInput.value === selectedMetric) {
                searchInput.select();
            }
            renderDropdown(searchInput.value === selectedMetric ? '' : searchInput.value);
            dropdown.classList.add('open');
        };
        searchInput.oninput = (e) => {
            if (e.target.value === '') {
                selectedMetric = '';
                hiddenInput.value = '';
                schedulePreview();
            }
            renderDropdown(e.target.value);
            dropdown.classList.add('open');
        };
        searchInput.onblur = () => {
            dropdown.classList.remove('open');
            if (selectedMetric) {
                searchInput.value = selectedMetric;
            } else {
                searchInput.value = '';
            }
        };

        if (removeBtn) {
            removeBtn.onclick = () => {
                row.remove();
                schedulePreview();
            };
        }
    }

    if (editingStat) {
        const editMetrics = editingStat.metrics && editingStat.metrics.length > 0 ? editingStat.metrics : [editingStat.metric];
        const editColors = editingStat.colors && editingStat.colors.length > 0 ? editingStat.colors : [];
        editMetrics.forEach((m, idx) => createMetricRow(m, editColors[idx]));
    } else {
        createMetricRow();
    }

    addMetricBtn.onclick = () => {
        createMetricRow();
        schedulePreview();
    };

    function getSelectedMetrics() {
        const hiddenInputs = metricsContainer.querySelectorAll('.stat-metric-value');
        const list = [];
        hiddenInputs.forEach(input => {
            if (input.value) list.push(input.value);
        });
        return list;
    }

    function getSelectedColors() {
        const colorInputs = metricsContainer.querySelectorAll('.stat-metric-color');
        const list = [];
        colorInputs.forEach((input, idx) => {
            list.push(input.value || DISTINCT_COLORS[idx % DISTINCT_COLORS.length]);
        });
        return list;
    }

    // --- Preview in tempo reale ---
    let previewChart = null;
    let previewDebounce = null;

    async function updateStatPreview() {
        const container = document.getElementById('stat-preview-container');
        if (!container) return;

        const selectedMetricsList = getSelectedMetrics();
        const selectedColorsList = getSelectedColors();
        const skill = document.getElementById('stat-skill').value;
        const type = document.getElementById('stat-type').value;

        if (selectedMetricsList.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Seleziona almeno un dato/metrica per vedere l\'anteprima</span>';
            return;
        }

        const isMulti = selectedMetricsList.length > 1;

        const y2Container = document.getElementById('y2-scale-container');
        if (y2Container) y2Container.style.display = isMulti ? 'block' : 'none';

        const customYMax = parseFloat(document.getElementById('stat-y-max')?.value);
        const customY2Max = parseFloat(document.getElementById('stat-y2-max')?.value);

        const isIndividualView = document.getElementById('preview-mode-ind-btn')?.classList.contains('active') || false;
        const selectedEmployee = isIndividualView ? (document.getElementById('preview-individual-select')?.value || '') : '';

        const showTeamAvg = document.getElementById('preview-show-team-avg')?.checked || false;
        const showTeamGoal = document.getElementById('preview-show-team-goal')?.checked || false;
        const teamAvgOnly = !isIndividualView && (document.getElementById('preview-view-avg-btn')?.classList.contains('active') || false);

        const yr = window.appState.activeYear || new Date().getFullYear().toString();
        const pData = await appDb.getAll('performance', 'year', yr);
        const sData = await appDb.getAll('sales', 'year', yr);
        const gData = await appDb.getAll('goals', 'year', yr);

        const tempStatConfig = {
            id: currentEditingStatId || 'preview_temp',
            metric: selectedMetricsList[0],
            metrics: selectedMetricsList,
            colors: selectedColorsList,
            skill: skill,
            type: type,
            title: selectedMetricsList.length > 1 ? selectedMetricsList.join(' + ') : selectedMetricsList[0].replace('Performance: ', '').replace('Sales: ', ''),
            yMax: customYMax,
            y2Max: customY2Max
        };

        const existingCanvases = container.querySelectorAll('canvas');
        existingCanvases.forEach(c => {
            const chart = Chart.getChart(c);
            if (chart) chart.destroy();
        });

        container.innerHTML = '';
        const cardNode = buildStatCard(tempStatConfig, pData, sData, gData, isIndividualView, selectedEmployee, teamAvgOnly, showTeamAvg, showTeamGoal, true);
        container.appendChild(cardNode);

        const canvas = cardNode.querySelector('canvas');
        if (canvas) {
            const chart = Chart.getChart(canvas);
            if (chart && chart.scales) {
                const yMaxInput = document.getElementById('stat-y-max');
                if (yMaxInput && chart.scales.y && chart.scales.y.max !== undefined) {
                    yMaxInput.placeholder = `es. ${chart.scales.y.max}`;
                }
                const y2MaxInput = document.getElementById('stat-y2-max');
                if (y2MaxInput && chart.scales.y2 && chart.scales.y2.max !== undefined) {
                    y2MaxInput.placeholder = `es. ${chart.scales.y2.max}`;
                }
            }
        }
    }

    function schedulePreview() {
        clearTimeout(previewDebounce);
        previewDebounce = setTimeout(updateStatPreview, 150);
    }



    const skillSelect = document.getElementById('stat-skill');
    skillSelect.innerHTML = '<option value="ALL">Tutte le Skill</option>';
    Array.from(skills).sort().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        skillSelect.appendChild(opt);
    });

    const typeSelect = document.getElementById('stat-type');
    const yMaxInput = document.getElementById('stat-y-max');
    const y2MaxInput = document.getElementById('stat-y2-max');
    const goalsTableSelectorGroup = document.getElementById('goals-table-selector-group');
    const goalsTableIdSelect = document.getElementById('stat-goals-table-id');
    const metricsContainer2 = document.getElementById('stat-metrics-container');
    const addMetricBtn2 = document.getElementById('add-metric-btn');
    const yScaleGroup = document.getElementById('y-scale-custom-group');

    // Popola il selector tabelle obiettivi
    const yr2 = window.appState?.activeYear || new Date().getFullYear().toString();
    const tblList2 = await appDb.getSetting(`sales_tables_list_${yr2}`, []);
    if (goalsTableIdSelect) {
        goalsTableIdSelect.innerHTML = '<option value="">-- Seleziona tabella --</option>';
        (tblList2 || []).forEach(t => {
            const o = document.createElement('option');
            o.value = t.id;
            o.textContent = t.name + (t.skill && t.skill !== 'ALL' ? ` (${t.skill})` : '');
            if (editingStat && editingStat.goalsTableId === t.id) o.selected = true;
            goalsTableIdSelect.appendChild(o);
        });
    }

    function applyTypeUI(typeVal) {
        const isGoalsTable = typeVal === 'goals_table';
        if (goalsTableSelectorGroup) goalsTableSelectorGroup.style.display = isGoalsTable ? 'block' : 'none';
        if (metricsContainer2) metricsContainer2.style.display = isGoalsTable ? 'none' : '';
        if (addMetricBtn2) addMetricBtn2.style.display = isGoalsTable ? 'none' : '';
        if (skillSelect) skillSelect.parentElement && (skillSelect.closest('div, label') || skillSelect).closest('[style]') || null;
        const skillLabel = skillSelect ? skillSelect.previousElementSibling : null;
        if (skillSelect) skillSelect.style.display = isGoalsTable ? 'none' : '';
        if (skillLabel && skillLabel.tagName === 'LABEL') skillLabel.style.display = isGoalsTable ? 'none' : '';
        if (yScaleGroup) yScaleGroup.style.display = isGoalsTable ? 'none' : '';
    }

    if (editingStat) {
        if (editingStat.skill) skillSelect.value = editingStat.skill;
        if (editingStat.type) typeSelect.value = editingStat.type;
        if (yMaxInput) yMaxInput.value = editingStat.yMax || '';
        if (y2MaxInput) y2MaxInput.value = editingStat.y2Max || '';
        applyTypeUI(editingStat.type || 'bar');
    }

    typeSelect.addEventListener('change', (e) => {
        applyTypeUI(e.target.value);
        schedulePreview();
    });
    skillSelect.addEventListener('change', schedulePreview);
    if (yMaxInput) yMaxInput.addEventListener('input', schedulePreview);
    if (y2MaxInput) y2MaxInput.addEventListener('input', schedulePreview);

    // Listener toggle anteprima (media team, obiettivo, tutti/solo media, vista team/singolo)

    if (showAvgToggle) showAvgToggle.addEventListener('change', () => schedulePreview());
    if (showGoalToggle) showGoalToggle.addEventListener('change', () => schedulePreview());
    if (viewAllBtn && viewAvgBtn) {
        viewAllBtn.addEventListener('click', () => {
            viewAllBtn.classList.add('active');
            viewAvgBtn.classList.remove('active');
            schedulePreview();
        });
        viewAvgBtn.addEventListener('click', () => {
            viewAvgBtn.classList.add('active');
            viewAllBtn.classList.remove('active');
            schedulePreview();
        });
    }
    if (modeTeamBtn && modeIndBtn) {
        modeTeamBtn.addEventListener('click', () => {
            modeTeamBtn.classList.add('active');
            modeIndBtn.classList.remove('active');
            if (teamTabs) teamTabs.style.display = 'inline-flex';
            if (indSelectContainer) indSelectContainer.style.display = 'none';
            schedulePreview();
        });
        modeIndBtn.addEventListener('click', () => {
            modeIndBtn.classList.add('active');
            modeTeamBtn.classList.remove('active');
            if (teamTabs) teamTabs.style.display = 'none';
            if (indSelectContainer) indSelectContainer.style.display = 'inline-flex';
            schedulePreview();
        });
    }
    if (indSelect) indSelect.addEventListener('change', () => schedulePreview());

    // Chiudi: distruggi chart preview
    const closeBtn = modal.querySelector('.close-modal');
    const overlay = document.getElementById('modal-overlay');
    if (closeBtn) {
        closeBtn.onclick = () => {
            if (previewChart) { previewChart.destroy(); previewChart = null; }
            modal.classList.remove('open');
            if (overlay) overlay.classList.remove('open');
        };
    }

    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
    // Prima anteprima
    schedulePreview();
}

function createStatModalHTML() {
    const html = `
    <div id="stat-config-modal" class="modal">
        <div class="modal-header">
            <h2>Nuova Statistica</h2>
            <button class="close-modal" onclick="document.getElementById('stat-config-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="stat-modal-layout">
            <div class="stat-modal-form">
                <label style="font-weight:700;">Tipo Visualizzazione:</label>
                <select id="stat-type" style="width:100%; padding:8px; margin-bottom:16px;">
                    <option value="bar">Grafico a Barre</option>
                    <option value="line">Grafico a Linee</option>
                    <option value="table">Tabella Dati</option>
                    <option value="pie">Grafico a Torta</option>
                    <option value="goals_table">Tabella Obiettivi Vendita</option>
                </select>

                <div id="goals-table-selector-group" style="display:none; margin-bottom:16px;">
                    <label style="font-weight:700;">Seleziona Tabella Obiettivi:</label>
                    <select id="stat-goals-table-id" style="width:100%; padding:8px;"><option value="">Caricamento...</option></select>
                </div>

                <div id="stat-metrics-container">
                    <!-- I campi per le metriche verranno inseriti dinamicamente -->
                </div>
                
                <button type="button" id="add-metric-btn" class="btn secondary" style="width:100%; margin-bottom:16px; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Aggiungi dati
                </button>

                <div id="stat-skill-group">
                    <label>Filtro Skill Performance (opzionale):</label>
                    <select id="stat-skill" style="width:100%; padding:8px; margin-bottom:16px;"></select>
                </div>

                <div id="y-scale-custom-group" style="display:flex; gap:12px; margin-bottom:16px;">
                    <div style="flex:1;">
                        <label style="font-size:0.78rem;">Max Asse Y (Sinistra):</label>
                        <input type="number" id="stat-y-max" placeholder="es. 7000" style="width:100%; padding:6px; font-size:0.85rem;">
                    </div>
                    <div id="y2-scale-container" style="flex:1; display:none;">
                        <label style="font-size:0.78rem;">Max Asse Y (Destra, opz.):</label>
                        <input type="number" id="stat-y2-max" placeholder="es. 500" style="width:100%; padding:6px; font-size:0.85rem;">
                    </div>
                </div>
            </div>
            <div class="stat-modal-preview" style="display:flex; flex-direction:column; height:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border);">
                    <div class="stat-modal-preview-title" style="margin-bottom:0;">Anteprima in tempo reale</div>
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        <div id="preview-individual-select-container" style="display:none; align-items:center;">
                            <select id="preview-individual-select" style="padding:4px 8px; height:28px; border-radius:6px; background:var(--bg-base); color:var(--text-main); border:1px solid var(--border); font-size:0.78rem; max-width:180px;">
                                <option value="">Seleziona Collaboratore...</option>
                            </select>
                        </div>
                        <label class="toggle-switch" style="display:flex; align-items:center; cursor:pointer; font-size:0.8rem;">
                            <input type="checkbox" id="preview-show-team-avg">
                            <span class="slider"></span>
                            <span class="label" style="font-size:0.8rem; margin-left:6px;">Mostra Media Team</span>
                        </label>
                        <label class="toggle-switch" style="display:flex; align-items:center; cursor:pointer; font-size:0.8rem;">
                            <input type="checkbox" id="preview-show-team-goal">
                            <span class="slider"></span>
                            <span class="label" style="font-size:0.8rem; margin-left:6px;">Mostra Obiettivo Team</span>
                        </label>
                        <div class="tabs" id="preview-team-tabs" style="display:inline-flex;">
                            <button type="button" class="tab-btn active" id="preview-view-all-btn" style="padding:4px 10px; font-size:0.75rem;">Tutti</button>
                            <button type="button" class="tab-btn" id="preview-view-avg-btn" style="padding:4px 10px; font-size:0.75rem;">Solo Media</button>
                        </div>

                        <div style="width:1px; height:20px; background:var(--border); margin:0 2px;"></div>

                        <div class="tabs" style="display:inline-flex;">
                            <button type="button" class="tab-btn active" id="preview-mode-team-btn" title="Vista Team" style="padding:4px 8px; display:inline-flex; align-items:center; justify-content:center;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            </button>
                            <button type="button" class="tab-btn" id="preview-mode-ind-btn" title="Vista Singolo Collaboratore" style="padding:4px 8px; display:inline-flex; align-items:center; justify-content:center;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="stat-modal-preview-inner" id="stat-preview-container" style="flex:1; min-height:340px;">
                    <span style="color:var(--text-muted); font-size:0.85rem;">Seleziona una metrica per vedere l'anteprima</span>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn primary" onclick="saveNewStat()">Salva Statistica</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const modalEl = document.getElementById('stat-config-modal');
    return modalEl;
}

async function saveNewStat() {
    const type = document.getElementById('stat-type').value;
    const activeTemplateId = await getActiveTemplateId();

    // Tipo speciale: Tabella Obiettivi Vendita
    if (type === 'goals_table') {
        const tableId = document.getElementById('stat-goals-table-id')?.value || '';
        if (!tableId) { alert('Seleziona una tabella obiettivi.'); return; }
        const year = window.appState.activeYear;
        const tablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
        const tbl = (tablesList || []).find(t => t.id === tableId);
        const title = tbl ? tbl.name : 'Tabella Obiettivi';

        const allStats = await appDb.getAll('custom_stats');
        if (currentEditingStatId) {
            const existing = allStats.find(s => s.id === currentEditingStatId);
            if (existing) {
                existing.title = title;
                existing.type = 'goals_table';
                existing.goalsTableId = tableId;
                existing.metric = '__goals_table__';
                existing.metrics = [];
                await appDb.addMultiple('custom_stats', [existing]);
            }
            currentEditingStatId = null;
        } else {
            const templateStats = allStats.filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'));
            const maxOrder = templateStats.reduce((max, s) => Math.max(max, s.order ?? -1), -1);
            const newStat = {
                id: 'stat_' + Date.now(),
                title, type: 'goals_table', goalsTableId: tableId,
                metric: '__goals_table__', metrics: [], colors: [],
                skill: 'ALL', product: '', groupId: null,
                templateId: activeTemplateId, year, order: maxOrder + 1
            };
            await appDb.addMultiple('custom_stats', [newStat]);
        }
        document.getElementById('stat-config-modal').classList.remove('open');
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('open');
        renderTeamStats();
        return;
    }

    const hiddenInputs = document.querySelectorAll('#stat-metrics-container .stat-metric-value');
    const colorInputs = document.querySelectorAll('#stat-metrics-container .stat-metric-color');
    const selectedMetrics = [];
    const selectedColors = [];
    hiddenInputs.forEach((inp, idx) => {
        if (inp.value) {
            selectedMetrics.push(inp.value);
            const colorVal = colorInputs[idx]?.value || DISTINCT_COLORS[idx % DISTINCT_COLORS.length];
            selectedColors.push(colorVal);
        }
    });

    if (selectedMetrics.length === 0) {
        alert('Seleziona almeno un dato/metrica');
        return;
    }

    const primaryMetric = selectedMetrics[0];
    const rawKeys = selectedMetrics.map(m => m.replace('Performance: ', '').replace('Sales: ', ''));
    const title = rawKeys.join('  +  ');
    const skill = document.getElementById('stat-skill').value;
    const product = '';
    const groupId = (document.getElementById('stat-group')?.value || '') || null;

    const yMaxVal = parseFloat(document.getElementById('stat-y-max')?.value);
    const y2MaxVal = parseFloat(document.getElementById('stat-y2-max')?.value);

    if (currentEditingStatId) {
        const allStats = await appDb.getAll('custom_stats');
        const existing = allStats.find(s => s.id === currentEditingStatId);
        if (existing) {
            existing.title = title;
            existing.metric = primaryMetric;
            existing.metrics = selectedMetrics;
            existing.colors = selectedColors;
            existing.skill = skill;
            existing.type = type;
            existing.product = product;
            existing.yMax = !isNaN(yMaxVal) && yMaxVal > 0 ? yMaxVal : null;
            existing.y2Max = !isNaN(y2MaxVal) && y2MaxVal > 0 ? y2MaxVal : null;
            existing.groupId = groupId || null;
            await appDb.addMultiple('custom_stats', [existing]);
        }
        currentEditingStatId = null;
    } else {
        const allStats = await appDb.getAll('custom_stats');
        const templateStats = allStats.filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'));
        const maxOrder = templateStats.reduce((max, s) => Math.max(max, s.order !== undefined && s.order !== null ? s.order : -1), -1);

        const newStat = {
            id: 'stat_' + Date.now(),
            title,
            metric: primaryMetric,
            metrics: selectedMetrics,
            colors: selectedColors,
            skill, type, product,
            yMax: !isNaN(yMaxVal) && yMaxVal > 0 ? yMaxVal : null,
            y2Max: !isNaN(y2MaxVal) && y2MaxVal > 0 ? y2MaxVal : null,
            groupId: groupId || null,
            templateId: activeTemplateId,
            year: window.appState.activeYear,
            order: maxOrder + 1
        };

        await appDb.addMultiple('custom_stats', [newStat]);
    }
    document.getElementById('stat-config-modal').classList.remove('open');
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
    renderTeamStats();
}

async function renderTeamStats() {
    const container = document.getElementById('team-stats-container');
    if (!container) return;
    container.innerHTML = '';
    
    const year = window.appState.activeYear;
    const activeTemplateId = await getActiveTemplateId();

    const allStats = await appDb.getAll('custom_stats');
    const stats = allStats
        .filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    if (stats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Nessuna statistica presente in questo template. Usa il pulsante "Nuova Statistica".</p>';
        return;
    }
    
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);
    
    const teamAvgOnly = (teamViewMode === 'avg');
    
    for (const stat of stats) {
        const card = await buildStatCard(stat, perfData, salesData, goals, false, '', teamAvgOnly, showTeamAvgInTeam, showTeamGoalInTeam);
        container.appendChild(card);
    }
}

async function renderIndividualStats() {
    const container = document.getElementById('individual-stats-container');
    if (!container) return;
    const employee = document.getElementById('individual-select').value;
    
    if (!employee) {
        container.innerHTML = `
            <div class="card" style="padding: 40px 20px; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; margin-top: 12px;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-base); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); margin: 0 auto;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <div>
                    <h3 style="font-size: 1.05rem; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Seleziona un Collaboratore</h3>
                    <p style="font-size: 0.85rem;">Seleziona un collaboratore dal menu in alto per visualizzare le sue statistiche e gli obiettivi di vendita.</p>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = 'Caricamento...';
    const year = window.appState.activeYear;
    const activeTemplateId = await getActiveTemplateId();

    const allStats = await appDb.getAll('custom_stats');
    const stats = allStats
        .filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);

    // Configurazione personalizzata degli obiettivi per questo collaboratore
    const customConfig = (await appDb.getSetting('ind_goals_config_' + employee, null)) || {
        hidden: {},
        targets: {},
        monthlyTargets: {}
    };
    
    container.innerHTML = '';

    // 1. Intestazione Collaboratore (Icona omino SVG + Nome Cognome + Pulsante Personalizza)
    const displayName = window.getDisplayName(employee);
    const headerCard = document.createElement('div');
    headerCard.className = 'card';
    headerCard.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:16px 20px; margin-top:12px; margin-bottom:20px; border-radius:var(--radius); background:var(--bg-surface); border:1px solid var(--border); flex-wrap:wrap; gap:16px;';

    headerCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px;">
            <div style="width:48px; height:48px; border-radius:50%; background:rgba(59,130,246,0.12); color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid rgba(59,130,246,0.3);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </div>
            <div>
                <h2 style="font-size:1.25rem; font-weight:700; color:var(--text-main); margin:0;">${displayName}</h2>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Statistiche & Obiettivi Individuali · Anno ${year}</div>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
            <button class="btn secondary btn-sm" id="cust-ind-goals-btn" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; padding:6px 12px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Personalizza Obiettivi
            </button>
        </div>
    `;
    container.appendChild(headerCard);

    const custBtn = headerCard.querySelector('#cust-ind-goals-btn');
    if (custBtn) {
        custBtn.onclick = () => openIndividualGoalsModal(employee, year);
    }

    // 2. Sezione Obiettivi di Vendita (Stile LolloData Dashboard)
    const goalCardsHtml = buildIndividualGoalCardsHTML(employee, year, goals, perfData, salesData, customConfig);
    if (goalCardsHtml) {
        const goalsSection = document.createElement('div');
        goalsSection.style.cssText = 'margin-bottom: 24px;';
        goalsSection.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="font-size:1rem; font-weight:700; color:var(--text-main); margin:0;">Obiettivi di Vendita</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                ${goalCardsHtml}
            </div>
        `;
        container.appendChild(goalsSection);
    }

    // 2b. Statistiche individuali (goals_table type gestito in buildStatCard)

    // 3. Grafici e Statistiche Personalizzate (Template Grid)
    const chartsSectionHeader = document.createElement('div');
    chartsSectionHeader.style.cssText = 'margin-bottom:12px;';
    chartsSectionHeader.innerHTML = `<h3 style="font-size:1rem; font-weight:700; color:var(--text-main); margin:0;">Grafici e Statistiche Personalizzate</h3>`;
    container.appendChild(chartsSectionHeader);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    if (stats.length === 0) {
        statsGrid.innerHTML = '<p style="color:var(--text-muted)">Nessuna statistica in questo template.</p>';
    } else {
        for (const stat of stats) {
            const card = await buildStatCard(stat, perfData, salesData, goals, true, employee, false, showIndividualTeamAvg, showIndividualTeamGoal);
            statsGrid.appendChild(card);
        }
    }
    container.appendChild(statsGrid);
}

function buildIndividualGoalCardsHTML(employee, year, goals, perfData, salesData, customConfig) {
    const hiddenMap = customConfig.hidden || {};
    const customTargets = customConfig.targets || {};
    const customMonthlyTargets = customConfig.monthlyTargets || {};

    const defaultItems = [
        { key: 'AOIT (CHF)', label: 'AOIT (CHF)', isCHF: true, defaultTarget: 5000, color: '#3b82f6' },
        { key: 'Retention', label: 'Retention', isCHF: false, defaultTarget: 12, color: '#059669' },
        { key: 'Internet', label: 'Internet', isCHF: false, defaultTarget: 12, color: '#d97706' },
        { key: 'TV', label: 'TV', isCHF: false, defaultTarget: 12, color: '#8b5cf6' },
        { key: 'Mobile', label: 'Mobile', isCHF: false, defaultTarget: 12, color: '#ec4899' }
    ];

    // Integrazione eventuali obiettivi definiti nel DB per questo collaboratore o team
    goals.forEach(g => {
        if (!g.employee || g.employee === employee) {
            const cleanKey = g.metric.replace(/^Sales:\s*/i, '').replace(/^Performance:\s*/i, '');
            const existing = defaultItems.find(i => i.key.toLowerCase() === cleanKey.toLowerCase());
            if (!existing) {
                defaultItems.push({
                    key: cleanKey,
                    label: cleanKey,
                    isCHF: cleanKey.toLowerCase().includes('chf') || cleanKey.toLowerCase().includes('aoit'),
                    defaultTarget: g.target || 10,
                    color: '#3b82f6',
                    skill: g.skill && g.skill !== 'ALL' ? g.skill : null
                });
            } else if (g.target) {
                existing.defaultTarget = g.target;
            }
        }
    });

    // Trova l'ultimo mese presente nei dati
    let allDates = [];
    salesData.forEach(d => { if (d.date) allDates.push(d.date); });
    perfData.forEach(d => { if (d.date) allDates.push(d.date); });
    
    let latestMonthStr = '';
    let latestMonthName = 'Corrente';
    if (allDates.length > 0) {
        allDates.sort();
        const lastDate = allDates[allDates.length - 1];
        const parts = lastDate.split('-');
        if (parts.length >= 2) {
            latestMonthStr = `${parts[0]}-${parts[1]}`;
            const monthIdx = parseInt(parts[1], 10) - 1;
            const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
            if (monthIdx >= 0 && monthIdx < 12) latestMonthName = mesi[monthIdx];
        }
    }

    let cardsHtml = '';

    defaultItems.forEach(item => {
        if (hiddenMap[item.key]) return;

        const annualTarget = customTargets[item.key] ?? item.defaultTarget;
        const monthlyTarget = customMonthlyTargets[item.key] ?? (annualTarget > 0 ? Math.round(annualTarget / 12) : 0);

        let monthlyAchieved = 0;
        let annualAchieved = 0;

        const keyLower = item.key.toLowerCase();
        
        salesData.forEach(r => {
            if (r.employee !== employee || !r.data) return;
            let val = 0;
            if (keyLower.includes('aoit')) {
                val = parseMetricValue(r.data['AOIT gew'] ?? r.data['AOIT (CHF)'] ?? r.data['AOIT'] ?? (r.data.Product === 'AOIT gew' ? r.data.Value : 0));
            } else if (keyLower.includes('retention')) {
                val = parseMetricValue(r.data['Retention'] ?? (r.data.Product === 'Retention' ? r.data.Value : 0));
            } else if (keyLower.includes('internet')) {
                val = parseMetricValue(r.data['Internet'] ?? (r.data.Product === 'Internet' ? r.data.Value : 0));
            } else if (keyLower.includes('tv')) {
                val = parseMetricValue(r.data['TV'] ?? (r.data.Product === 'TV' ? r.data.Value : 0));
            } else if (keyLower.includes('mobile')) {
                val = parseMetricValue(r.data['Mobile'] ?? (r.data.Product === 'Mobile' ? r.data.Value : 0));
            } else {
                val = parseMetricValue(r.data[item.key] ?? 0);
            }

            if (val) {
                annualAchieved += val;
                if (latestMonthStr && r.date && r.date.startsWith(latestMonthStr)) {
                    monthlyAchieved += val;
                }
            }
        });

        if (annualAchieved === 0) {
            perfData.forEach(r => {
                if (r.employee !== employee || !r.data) return;
                const val = parseMetricValue(r.data[item.key] ?? 0);
                if (val) {
                    annualAchieved += val;
                    if (latestMonthStr && r.date && r.date.startsWith(latestMonthStr)) {
                        monthlyAchieved += val;
                    }
                }
            });
        }

        const formatVal = (v) => {
            if (item.isCHF) return 'CHF ' + Math.round(v).toLocaleString('de-CH');
            return Number.isInteger(v) ? v.toString() : v.toFixed(1);
        };

        const monthPct = monthlyTarget > 0 ? Math.round((monthlyAchieved / monthlyTarget) * 100) : 0;
        const annualPct = annualTarget > 0 ? Math.round((annualAchieved / annualTarget) * 100) : 0;
        const monthPctClamped = Math.min(Math.max(monthPct, 0), 100);
        const annualPctClamped = Math.min(Math.max(annualPct, 0), 100);

        cardsHtml += `
            <div class="card" style="padding: 12px 14px; border-radius: var(--radius); background: var(--bg-surface); border: 1px solid var(--border); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="font-weight: 700; font-size: 13px; color: ${item.color}; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${item.label}</span>
                        ${item.skill ? `<span style="font-size:10px; font-weight:500; padding:1px 6px; border-radius:10px; background:var(--bg-base); color:var(--text-muted); border:1px solid var(--border);">${item.skill}</span>` : ''}
                    </div>
                    
                    <div class="goal-info-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px;">
                        <span style="font-size:11px; color:var(--text-muted);">Mensile ${latestMonthName}</span>
                        <span style="color:var(--text-muted); font-size:11px; font-weight:600;">${formatVal(monthlyAchieved)} / ${formatVal(monthlyTarget)}</span>
                    </div>
                    <div class="goal-progress-track" style="height:16px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:8px; position:relative;">
                        <div class="goal-progress-fill" style="width:${monthPctClamped}%; height:100%; background:${item.color}; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:700; transition: width 0.3s ease;">
                            ${monthPct > 12 ? monthPct + '%' : ''}
                        </div>
                    </div>

                    <div class="goal-info-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px;">
                        <span style="font-size:11px; color:var(--text-muted);">Annuale</span>
                        <span style="color:var(--text-muted); font-size:11px; font-weight:600;">${formatVal(annualAchieved)} / ${formatVal(annualTarget)}</span>
                    </div>
                    <div class="goal-progress-track" style="height:16px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; overflow:hidden; position:relative;">
                        <div class="goal-progress-fill" style="width:${annualPctClamped}%; height:100%; background:${item.color}; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:700; transition: width 0.3s ease;">
                            ${annualPct > 12 ? annualPct + '%' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    return cardsHtml;
}

async function openIndividualGoalsModal(employee, year) {
    let modal = document.getElementById('ind-goals-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ind-goals-modal';
        modal.className = 'modal';
        modal.style.cssText = 'max-width: 600px; width: 92%; border-radius: 12px;';
        document.body.appendChild(modal);
    }

    const overlay = document.getElementById('modal-overlay');
    
    const customConfig = (await appDb.getSetting('ind_goals_config_' + employee, null)) || {
        hidden: {},
        targets: {},
        monthlyTargets: {}
    };

    const goals = await appDb.getAll('goals', 'year', year);

    const defaultItems = [
        { key: 'AOIT (CHF)', label: 'AOIT (CHF)', isCHF: true, defaultTarget: 5000 },
        { key: 'Retention', label: 'Retention', isCHF: false, defaultTarget: 12 },
        { key: 'Internet', label: 'Internet', isCHF: false, defaultTarget: 12 },
        { key: 'TV', label: 'TV', isCHF: false, defaultTarget: 12 },
        { key: 'Mobile', label: 'Mobile', isCHF: false, defaultTarget: 12 }
    ];

    goals.forEach(g => {
        if (!g.employee || g.employee === employee) {
            const cleanKey = g.metric.replace(/^Sales:\s*/i, '').replace(/^Performance:\s*/i, '');
            if (!defaultItems.find(i => i.key.toLowerCase() === cleanKey.toLowerCase())) {
                defaultItems.push({
                    key: cleanKey,
                    label: cleanKey,
                    isCHF: cleanKey.toLowerCase().includes('chf') || cleanKey.toLowerCase().includes('aoit'),
                    defaultTarget: g.target || 10
                });
            }
        }
    });

    const displayName = window.getDisplayName(employee);

    modal.innerHTML = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border);">
            <h2 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">Personalizza Obiettivi: ${displayName}</h2>
            <button class="close-modal" id="close-ind-goals-modal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; max-height:65vh; overflow-y:auto; display:flex; flex-direction:column; gap:16px;">
            <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
                Configura quali obiettivi visualizzare e imposta i target annuali e mensili specifici per <strong>${displayName}</strong> (${year}).
            </p>
            <div id="ind-goals-form-list" style="display:flex; flex-direction:column; gap:12px;"></div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--border);">
            <button class="btn secondary" id="cancel-ind-goals-btn">Annulla</button>
            <button class="btn primary" id="save-ind-goals-btn">Salva Modifiche</button>
        </div>
    `;

    const formList = modal.querySelector('#ind-goals-form-list');
    defaultItems.forEach(item => {
        const isHidden = !!customConfig.hidden[item.key];
        const annualTgt = customConfig.targets[item.key] ?? item.defaultTarget;
        const monthlyTgt = customConfig.monthlyTargets?.[item.key] ?? (annualTgt > 0 ? Math.round(annualTgt / 12) : 0);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; flex-wrap:wrap;';
        row.innerHTML = `
            <label style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:0.9rem; color:var(--text-main); cursor:pointer; flex:1; min-width:140px;">
                <input type="checkbox" class="ind-goal-vis-cb" data-key="${item.key}" ${!isHidden ? 'checked' : ''}>
                <span>${item.label}</span>
            </label>
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.7rem; color:var(--text-muted);">Target Mensile</span>
                    <input type="number" class="ind-goal-monthly-input" data-key="${item.key}" value="${monthlyTgt}" style="width:85px; padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.85rem;">
                </div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.7rem; color:var(--text-muted);">Target Annuale</span>
                    <input type="number" class="ind-goal-annual-input" data-key="${item.key}" value="${annualTgt}" style="width:85px; padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-size:0.85rem;">
                </div>
            </div>
        `;
        formList.appendChild(row);
    });

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    };

    modal.querySelector('#close-ind-goals-modal').onclick = closeModal;
    modal.querySelector('#cancel-ind-goals-btn').onclick = closeModal;

    modal.querySelector('#save-ind-goals-btn').onclick = async () => {
        const newHidden = {};
        const newTargets = {};
        const newMonthlyTargets = {};

        modal.querySelectorAll('.ind-goal-vis-cb').forEach(cb => {
            const key = cb.dataset.key;
            if (!cb.checked) newHidden[key] = true;
        });

        modal.querySelectorAll('.ind-goal-annual-input').forEach(inp => {
            const key = inp.dataset.key;
            const val = parseFloat(inp.value) || 0;
            newTargets[key] = val;
        });

        modal.querySelectorAll('.ind-goal-monthly-input').forEach(inp => {
            const key = inp.dataset.key;
            const val = parseFloat(inp.value) || 0;
            newMonthlyTargets[key] = val;
        });

        await appDb.setSetting('ind_goals_config_' + employee, {
            hidden: newHidden,
            targets: newTargets,
            monthlyTargets: newMonthlyTargets
        });

        closeModal();
        await renderIndividualStats();
    };

    modal.classList.add('open');
    if (overlay) overlay.classList.add('active');
}

function formatDateLabel(dateStr) {
    const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
        const monthIdx = parseInt(parts[1], 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) return mesi[monthIdx];
    }
    return dateStr;
}

function parseMetricValue(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).trim().replace('%', '');
    if (str.includes('.') && str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
}

function hexToRgba(hex, opacity) {
    if (!hex || typeof hex !== 'string') return `rgba(59, 130, 246, ${opacity})`;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

async function buildStatCard(statConfig, perfData, salesData, goals, isIndividual, employeeName = '', teamAvgOnly = false, showTeamAvg = false, showTeamGoal = false, isPreview = false) {
    const card = document.createElement('div');
    card.className = 'card stat-card';
    card.style.position = 'relative';
    
    // Gestione tipo speciale: Tabella Obiettivi Vendita
    if (statConfig.type === 'goals_table') {
        const title = document.createElement('h3');
        title.textContent = statConfig.title || 'Tabella Obiettivi Vendita';
        title.style.marginBottom = '12px';
        card.appendChild(title);

        if (!isPreview) {
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'position:absolute; top:16px; right:16px; display:flex; gap:6px;';
            
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
            editBtn.className = 'btn secondary';
            editBtn.style.cssText = 'padding:4px 8px; font-size:0.75rem;';
            editBtn.title = 'Modifica statistica';
            editBtn.onclick = async () => { await openStatModal(statConfig); };
            actionsDiv.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
            deleteBtn.className = 'btn secondary';
            deleteBtn.style.cssText = 'padding:4px 8px; font-size:0.75rem;';
            deleteBtn.title = 'Elimina statistica';
            deleteBtn.onclick = async () => {
                if (!confirm(`Eliminare la statistica "${statConfig.title}"?`)) return;
                await appDb.deleteRecord('custom_stats', statConfig.id);
                renderTeamStats();
            };
            actionsDiv.appendChild(deleteBtn);
            card.appendChild(actionsDiv);
        }

        const tableContainer = document.createElement('div');
        tableContainer.style.overflowX = 'auto';
        
        const year = window.appState?.activeYear || new Date().getFullYear().toString();
        const singleTableEl = await buildSingleGoalsActualTable(year, statConfig.goalsTableId, perfData, salesData, isIndividual ? employeeName : null);
        if (singleTableEl) {
            tableContainer.appendChild(singleTableEl);
        } else {
            tableContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:12px 0;">Tabella non trovata o nessun dato disponibile.</p>';
        }
        card.appendChild(tableContainer);
        return card;
    }

    const isPerf = statConfig.metric.startsWith('Performance: ');
    const rawKey = statConfig.metric.replace('Performance: ', '').replace('Sales: ', '');
    
    const title = document.createElement('h3');
    const rawTitleText = statConfig.title || rawKey;
    // Replace ' & ' or ' + ' with bold plus sign and spaces
    const formattedTitle = rawTitleText.replace(/\s*(&|\+|\+\+)\s*/g, ' <strong style="font-weight:800; padding:0 4px;">+</strong> ');
    title.innerHTML = formattedTitle;
    title.style.marginBottom = '4px';
    card.appendChild(title);
    
    // Stat info line
    const info = document.createElement('div');
    info.className = 'stat-info';
    let infoParts = [];
    if (isPerf) {
        if (statConfig.skill && statConfig.skill !== 'ALL') {
            infoParts.push(statConfig.skill);
        } else {
            infoParts.push('Tutte le Skill');
        }
    } else {
        if (statConfig.product) {
            infoParts.push(statConfig.product);
        }
    }
    const infoText = infoParts.join(' · ');
    info.textContent = infoText;
    if (infoText) {
        card.appendChild(info);
    }

    // Badge gruppo (se presente)
    if (statConfig.groupId) {
        const groupBadge = document.createElement('div');
        groupBadge.style.cssText = 'display:inline-flex; align-items:center; gap:4px; margin-top:4px; padding:2px 8px; border-radius:20px; background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.3); font-size:0.72rem; color:#818cf8; max-width:fit-content;';
        groupBadge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><line x1="12" y1="12" x2="15.5" y2="7.5"/><line x1="12" y1="12" x2="15.5" y2="16.5"/></svg> <span id="group-badge-${statConfig.id}">Gruppo</span>`;
        card.appendChild(groupBadge);
        // Recupera nome gruppo in modo asincrono
        appDb.getSetting('stat_groups', []).then(groups => {
            const g = (groups || []).find(g => g.id === statConfig.groupId);
            const span = document.getElementById(`group-badge-${statConfig.id}`);
            if (span && g) span.textContent = g.name;
            else if (span) span.textContent = 'Gruppo';
        });
    }

    // Search text for filtering
    card.setAttribute('data-search-text', `${title.textContent} ${infoText}`);

    if (!isPreview) {
        // Action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'position:absolute; top:16px; right:16px; display:flex; gap:6px;';
        
        // Pulsante modifica (matita)
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
        editBtn.className = 'btn secondary';
        editBtn.style.cssText = 'padding:4px 8px; font-size:0.75rem;';
        editBtn.title = 'Modifica statistica';
        editBtn.onclick = async () => {
            await openStatModal(statConfig);
        };
        actionsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        deleteBtn.className = 'btn secondary';
        deleteBtn.style.cssText = 'padding:4px 8px; font-size:0.75rem;';
        deleteBtn.title = 'Elimina statistica';
        deleteBtn.onclick = async () => {
            if (!confirm(`Eliminare la statistica "${statConfig.title}"?`)) return;
            await appDb.deleteRecord('custom_stats', statConfig.id);
            renderTeamStats();
        };
        actionsDiv.appendChild(deleteBtn);
        card.appendChild(actionsDiv);
    } else {
        card.style.background = 'transparent';
        card.style.border = 'none';
        card.style.padding = '0';
        card.style.boxShadow = 'none';
        card.style.margin = '0';
        card.style.width = '100%';
        card.style.height = '100%';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        title.style.display = 'none';
        if (info) info.style.display = 'none';
    }
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.marginTop = isPreview ? '0' : '8px';
    if (statConfig.type === 'table') {
        canvasContainer.style.height = 'auto';
        canvasContainer.style.overflowX = 'auto';
    } else {
        canvasContainer.style.height = isPreview ? '100%' : '360px';
        canvasContainer.style.minHeight = isPreview ? '300px' : '0';
        if (isPreview) canvasContainer.style.flex = '1';
    }
    card.appendChild(canvasContainer);
    
    // Process Data
    const sourceData = isPerf ? perfData : salesData;
    
    const activeYr = window.appState.activeYear || new Date().getFullYear().toString();
    const datesSet = new Set();
    const datesWithData = new Set();

    // Always include all 12 months of the active year
    for (let m = 1; m <= 12; m++) {
        const monthStr = String(m).padStart(2, '0');
        datesSet.add(`${activeYr}-${monthStr}-01`);
    }
    
    const empSet = new Set();
    const empDateMap = {};
    const aggregatedByDate = {};

    sourceData.forEach(row => {
        if (isPerf && statConfig.skill && statConfig.skill !== 'ALL') {
            if (row.skill !== statConfig.skill) return;
        }
        if (!isPerf && statConfig.product) {
            if (row.data['Product'] !== statConfig.product) return;
        }

        const date = row.date;
        const emp = row.employee;
        const val = parseMetricValue(row.data[rawKey]);

        datesSet.add(date);
        datesWithData.add(date);
        if (emp) empSet.add(emp);

        if (emp) {
            if (!empDateMap[emp]) empDateMap[emp] = {};
            if (!empDateMap[emp][date]) empDateMap[emp][date] = 0;
            empDateMap[emp][date] += val;
        }

        if (!aggregatedByDate[date]) aggregatedByDate[date] = 0;
        aggregatedByDate[date] += val;
    });

    const labels = Array.from(datesSet).sort();
    const displayLabels = labels.map(formatDateLabel);
    const employees = Array.from(empSet).sort();

    const dataPts = labels.map(l => {
        if (!datesWithData.has(l)) return null;
        if (isIndividual && employeeName) {
            return (empDateMap[employeeName] && empDateMap[employeeName][l] !== undefined) ? empDateMap[employeeName][l] : 0;
        }
        return aggregatedByDate[l] !== undefined ? aggregatedByDate[l] : 0;
    });

    // Compute team average for each date
    const teamAvgPts = labels.map(date => {
        if (!datesWithData.has(date)) return null;
        let sum = 0;
        let count = 0;
        employees.forEach(emp => {
            if (empDateMap[emp] && empDateMap[emp][date] !== undefined) {
                sum += empDateMap[emp][date];
                count++;
            }
        });
        return count > 0 ? Math.round(sum / count) : 0;
    });
    // Check for goals
    let relevantGoal = null;
    const candidateGoals = goals.filter(g => {
        if (g.metric !== statConfig.metric) return false;
        if (isIndividual) {
            if (g.employee === employeeName) return true;
            if (!g.employee && showTeamGoal) return true;
            return false;
        } else {
            return !g.employee && showTeamGoal;
        }
    });

    if (statConfig.skill && statConfig.skill !== 'ALL') {
        relevantGoal = candidateGoals.find(g => g.employee === employeeName && g.skill === statConfig.skill) ||
                       candidateGoals.find(g => !g.employee && g.skill === statConfig.skill);
    }
    if (!relevantGoal) {
        relevantGoal = candidateGoals.find(g => g.employee === employeeName && (!g.skill || g.skill === 'ALL')) ||
                       candidateGoals.find(g => !g.employee && (!g.skill || g.skill === 'ALL'));
    }

    if (statConfig.type === 'table') {
        const metricsList = statConfig.metrics && statConfig.metrics.length > 0 ? statConfig.metrics : [statConfig.metric];
        
        if (metricsList.length > 1 && !teamAvgOnly) {
            // Tabella per metriche multiple
            let html = `<table class="data-table"><thead><tr><th>Dato / Metrica</th>`;
            displayLabels.forEach(l => {
                html += `<th style="text-align:center;">${l}</th>`;
            });
            html += '</tr></thead><tbody>';

            metricsList.forEach(m => {
                const isP = m.startsWith('Performance: ');
                const rKey = m.replace('Performance: ', '').replace('Sales: ', '');
                const sData = isP ? perfData : salesData;
                const agg = {};
                sData.forEach(row => {
                    if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                    if (isIndividual && employeeName && row.employee !== employeeName) return;
                    const val = parseMetricValue(row.data[rKey]);
                    if (!agg[row.date]) agg[row.date] = 0;
                    agg[row.date] += val;
                });

                html += `<tr><td style="font-weight:600;">${rKey}</td>`;
                labels.forEach(d => {
                    const cellVal = datesWithData.has(d) ? (agg[d] !== undefined ? agg[d] : 0) : '';
                    html += `<td style="text-align:center;">${cellVal}</td>`;
                });
                html += '</tr>';
            });

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else if (isIndividual) {
            const colHeader = window.appState.isAnonymous ? 'Collab' : 'Collaboratore';
            let html = `<table class="data-table"><thead><tr><th>${colHeader}</th>`;
            displayLabels.forEach(l => {
                html += `<th style="text-align:center;">${l}</th>`;
            });
            html += '</tr></thead><tbody>';

            const dispName = employeeName ? window.getDisplayName(employeeName) : 'Valore';
            html += `<tr><td style="font-weight:600;">${dispName}</td>`;
            displayLabels.forEach((l, idx) => {
                const val = dataPts[idx];
                const displayVal = val === null ? '' : val;
                html += `<td style="text-align:center;">${displayVal}</td>`;
            });
            html += '</tr>';

            if (showTeamAvg) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.1); border-top: 2px solid var(--border);">';
                html += `<td>Media Team</td>`;
                labels.forEach((date, idx) => {
                    const avgVal = teamAvgPts[idx] === null ? '' : teamAvgPts[idx];
                    html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
                });
                html += '</tr>';
            }

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td>Obiettivo</td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: var(--text-muted);">${targetVal}</td>`;
                });
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else if (teamAvgOnly) {
            // Solo Media Team nella tabella
            let html = '<table class="data-table"><thead><tr><th></th>';
            displayLabels.forEach(l => {
                html += `<th style="text-align:center;">${l}</th>`;
            });
            html += '</tr></thead><tbody>';
            html += '<tr style="font-weight:700;">';
            html += `<td>Media Team</td>`;
            labels.forEach((date, idx) => {
                const avgVal = teamAvgPts[idx] === null ? '' : teamAvgPts[idx];
                html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
            });
            html += '</tr>';

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td>Obiettivo</td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: var(--text-muted);">${targetVal}</td>`;
                });
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else {
            const colHeader = window.appState.isAnonymous ? 'Collab' : 'Collaboratore';
            let html = `<table class="data-table"><thead><tr><th>${colHeader}</th>`;
            displayLabels.forEach(l => {
                html += `<th style="text-align:center;">${l}</th>`;
            });
            html += '</tr></thead><tbody>';

            employees.forEach(emp => {
                const dispName = window.getDisplayName(emp);
                html += `<tr><td style="font-weight:600;">${dispName}</td>`;
                labels.forEach(date => {
                    let cellVal = '';
                    if (datesWithData.has(date)) {
                        cellVal = (empDateMap[emp] && empDateMap[emp][date] !== undefined) ? empDateMap[emp][date] : 0;
                    }
                    html += `<td style="text-align:center;">${cellVal}</td>`;
                });
                html += '</tr>';
            });

            if (showTeamAvg) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.1); border-top: 2px solid var(--border);">';
                html += `<td>Media Team</td>`;
                labels.forEach((date, idx) => {
                    const avgVal = teamAvgPts[idx] === null ? '' : teamAvgPts[idx];
                    html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
                });
                html += '</tr>';
            }

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td>Obiettivo</td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: var(--text-muted);">${targetVal}</td>`;
                });
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        }
    } else if (statConfig.type === 'pie') {
        // --- Grafico a Torta ---
        const canvas = document.createElement('canvas');
        canvasContainer.style.height = '360px';
        canvasContainer.appendChild(canvas);

        const metricsList = statConfig.metrics && statConfig.metrics.length > 0 ? statConfig.metrics : [statConfig.metric];
        let pieEntries = [];

        if (metricsList.length > 1) {
            // Se multi-metrica, la torta confronta le metriche totali
            const metricTotals = {};
            metricsList.forEach(m => {
                const isP = m.startsWith('Performance: ');
                const rKey = m.replace('Performance: ', '').replace('Sales: ', '');
                const sData = isP ? perfData : salesData;
                let sum = 0;
                sData.forEach(row => {
                    if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                    sum += parseMetricValue(row.data[rKey]);
                });
                metricTotals[rKey] = sum;
            });
            pieEntries = Object.entries(metricTotals);
        } else {
            // Totale per collaboratore
            const empTotals = {};
            employees.forEach(emp => {
                let total = 0;
                labels.forEach(date => {
                    if (datesWithData.has(date) && empDateMap[emp] && empDateMap[emp][date] !== undefined) {
                        total += empDateMap[emp][date];
                    }
                });
                if (total > 0) empTotals[emp] = total;
            });
            pieEntries = Object.entries(empTotals).map(([e, v]) => [window.getDisplayName(e), v]).sort((a,b) => b[1]-a[1]);
        }

        const colorsList = (statConfig.colors && statConfig.colors.length > 0) ? statConfig.colors : DISTINCT_COLORS;

        if (pieEntries.length === 0) {
            canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
        } else {
            const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#e2e8f0';
            const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim() || '#1e2130';
            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: pieEntries.map(([label]) => label),
                    datasets: [{
                        data: pieEntries.map(([,v]) => v),
                        backgroundColor: pieEntries.map((_, i) => colorsList[i % colorsList.length]),
                        borderWidth: 2,
                        borderColor: surfaceColor
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: textColor,
                                font: { size: 12 },
                                padding: 12,
                                boxWidth: 14
                            }
                        }
                    }
                }
            });
        }
    } else {
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        let datasets = [];
        const colorsList = (statConfig.colors && statConfig.colors.length > 0) ? statConfig.colors : DISTINCT_COLORS;

        const isBar = statConfig.type === 'bar';
        const metricsList = statConfig.metrics && statConfig.metrics.length > 0 ? statConfig.metrics : [statConfig.metric];

        if (metricsList.length > 1 && !teamAvgOnly) {
            // Se multi-metrica, ogni dataset rappresenta una metrica aggregata
            metricsList.forEach((m, idx) => {
                const isP = m.startsWith('Performance: ');
                const rKey = m.replace('Performance: ', '').replace('Sales: ', '');
                const sData = isP ? perfData : salesData;
                const dateAgg = {};
                sData.forEach(row => {
                    if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                    if (isIndividual && employeeName && row.employee !== employeeName) return;
                    const val = parseMetricValue(row.data[rKey]);
                    if (!dateAgg[row.date]) dateAgg[row.date] = 0;
                    dateAgg[row.date] += val;
                });
                const color = colorsList[idx % colorsList.length];
                const pts = labels.map(l => datesWithData.has(l) ? (dateAgg[l] !== undefined ? dateAgg[l] : 0) : null);
                const yAxisID = (metricsList.length > 1 && idx > 0) ? 'y2' : 'y';
                datasets.push({
                    label: rKey,
                    data: pts,
                    type: isBar ? 'bar' : 'line',
                    yAxisID: yAxisID,
                    backgroundColor: isBar ? hexToRgba(color, 0.85) : hexToRgba(color, 0.15),
                    borderColor: color,
                    borderWidth: isBar ? 1 : 1.8,
                    borderRadius: isBar ? 4 : 0,
                    minBarLength: isBar ? 4 : 0,
                    pointRadius: 0,
                    pointHoverRadius: isBar ? 0 : 5,
                    pointBackgroundColor: color,
                    tension: 0.35,
                    order: 2
                });
            });

            if (isIndividual && showTeamAvg) {
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: 'line',
                    borderColor: '#F59E0B',
                    backgroundColor: '#F59E0B',
                    borderWidth: 3.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#F59E0B',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    order: 1
                });
            }
        } else if (isIndividual) {
            datasets.push({
                label: employeeName ? window.getDisplayName(employeeName) : statConfig.title,
                data: dataPts,
                type: isBar ? 'bar' : 'line',
                backgroundColor: isBar ? hexToRgba('#2563EB', 0.8) : 'rgba(37, 99, 235, 0.15)',
                borderColor: '#2563EB',
                borderWidth: isBar ? 1 : 1.8,
                borderRadius: isBar ? 4 : 0,
                minBarLength: isBar ? 4 : 0,
                pointRadius: 0,
                pointHoverRadius: isBar ? 0 : 5,
                tension: 0.35,
                order: 2
            });

            if (showTeamAvg) {
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: 'line',
                    borderColor: '#F59E0B',
                    backgroundColor: '#F59E0B',
                    borderWidth: 3.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#F59E0B',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    order: 1
                });
            }
        } else if (teamAvgOnly) {
            // Solo Media Team
            datasets.push({
                label: 'Media Team',
                data: teamAvgPts,
                type: isBar ? 'bar' : 'line',
                backgroundColor: isBar ? hexToRgba('#F59E0B', 0.85) : 'rgba(245, 158, 11, 0.15)',
                borderColor: '#F59E0B',
                borderWidth: isBar ? 1 : 3.5,
                borderRadius: isBar ? 4 : 0,
                minBarLength: isBar ? 4 : 0,
                pointRadius: 0,
                pointHoverRadius: isBar ? 0 : 5,
                pointBackgroundColor: '#F59E0B',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                borderDash: isBar ? [] : [6, 4],
                tension: 0.35,
                order: 1
            });
        } else {
            employees.forEach((emp, idx) => {
                const color = DISTINCT_COLORS[idx % DISTINCT_COLORS.length];
                const empPts = labels.map(date => {
                    if (!datesWithData.has(date)) return null;
                    return (empDateMap[emp] && empDateMap[emp][date] !== undefined) ? empDateMap[emp][date] : 0;
                });
                datasets.push({
                    label: window.getDisplayName(emp),
                    data: empPts,
                    type: isBar ? 'bar' : 'line',
                    backgroundColor: isBar ? hexToRgba(color, 0.8) : hexToRgba(color, 0.12),
                    borderColor: color,
                    borderWidth: isBar ? 1 : 1.8,
                    borderRadius: isBar ? 4 : 0,
                    minBarLength: isBar ? 4 : 0,
                    pointRadius: 0,
                    pointHoverRadius: isBar ? 0 : 5,
                    pointBackgroundColor: color,
                    tension: 0.35,
                    order: 2
                });
            });

            if (showTeamAvg) {
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: 'line',
                    borderColor: '#F59E0B',
                    backgroundColor: '#F59E0B',
                    borderWidth: 3.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#F59E0B',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    order: 1
                });
            }
        }

        let maxTarget = undefined;
        let minTarget = undefined;

        if (relevantGoal) {
            maxTarget = relevantGoal.target;
            minTarget = relevantGoal.target;

            if (relevantGoal.toleranceType && relevantGoal.toleranceType !== 'none') {
                const plus = parseFloat(relevantGoal.tolerancePlus) || 0;
                const minus = parseFloat(relevantGoal.toleranceMinus) || 0;

                if (relevantGoal.toleranceType === 'numeric') {
                    maxTarget = relevantGoal.target + plus;
                    minTarget = relevantGoal.target - minus;
                } else if (relevantGoal.toleranceType === 'percentage') {
                    maxTarget = relevantGoal.target * (1 + plus / 100);
                    minTarget = relevantGoal.target * (1 - minus / 100);
                }
            }
        }
        
        // Calculate adaptive min and max for Y scale
        let allVals = [];
        datasets.forEach(ds => {
            if (ds.data && Array.isArray(ds.data)) {
                ds.data.forEach(v => {
                    if (v !== null && v !== undefined && !isNaN(v)) {
                        allVals.push(v);
                    }
                });
            }
        });
        if (relevantGoal) {
            allVals.push(relevantGoal.target);
            if (maxTarget !== undefined) allVals.push(maxTarget);
            if (minTarget !== undefined) allVals.push(minTarget);
        }

        // Round up/down to a "nice" number respecting magnitude
        function niceRoundUp(val) {
            if (val === 0) return 0;
            const absVal = Math.abs(val);
            if (absVal >= 1) return Math.ceil(val);
            const order = Math.pow(10, Math.floor(Math.log10(absVal)));
            return Math.ceil(val / order) * order;
        }
        function niceRoundDown(val) {
            if (val === 0) return 0;
            const absVal = Math.abs(val);
            if (absVal >= 1) return Math.floor(val);
            const order = Math.pow(10, Math.floor(Math.log10(absVal)));
            return Math.floor(val / order) * order;
        }

        let yScalesConfig = {};
        if (statConfig.yMax && !isNaN(statConfig.yMax)) {
            yScalesConfig = { beginAtZero: true, max: statConfig.yMax };
        } else if (allVals.length > 0) {
            const minVal = Math.min(...allVals);
            const maxVal = Math.max(...allVals);
            
            if (minVal === 0 && maxVal === 0) {
                yScalesConfig = { min: 0, max: 1 };
            } else {
                const range = maxVal - minVal;
                const margin = (range > 0 ? range : Math.abs(maxVal) || 1) * 0.15;
                const calculatedMin = (minVal >= 0 && minVal <= maxVal * 0.3) ? 0 : Math.max(0, niceRoundDown(minVal - margin));
                const calculatedMax = niceRoundUp(maxVal + margin);
                yScalesConfig = {
                    min: calculatedMin,
                    max: calculatedMax || 1
                };
            }
        } else {
            yScalesConfig = { beginAtZero: true };
        }

        const isMultiMetrics = metricsList.length > 1 && !teamAvgOnly;
        const scalesConfig = {
            x: {
                grid: {
                    color: 'rgba(128, 128, 128, 0.12)'
                }
            },
            y: {
                ...yScalesConfig,
                grid: {
                    color: 'rgba(128, 128, 128, 0.15)'
                }
            }
        };

        if (isMultiMetrics) {
            let y2ScalesConfig = { beginAtZero: true };
            if (statConfig.y2Max && !isNaN(statConfig.y2Max)) {
                y2ScalesConfig.max = statConfig.y2Max;
            }
            scalesConfig.y2 = {
                position: 'right',
                ...y2ScalesConfig,
                grid: { drawOnChartArea: false }
            };
        }

        new Chart(canvas, {
            type: isBar ? 'bar' : 'line',
            data: {
                labels: displayLabels,
                datasets: datasets
            },
            plugins: [fullWidthGoalPlugin, legendMarginPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 0
                    }
                },
                plugins: {
                    legend: {
                        display: isMultiMetrics,
                        position: 'bottom',
                        align: 'start',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#e2e8f0',
                            font: { size: 11 },
                            padding: 12,
                            boxWidth: 12
                        }
                    },
                    fullWidthGoal: relevantGoal ? {
                        target: relevantGoal.target,
                        maxTarget: maxTarget,
                        minTarget: minTarget
                    } : null
                },
                scales: scalesConfig
            }
        });
    }
    
    return card;
}

function getTypeLabel(type) {
    if (type === 'bar') return '(barre)';
    if (type === 'line') return '(linee)';
    if (type === 'table') return '(dati)';
    if (type === 'pie') return '(torta)';
    return `(${type})`;
}

async function openReorderModal() {
    let modal = document.getElementById('reorder-stat-modal');
    if (!modal) {
        modal = createReorderModalHTML();
    }
    await renderReorderList();
    modal.classList.add('open');
}

function createReorderModalHTML() {
    const html = `
    <div id="reorder-stat-modal" class="modal">
        <div class="modal-header">
            <h2>Riordina Grafici</h2>
            <button class="close-modal" onclick="document.getElementById('reorder-stat-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">
                Trascina i titoli su e giù o usa le frecce per riordinare la disposizione dei grafici.
            </p>
            <div id="reorder-stat-list" class="reorder-list"></div>
        </div>
        <div class="modal-footer">
            <button class="btn primary" onclick="document.getElementById('reorder-stat-modal').classList.remove('open')">Chiudi</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    return document.getElementById('reorder-stat-modal');
}

async function renderReorderList() {
    const container = document.getElementById('reorder-stat-list');
    if (!container) return;

    const activeTemplateId = await getActiveTemplateId();
    const allStats = await appDb.getAll('custom_stats');
    let stats = allStats
        .filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (stats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Nessuna statistica presente in questo template.</p>';
        return;
    }

    let draggedIdx = null;

    function buildListUI() {
        container.innerHTML = '';
        stats.forEach((stat, idx) => {
            const item = document.createElement('div');
            item.className = 'reorder-item';
            item.setAttribute('draggable', 'true');
            item.setAttribute('data-idx', idx);

            const typeLabel = getTypeLabel(stat.type);

            item.innerHTML = `
                <div class="reorder-item-handle" title="Trascina per riordinare">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                </div>
                <div class="reorder-item-title">
                    <span>${stat.title || stat.metric}</span>
                    <span class="reorder-item-type">${typeLabel}</span>
                </div>
                <div class="reorder-item-actions">
                    <button class="btn secondary move-up-btn" style="padding:4px 6px; font-size:0.75rem;" title="Sposta Su" ${idx === 0 ? 'disabled' : ''}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button class="btn secondary move-down-btn" style="padding:4px 6px; font-size:0.75rem;" title="Sposta Giù" ${idx === stats.length - 1 ? 'disabled' : ''}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                </div>
            `;

            // Drag events
            item.addEventListener('dragstart', (e) => {
                draggedIdx = idx;
                item.classList.add('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                }
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                    const movedItem = stats.splice(draggedIdx, 1)[0];
                    stats.splice(idx, 0, movedItem);
                    await saveStatsOrder(stats);
                    buildListUI();
                }
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedIdx = null;
            });

            // Button actions
            const upBtn = item.querySelector('.move-up-btn');
            if (upBtn) {
                upBtn.addEventListener('click', async () => {
                    if (idx > 0) {
                        const temp = stats[idx];
                        stats[idx] = stats[idx - 1];
                        stats[idx - 1] = temp;
                        await saveStatsOrder(stats);
                        buildListUI();
                    }
                });
            }

            const downBtn = item.querySelector('.move-down-btn');
            if (downBtn) {
                downBtn.addEventListener('click', async () => {
                    if (idx < stats.length - 1) {
                        const temp = stats[idx];
                        stats[idx] = stats[idx + 1];
                        stats[idx + 1] = temp;
                        await saveStatsOrder(stats);
                        buildListUI();
                    }
                });
            }

            container.appendChild(item);
        });
    }

    buildListUI();
}

async function saveStatsOrder(orderedStats) {
    orderedStats.forEach((stat, index) => {
        stat.order = index;
    });
    await appDb.addMultiple('custom_stats', orderedStats);
    await renderTeamStats();
    await renderIndividualStats();
}

// ============================================================
// TABELLE OBIETTIVI CON VALORI ATTUALI (per sezione Statistiche)
// ============================================================

/**
 * Calcola il valore realizzato per un collaboratore (o tutto il team) per una lista di metriche mappate.
 */
function calcActualForMetric(mappedMetrics, perfData, salesData, employee) {
    let total = 0;
    if (!mappedMetrics || mappedMetrics.length === 0) return total;

    mappedMetrics.forEach(metric => {
        const isPerf = metric.startsWith('Performance: ');
        const rawKey = metric.replace('Performance: ', '').replace('Sales: ', '');
        const source = isPerf ? perfData : salesData;
        source.forEach(row => {
            if (employee && row.employee !== employee) return;
            let val = 0;
            if (!isPerf && row.data && row.data.Product) {
                // record sales con campo Product (nuovi abo)
                if (row.data.Product === rawKey) {
                    val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? row.data[rawKey] ?? 0);
                } else {
                    val = parseMetricValue(row.data[rawKey] ?? 0);
                }
            } else if (row.data) {
                val = parseMetricValue(row.data[rawKey] ?? 0);
            }
            total += val;
        });
    });
    return total;
}

/**
 * Costruisce una singola tabella obiettivi con i dati realizzati vs target (senza barre progressive).
 */
async function buildSingleGoalsActualTable(year, tableId, perfData, salesData, employee) {
    const tablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
    const t = (tablesList || []).find(tbl => tbl.id === tableId);
    if (!t) return null;

    let products = await appDb.getSetting(`sales_table_products_${t.id}`, []);
    if (!products || !Array.isArray(products) || products.length === 0) return null;

    const savedTargets = (await appDb.getSetting(`sales_table_targets_${year}_${t.id}`, {})) || {};
    const manualCollabs = (await appDb.getSetting(`sales_table_collabs_${year}_${t.id}`, null)) || null;
    const collabWorkPcts = (await appDb.getSetting('collab_work_pcts', {})) || {};

    let employees;
    if (employee) {
        employees = [employee];
    } else {
        const empSet = new Set();
        if (manualCollabs && Array.isArray(manualCollabs)) {
            manualCollabs.forEach(n => empSet.add(n));
        } else {
            const skillFilter = t.skill || 'ALL';
            perfData.forEach(d => {
                if (d.employee && (skillFilter === 'ALL' || d.skill === skillFilter)) empSet.add(d.employee);
            });
            salesData.forEach(d => {
                if (d.employee && (skillFilter === 'ALL' || d.skill === skillFilter)) empSet.add(d.employee);
            });
            if (empSet.size === 0) {
                Object.keys(window.appState.anonymousMap || {}).forEach(n => empSet.add(n));
            }
        }
        employees = Array.from(empSet).sort();
    }

    if (employees.length === 0) return null;

    let totalWorkPctSum = 0;
    employees.forEach(emp => { totalWorkPctSum += (collabWorkPcts[emp] ?? 100); });

    const formatVal = (v, isCHF) => {
        if (v === null || v === undefined || v === '') return '—';
        const num = parseFloat(v);
        if (isNaN(num)) return '—';
        if (isCHF) return Math.round(num).toLocaleString('de-CH');
        return Number.isInteger(num) ? num.toString() : num.toFixed(1);
    };

    const table = document.createElement('table');
    table.style.cssText = 'width:auto; border-collapse:collapse; font-size:0.87rem; color:var(--text-main);';

    const thead = document.createElement('thead');
    let headHtml = `<tr style="background:var(--bg-base); border-bottom:2px solid var(--border);">
        <th style="padding:10px 12px; text-align:left; border-right:1px solid var(--border); width:180px; min-width:160px; font-weight:700;">Collaboratore</th>
        <th style="padding:10px 6px; text-align:center; border-right:1px solid var(--border); width:90px; min-width:80px; font-weight:700;">% Lavoro</th>`;

    products.forEach(p => {
        headHtml += `<th style="padding:10px 12px; text-align:center; border-right:1px solid var(--border); font-weight:700; background:rgba(59,130,246,0.05); width:155px; min-width:145px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                <span>${p.label}</span>
                <span style="font-size:0.68rem; color:var(--text-muted); font-weight:500;">
                    ${p.mode === 'team' ? 'Obiettivo Team' : 'Realizzato / Target'}
                </span>
            </div>
        </th>`;
    });
    headHtml += '</tr>';
    thead.innerHTML = headHtml;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    employees.forEach((emp, empIdx) => {
        const empWorkPct = collabWorkPcts[emp] ?? 100;
        const displayName = window.getDisplayName(emp);
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom:1px solid var(--border);';

        let rowHtml = `
            <td style="padding:10px 12px; font-weight:600; border-right:1px solid var(--border); white-space:nowrap;">${displayName}</td>
            <td style="padding:8px 6px; text-align:center; border-right:1px solid var(--border); color:var(--text-muted); font-weight:600;">${empWorkPct}%</td>`;

        products.forEach(p => {
            const mappedMetrics = Array.isArray(p.mappedMetrics) ? p.mappedMetrics
                : (p.mappedMetric ? p.mappedMetric.split(',').map(s => s.trim()).filter(Boolean) : []);
            const actualVal = calcActualForMetric(mappedMetrics, perfData, salesData, emp);

            if (p.mode === 'team') {
                if (empIdx === 0) {
                    const teamTotal = savedTargets['TEAM_' + p.key] ?? 0;
                    const actualTeam = calcActualForMetric(mappedMetrics, perfData, salesData, null);
                    rowHtml += `
                        <td rowspan="${employees.length}" style="padding:12px; text-align:center; vertical-align:middle; border-right:1px solid var(--border); background:rgba(99,102,241,0.03);">
                            <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                                <span style="font-size:0.75rem; color:var(--text-muted);">Realizzato: <strong style="color:var(--text-main); font-family:monospace;">${formatVal(actualTeam, p.isCHF)}</strong></span>
                                <span style="font-size:0.75rem; color:var(--text-muted);">Target: <strong style="color:var(--primary); font-family:monospace;">${formatVal(teamTotal, p.isCHF)}</strong></span>
                            </div>
                        </td>`;
                }
            } else {
                const indivTotal = savedTargets['INDIV_TOTAL_' + p.key] ?? 0;
                const objIndiv = totalWorkPctSum > 0 ? Math.round(indivTotal * (empWorkPct / totalWorkPctSum)) : 0;
                rowHtml += `
                    <td style="padding:8px 12px; text-align:center; border-right:1px solid var(--border); font-family:monospace;">
                        <span style="font-weight:700; color:var(--text-main); font-size:0.92rem;">${formatVal(actualVal, p.isCHF)}</span>
                        <span style="color:var(--text-muted); font-size:0.8rem;"> / ${formatVal(objIndiv, p.isCHF)}</span>
                    </td>`;
            }
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    const tfoot = document.createElement('tfoot');
    let footHtml = `<tr style="background:var(--bg-base); font-weight:700; border-top:2px solid var(--border);">
        <td style="padding:10px 12px; border-right:1px solid var(--border); font-weight:800; color:var(--primary);">TOTALI OBIETTIVI TEAM</td>
        <td style="padding:10px 6px; text-align:center; border-right:1px solid var(--border); font-weight:800;">${totalWorkPctSum}%</td>`;

    products.forEach(p => {
        const mappedMetrics = Array.isArray(p.mappedMetrics) ? p.mappedMetrics
            : (p.mappedMetric ? p.mappedMetric.split(',').map(s => s.trim()).filter(Boolean) : []);
        if (p.mode === 'team') {
            const teamTotal = savedTargets['TEAM_' + p.key] ?? 0;
            footHtml += `<td style="padding:10px 12px; text-align:center; border-right:1px solid var(--border); font-weight:800; color:var(--primary); font-family:monospace;">${formatVal(teamTotal, p.isCHF)}</td>`;
        } else {
            const indivTotal = savedTargets['INDIV_TOTAL_' + p.key] ?? 0;
            footHtml += `<td style="padding:10px 12px; text-align:center; border-right:1px solid var(--border); font-weight:800; color:var(--primary); font-family:monospace;">${formatVal(indivTotal, p.isCHF)}</td>`;
        }
    });
    footHtml += '</tr>';
    tfoot.innerHTML = footHtml;

    table.appendChild(tbody);
    table.appendChild(tfoot);
    return table;
}


