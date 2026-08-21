/**
 * TeamAnalysis
 * © Copyright 2026 Loris Salerno (TAASALO3) - loris.salerno@swisscom.com
 * Tutti i diritti riservati.
 */
// Plugin per aggiungere spaziatura sotto la legenda del grafico
const legendMarginPlugin = {
    id: 'legendMarginPlugin',
    afterFit(legend) {
        if (legend.options && legend.options.display) {
            legend.height += 20;
        }
    }
};

// Plugin per mostrare un testo al centro dell'anello della torta (totale o % obiettivo)
const donutCenterTextPlugin = {
    id: 'donutCenterTextPlugin',
    afterDraw(chart) {
        try {
            const cfg = chart.options && chart.options.plugins && chart.options.plugins.centerText;
            if (!cfg || !cfg.text) return;
            const ctx = chart.ctx;
            const area = chart.chartArea;
            const cx = (area.left + area.right) / 2;
            const cy = (area.top + area.bottom) / 2;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = cfg.color || '#e2e8f0';
            ctx.font = `700 ${cfg.size || 20}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(cfg.text, cx, cy);
            ctx.restore();
        } catch (e) {
            console.error('Donut center text plugin error:', e);
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

            // Linea Obiettivo Viola / Magenta ad alta visibilità
            const yTarget = y.getPixelForValue(goalConfig.target);
            if (!isNaN(yTarget)) {
                ctx.beginPath();
                ctx.setLineDash([]);
                ctx.strokeStyle = '#D946EF';
                ctx.lineWidth = 3;
                ctx.shadowColor = 'rgba(217, 70, 239, 0.6)';
                ctx.shadowBlur = 8;
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

// Register plugins globally for Chart.js v3+
if (typeof Chart !== 'undefined' && Chart.register) {
    Chart.register(donutCenterTextPlugin);
    Chart.register(legendMarginPlugin);
    Chart.register(fullWidthGoalPlugin);
}

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

async function handleCollaboratorTemplateSwitch(employeeName) {
    if (!employeeName) return;
    const assignedTemplateId = window.appState?.collaboratorTemplates?.[employeeName];
    if (!assignedTemplateId) return;

    const tpls = await getTemplates();
    const targetTpl = tpls.find(t => t.id === assignedTemplateId);
    if (!targetTpl) return;

    const currentActive = await getActiveTemplateId();
    if (currentActive !== assignedTemplateId) {
        await appDb.setSetting('active_stat_template', assignedTemplateId);
        const templateSelect = document.getElementById('stat-template-select');
        if (templateSelect) {
            templateSelect.value = assignedTemplateId;
        }
    }
}

window.getTemplates = getTemplates;
window.getActiveTemplateId = getActiveTemplateId;
window.handleCollaboratorTemplateSwitch = handleCollaboratorTemplateSwitch;

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
        await appDialog.alert("Impossibile eliminare l'unico template rimasto.");
        return;
    }
    const target = tpls.find(t => t.id === templateId);
    if (!target) return;

    if (!await appDialog.confirm(`Eliminare il template "${target.name}" e tutte le sue statistiche?`)) return;

    const allStats = await appDb.getAll('custom_stats');
    for (const s of allStats) {
        if (s.templateId === templateId || (!s.templateId && templateId === 'default')) {
            await appDb.deleteRecord('custom_stats', s.id);
        }
    }
    if (appDb.addImportLog) appDb.addImportLog(`[${new Date().toLocaleTimeString()}] Eliminato template "${target.name}" e tutte le sue statistiche.`, false, 'Statistica');

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
        const inputName = await appDialog.prompt('Nome del nuovo template:');
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
            // Sincronizza per-collaboratore se siamo in vista individuale (stesso motivo del select globale)
            const isIndView = document.querySelector('.tab-btn[data-target="stat-individual"]')?.classList.contains('active');
            const selEmp = document.getElementById('individual-select')?.value;
            if (isIndView && selEmp && window.appState?.collaboratorTemplates?.[selEmp]) {
                window.appState.collaboratorTemplates[selEmp] = id;
                try {
                    const year = window.appState.activeYear;
                    const allMappings = await appDb.getAll('anonymous_map', 'year', year);
                    const mapRecord = allMappings.find(m => m.realName === selEmp);
                    if (mapRecord) {
                        mapRecord.templateId = id;
                        await appDb.updateRecord('anonymous_map', mapRecord);
                    }
                } catch (e) {}
            }
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
        const newId = select.value;
        await appDb.setSetting('active_stat_template', newId);
        // Se siamo in vista individuale con collaboratore selezionato che ha già un template dedicato,
        // sincronizza anche il mapping per-collaboratore altrimenti verrebbe subito sovrascritto da handleCollaboratorTemplateSwitch
        const isIndView = document.querySelector('.tab-btn[data-target="stat-individual"]')?.classList.contains('active');
        const selEmp = document.getElementById('individual-select')?.value;
        if (isIndView && selEmp && window.appState?.collaboratorTemplates?.[selEmp]) {
            window.appState.collaboratorTemplates[selEmp] = newId;
            try {
                const year = window.appState.activeYear;
                const allMappings = await appDb.getAll('anonymous_map', 'year', year);
                const mapRecord = allMappings.find(m => m.realName === selEmp);
                if (mapRecord) {
                    mapRecord.templateId = newId;
                    await appDb.updateRecord('anonymous_map', mapRecord);
                }
            } catch (e) {}
        }
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
        createBtn.addEventListener('click', () => openStatModal());
    }
    
    const reorderBtn = document.getElementById('reorder-stats-btn');
    if(reorderBtn) {
        reorderBtn.addEventListener('click', openReorderModal);
    }
    
    // Setup Individual Select change listener
    const indSelect = document.getElementById('individual-select');
    if(indSelect) {
        indSelect.addEventListener('change', async () => {
            if (window.appDb) await appDb.setSetting('stat_selected_employee', indSelect.value);
            await handleCollaboratorTemplateSwitch(indSelect.value);
            renderIndividualStats();
        });
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

    function updateMainTeamAvgToggleVisibility() {
        const label = document.getElementById('show-team-avg-team-label');
        if (label) {
            label.style.display = (teamViewMode === 'avg') ? 'none' : 'flex';
        }
    }

    if (allBtn && avgBtn) {
        allBtn.addEventListener('click', async () => {
            teamViewMode = 'all';
            await appDb.setSetting('stat_team_view_mode', 'all');
            allBtn.classList.add('active');
            avgBtn.classList.remove('active');
            updateMainTeamAvgToggleVisibility();
            renderTeamStats();
        });
        avgBtn.addEventListener('click', async () => {
            teamViewMode = 'avg';
            await appDb.setSetting('stat_team_view_mode', 'avg');
            avgBtn.classList.add('active');
            allBtn.classList.remove('active');
            updateMainTeamAvgToggleVisibility();
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

    // Global listener to close custom collaborator dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.collab-dropdown-wrapper')) {
            document.querySelectorAll('.collab-dropdown-wrapper.open').forEach(w => {
                w.classList.remove('open');
                const trigger = w.querySelector('.collab-select-trigger');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            });
        }
    });
    
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
        updateMainTeamAvgToggleVisibility();

        // Restore active sub-tab (stat-team vs stat-individual)
        const savedSubTab = await appDb.getSetting('stat_sub_tab', 'stat-team');
        const savedEmployee = await appDb.getSetting('stat_selected_employee', '');
        const teamTabBtn = document.querySelector('.tab-btn[data-target="stat-team"]');
        const indTabBtn = document.querySelector('.tab-btn[data-target="stat-individual"]');
        const teamContent = document.getElementById('stat-team');
        const indContent = document.getElementById('stat-individual');
        const tc = document.getElementById('team-header-controls-TAASALO3');
        const ic = document.getElementById('individual-header-controls-TAASALO3');
        const cc = document.getElementById('stats-center-controls');

        if (savedSubTab === 'stat-individual') {
            if (savedEmployee) {
                await handleCollaboratorTemplateSwitch(savedEmployee);
            }
            if (teamTabBtn) teamTabBtn.classList.remove('active');
            if (indTabBtn) indTabBtn.classList.add('active');
            if (teamContent) teamContent.classList.remove('active');
            if (indContent) indContent.classList.add('active');
            if (tc) tc.style.display = 'none';
            if (ic) ic.style.display = 'flex';
            if (cc) cc.style.display = 'none';
        } else {
            if (teamTabBtn) teamTabBtn.classList.add('active');
            if (indTabBtn) indTabBtn.classList.remove('active');
            if (teamContent) teamContent.classList.add('active');
            if (indContent) indContent.classList.remove('active');
            if (tc) tc.style.display = 'flex';
            if (ic) ic.style.display = 'none';
            if (cc) cc.style.display = 'flex';
        }

        // Populate individual select
        const select = document.getElementById('individual-select');
        const currentVal = select ? (select.value || savedEmployee) : savedEmployee;
        const placeholder = window.appState.isAnonymous ? 'Seleziona Collab...' : 'Seleziona Collaboratore...';
        if (select) {
            select.innerHTML = `<option value="">${placeholder}</option>`;
        }
        
        const names = Object.keys(window.appState.anonymousMap || {}).sort((a, b) => {
            return window.getDisplayName(a).localeCompare(window.getDisplayName(b), undefined, { numeric: true });
        });
        if (select) {
            names.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = window.getDisplayName(name);
                if(name === currentVal) opt.selected = true;
                select.appendChild(opt);
            });
            if (currentVal && names.includes(currentVal)) {
                select.value = currentVal;
            } else if (currentVal && !names.includes(currentVal)) {
                select.value = '';
            }
        }

        // Setup custom dropdown in header
        const headerWrapper = document.getElementById('header-collab-dropdown-wrapper-TAASALO3');
        const headerTrigger = document.getElementById('header-collab-trigger-TAASALO3');
        const headerLabel = document.getElementById('header-collab-label-TAASALO3');
        const headerMenu = document.getElementById('header-collab-menu-TAASALO3');

        setupCollabCustomDropdown({
            wrapper: headerWrapper,
            trigger: headerTrigger,
            label: headerLabel,
            menu: headerMenu,
            currentValue: select ? select.value : '',
            names: names,
            placeholder: placeholder,
            onSelect: async (val) => {
                if (select) select.value = val;
                if (window.appDb) await appDb.setSetting('stat_selected_employee', val);
                await handleCollaboratorTemplateSwitch(val);
                renderIndividualStats();
            }
        });
        
        await renderTeamStats();
        await renderIndividualStats();
    };

    window.renderIndividualStats = renderIndividualStats;
    window.renderTeamStats = renderTeamStats;
});

function setupCollabCustomDropdown({ wrapper, trigger, label, menu, currentValue, names, placeholder, onSelect }) {
    if (!wrapper || !trigger || !label || !menu) return;

    label.textContent = currentValue ? window.getDisplayName(currentValue) : placeholder;
    trigger.setAttribute('aria-expanded', 'false');

    function renderMenuItems(filter = '') {
        const query = filter.trim().toLowerCase();
        const filteredNames = (names || []).filter(n => {
            const disp = window.getDisplayName(n).toLowerCase();
            const real = n.toLowerCase();
            return disp.includes(query) || real.includes(query);
        });

        let itemsHtml = '';
        
        // Reset / Empty option at top
        const isResetSelected = !currentValue;
        itemsHtml += `
            <div class="collab-dropdown-item ${isResetSelected ? 'selected' : ''}" data-value="" title="${placeholder}">
                <div class="collab-item-left">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                    <span style="font-style:italic; opacity:0.8;">${placeholder}</span>
                </div>
                ${isResetSelected ? '<span class="collab-item-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' : ''}
            </div>
        `;

        if (filteredNames.length === 0) {
            itemsHtml += `<div class="collab-item-empty">Nessun collaboratore trovato</div>`;
        } else {
            filteredNames.forEach(name => {
                const isSelected = name === currentValue;
                const dispName = window.getDisplayName(name);
                itemsHtml += `
                    <div class="collab-dropdown-item ${isSelected ? 'selected' : ''}" data-value="${name}" title="${dispName}">
                        <div class="collab-item-left">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <span>${dispName}</span>
                        </div>
                        ${isSelected ? '<span class="collab-item-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' : ''}
                    </div>
                `;
            });
        }

        const listEl = menu.querySelector('.collab-list');
        if (listEl) {
            listEl.innerHTML = itemsHtml;
            attachItemListeners(listEl);
        }
    }

    function attachItemListeners(listEl) {
        listEl.querySelectorAll('.collab-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = item.getAttribute('data-value') || '';
                label.textContent = val ? window.getDisplayName(val) : placeholder;
                wrapper.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                onSelect(val);
            });
        });
    }

    const showSearch = (names || []).length > 5;
    menu.innerHTML = `
        ${showSearch ? `
            <div class="collab-search-box">
                <span class="collab-search-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input type="text" class="collab-search-input" placeholder="Cerca..." autocomplete="off">
            </div>
        ` : ''}
        <div class="collab-list"></div>
    `;

    renderMenuItems('');

    const searchInput = menu.querySelector('.collab-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderMenuItems(e.target.value);
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                wrapper.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    trigger.onclick = (e) => {
        e.stopPropagation();
        const wasOpen = wrapper.classList.contains('open');
        document.querySelectorAll('.collab-dropdown-wrapper.open').forEach(w => {
            w.classList.remove('open');
            const tr = w.querySelector('.collab-select-trigger');
            if (tr) tr.setAttribute('aria-expanded', 'false');
        });

        if (!wasOpen) {
            wrapper.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            if (searchInput) {
                searchInput.value = '';
                renderMenuItems('');
                setTimeout(() => searchInput.focus(), 50);
            }
        }
    };
}

const DISTINCT_COLORS = [
    '#2563EB', '#10B981', '#8B5CF6', '#F97316', 
    '#EC4899', '#06B6D4', '#F59E0B', '#EF4444', '#64748B'
];

// Origine dati selezionata nel modal statistiche: 'performance' | 'sales' | 'stati'
let currentStatSource = 'performance';

// Tipi di visualizzazione disponibili per ciascuna origine dati
const STAT_SOURCE_TYPES = {
    performance: [
        { value: 'bar', label: 'Grafico a Barre' },
        { value: 'line', label: 'Grafico a Linee' },
        { value: 'table', label: 'Tabella Dati' },
        { value: 'pie', label: 'Grafico a Torta' }
    ],
    sales: [
        { value: 'bar', label: 'Grafico a Barre' },
        { value: 'line', label: 'Grafico a Linee' },
        { value: 'table', label: 'Tabella Dati' },
        { value: 'pie', label: 'Grafico a Torta' },
        { value: 'goals_table', label: 'Tabella Obiettivi Vendita' }
    ],
    stati: [
        { value: 'bar', label: 'Grafico a Barre' },
        { value: 'line', label: 'Grafico a Linee' },
        { value: 'table', label: 'Tabella Dati' },
        { value: 'pie', label: 'Grafico a Torta' }
    ]
};

// Icone SVG per ciascun tipo di visualizzazione
const STAT_TYPE_ICONS = {
    bar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>',
    line: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 15 9 9 13 13 21 5"></polyline><line x1="3" y1="21" x2="21" y2="21"></line></svg>',
    table: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="9" y1="4" x2="9" y2="20"></line><line x1="15" y1="4" x2="15" y2="20"></line></svg>',
    pie: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>',
    goals_table: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle></svg>'
};

let currentEditingStatId = null;

async function openStatModal(editingStat = null) {
    currentEditingStatId = editingStat ? editingStat.id : null;
    // 1. Gather all unique metrics from current year DB
    const year = window.appState.activeYear;
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const statiData = await appDb.getAll('stati', 'year', year);
    
    const metrics = new Set();
    perfData.forEach(d => Object.keys(d.data).forEach(k => metrics.add(`Performance: ${k}`)));
    salesData.forEach(d => {
        Object.keys(d.data).forEach(k => {
            if(k !== 'Product') metrics.add(`Sales: ${k}`);
        });
    });
    statiData.forEach(d => {
        Object.keys(d.data).forEach(k => metrics.add(`Stati: ${k.replace(/^State Rcode - /, '')}`));
    });
    
    const tablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
    (tablesList || []).forEach(t => {
        metrics.add(`Tabella Obiettivi: ${t.name}`);
    });
    
    // Gather skills solo tra quelli assegnati ai collaboratori (evita skill non rilevanti tipo prodotti Sales)
    const skills = new Set();
    try {
        Object.values(window.appState.collaboratorSkills || {}).forEach(list => {
            (Array.isArray(list) ? list : []).forEach(s => { if (s) skills.add(String(s).trim()); });
        });
        // Fallback: se nessun collaboratore ha skill assegnate, usa la lista skills globale
        if (skills.size === 0) {
            const savedSkills = await appDb.getSetting('skills', null);
            if (Array.isArray(savedSkills)) savedSkills.forEach(s => { if (s) skills.add(String(s).trim()); });
        }
        // Ultimo fallback: skill presenti nei dati performance (storico)
        if (skills.size === 0) {
            perfData.forEach(d => { if (d.skill) skills.add(String(d.skill).trim()); });
        }
    } catch (e) {}

    // 2. Show Modal
    let modal = document.getElementById('stat-config-modal');
    if (!modal) {
        modal = createStatModalHTML();
    }

    const modalTitle = modal.querySelector('.modal-header h2');
    const saveBtn = modal.querySelector('.modal-header .btn.primary') || modal.querySelector('#modal-save-btn');
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
        const names = Object.keys(window.appState.anonymousMap || {}).sort((a, b) => {
            return window.getDisplayName(a).localeCompare(window.getDisplayName(b), undefined, { numeric: true });
        });
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = window.getDisplayName(name);
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

    // Determina l'origine dati iniziale: dalla statistica in modifica o default Performance
    currentStatSource = 'performance';
    if (editingStat) {
        if (editingStat.type === 'goals_table') {
            currentStatSource = 'sales';
        } else if (editingStat.metric && editingStat.metric.startsWith('Sales: ')) {
            currentStatSource = 'sales';
        } else if (editingStat.metric && editingStat.metric.startsWith('Stati: ')) {
            currentStatSource = 'stati';
        } else if (editingStat.metric && editingStat.metric.startsWith('Performance: ')) {
            currentStatSource = 'performance';
        } else if (editingStat.metric) {
            // Metriche senza prefisso: comportamento legacy, considera Sales
            currentStatSource = 'sales';
        }
    }

    function getSourceMetrics() {
        if (currentStatSource === 'sales') {
            return allMetrics.filter(m => m.startsWith('Sales: ') || m.startsWith('Tabella Obiettivi: '));
        }
        if (currentStatSource === 'stati') {
            return allMetrics.filter(m => m.startsWith('Stati: '));
        }
        return allMetrics.filter(m => m.startsWith('Performance: '));
    }

    // Mostra la metrica senza il prefisso dell'origine dati (già selezionata sopra),
    // mantenendo la "Tabella Obiettivi:" come etichetta significativa della metrica.
    function metricDisplay(fullValue) {
        if (!fullValue) return '';
        if (currentStatSource === 'sales') {
            return fullValue.replace(/^Sales: /, '');
        }
        if (currentStatSource === 'stati') {
            return fullValue.replace(/^Stati: /, '').replace(/^State Rcode - /, '');
        }
        return fullValue.replace(/^Performance: /, '');
    }

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
                    <input type="text" class="stat-metric-search" placeholder="Cerca metrica" autocomplete="off" style="width:100%; padding:8px 32px 8px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);" value="${metricDisplay(selectedMetric)}">
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
            const filtered = getSourceMetrics().filter(m => {
                const disp = metricDisplay(m);
                return (!query || disp.toLowerCase().includes(query)) && (!selectedInOtherRows.has(m) || m === selectedMetric);
            });
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
                item.textContent = metricDisplay(m);
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectedMetric = m;
                    hiddenInput.value = m;
                    searchInput.value = metricDisplay(m);
                    dropdown.classList.remove('open');
                    renderDropdown(metricDisplay(m));

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
            if (selectedMetric && searchInput.value === metricDisplay(selectedMetric)) {
                searchInput.select();
            }
            renderDropdown(searchInput.value === metricDisplay(selectedMetric) ? '' : searchInput.value);
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
                searchInput.value = metricDisplay(selectedMetric);
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
        const isGoalsTable = type === 'goals_table';
        const goalsTableId = isGoalsTable ? (document.getElementById('stat-goals-table-id')?.value || '') : '';

        // Suggerimento quando la modalità Pacchetti è incompatibile con i dati Performance
        const pieModeSel = document.getElementById('stat-pie-mode');
        const pieModeHint = document.getElementById('pie-mode-hint');
        if (pieModeSel && pieModeHint) {
            const firstMetric = selectedMetricsList[0] || '';
            const isNonSalesMetric = firstMetric.startsWith('Performance: ') || firstMetric.startsWith('Stati: ');
            const showHint = type === 'pie' && pieModeSel.value !== 'collaboratori' && isNonSalesMetric;
            pieModeHint.style.display = showHint ? 'block' : 'none';
            pieModeHint.textContent = showHint ? 'Le modalità Pacchetti e Doppia Torta funzionano solo con i dati Sales: seleziona una metrica Sales oppure torna a "Prezzo totale per ogni Collaboratore".' : '';
        }

        if (isGoalsTable) {
            if (!goalsTableId) {
                container.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Seleziona una tabella obiettivi per vedere l\'anteprima</span>';
                return;
            }
        } else if (selectedMetricsList.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Seleziona almeno un dato/metrica per vedere l\'anteprima</span>';
            return;
        }

        const isMulti = selectedMetricsList.length > 1;

        const y2Container = document.getElementById('y2-scale-container');
        if (y2Container) y2Container.style.display = isMulti ? 'flex' : 'none';

        const customYMin = parseFloat(document.getElementById('stat-y-min')?.value);
        const customYMax = parseFloat(document.getElementById('stat-y-max')?.value);
        const customY2Min = parseFloat(document.getElementById('stat-y2-min')?.value);
        const customY2Max = parseFloat(document.getElementById('stat-y2-max')?.value);

        const isIndividualView = document.getElementById('preview-mode-ind-btn')?.classList.contains('active') || false;
        const selectedEmployee = isIndividualView ? (document.getElementById('preview-individual-select')?.value || '') : '';

        const showTeamAvg = document.getElementById('preview-show-team-avg')?.checked || false;
        const showTeamGoal = document.getElementById('preview-show-team-goal')?.checked || false;
        const teamAvgOnly = !isIndividualView && (document.getElementById('preview-view-avg-btn')?.classList.contains('active') || false);

        const yr = window.appState.activeYear || new Date().getFullYear().toString();
        const pData = await appDb.getAll('performance', 'year', yr);
        const sData = await appDb.getAll('sales', 'year', yr);
        const stData = await appDb.getAll('stati', 'year', yr);
        const gData = await appDb.getAll('goals', 'year', yr);

        const tempStatConfig = {
            id: currentEditingStatId || 'preview_temp',
            metric: selectedMetricsList[0],
            metrics: selectedMetricsList,
            colors: selectedColorsList,
            skill: skill,
            type: type,
            goalsTableId: goalsTableId,
            pieMode: (currentStatSource !== 'sales' ? 'collaboratori' : (document.getElementById('stat-pie-mode')?.value || 'collaboratori')),
            pieGoalCenter: document.getElementById('pie-goal-center')?.checked || false,
            title: isGoalsTable ? 'Tabella Obiettivi Vendita' : (selectedMetricsList.length > 1 ? selectedMetricsList.join(' + ') : selectedMetricsList[0].replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '')),
            yMin: customYMin,
            yMax: customYMax,
            y2Min: customY2Min,
            y2Max: customY2Max
        };

        const existingCanvases = container.querySelectorAll('canvas');
        existingCanvases.forEach(c => {
            const chart = Chart.getChart(c);
            if (chart) chart.destroy();
        });

        container.innerHTML = '';
        const cardNode = await buildStatCard(tempStatConfig, pData, sData, stData, gData, isIndividualView, selectedEmployee, teamAvgOnly, showTeamAvg, showTeamGoal, true);
        if (cardNode) {
            container.appendChild(cardNode);
            // Forza resize del grafico dopo che il contenitore diventa visibile (fix anteprima buggata)
            requestAnimationFrame(() => {
                const cvs = container.querySelectorAll('canvas');
                cvs.forEach(c => {
                    const ch = Chart.getChart(c);
                    if (ch) ch.resize();
                });
            });
        }

        const canvas = cardNode ? cardNode.querySelector('canvas') : null;
        if (canvas) {
            const chart = Chart.getChart(canvas);
            if (chart && chart.scales) {
                const yMinInput = document.getElementById('stat-y-min');
                if (yMinInput && chart.scales.y && chart.scales.y.min !== undefined) {
                    yMinInput.placeholder = `es. ${chart.scales.y.min}`;
                }
                const yMaxInput = document.getElementById('stat-y-max');
                if (yMaxInput && chart.scales.y && chart.scales.y.max !== undefined) {
                    yMaxInput.placeholder = `es. ${chart.scales.y.max}`;
                }
                const y2MinInput = document.getElementById('stat-y2-min');
                if (y2MinInput && chart.scales.y2 && chart.scales.y2.min !== undefined) {
                    y2MinInput.placeholder = `es. ${chart.scales.y2.min}`;
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
    const yMinInput = document.getElementById('stat-y-min');
    const yMaxInput = document.getElementById('stat-y-max');
    const y2MinInput = document.getElementById('stat-y2-min');
    const y2MaxInput = document.getElementById('stat-y2-max');
    const goalsTableSelectorGroup = document.getElementById('goals-table-selector-group');
    const goalsTableIdSelect = document.getElementById('stat-goals-table-id');
    const metricsContainer2 = document.getElementById('stat-metrics-container');
    const addMetricBtn2 = document.getElementById('add-metric-btn');
    const yScaleGroup = document.getElementById('y-scale-custom-group');
    const sourcePerfBtn = document.getElementById('stat-source-performance');
    const sourceSalesBtn = document.getElementById('stat-source-sales');
    const sourceStatiBtn = document.getElementById('stat-source-stati');

    // Popola il select tipo di visualizzazione in base all'origine dati
    function populateTypeSelect(source) {
        if (!typeSelect) return;
        const types = STAT_SOURCE_TYPES[source] || STAT_SOURCE_TYPES.performance;
        const currentVal = typeSelect.value;
        typeSelect.innerHTML = '';
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.value;
            opt.textContent = t.label;
            if (t.value === currentVal) opt.selected = true;
            typeSelect.appendChild(opt);
        });
        // Se il tipo corrente non è valido per l'origine, torna al primo
        if (!currentVal || !types.some(t => t.value === currentVal)) {
            typeSelect.value = types[0].value;
        }
        // Genera i pulsanti personalizzati del tipo visualizzazione
        const typeSelector = document.getElementById('stat-type-selector');
        if (typeSelector) {
            typeSelector.innerHTML = '';
            types.forEach(t => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'stat-type-btn' + (t.value === typeSelect.value ? ' active' : '');
                btn.dataset.type = t.value;
                btn.title = t.label;
                btn.innerHTML = (STAT_TYPE_ICONS[t.value] || '') + '<span>' + t.label + '</span>';
                btn.addEventListener('click', () => {
                    typeSelect.value = t.value;
                    typeSelector.querySelectorAll('.stat-type-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.type === t.value);
                    });
                    applyTypeUI(typeSelect.value);
                    schedulePreview();
                });
                typeSelector.appendChild(btn);
            });
        }
        applyTypeUI(typeSelect.value);
    }

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
        const isPie = typeVal === 'pie';
        const isTable = typeVal === 'table';
        if (goalsTableSelectorGroup) goalsTableSelectorGroup.style.display = isGoalsTable ? 'block' : 'none';
        if (metricsContainer2) metricsContainer2.style.display = isGoalsTable ? 'none' : '';
        if (addMetricBtn2) addMetricBtn2.style.display = isGoalsTable ? 'none' : '';
        if (skillSelect) skillSelect.parentElement && (skillSelect.closest('div, label') || skillSelect).closest('[style]') || null;
        const skillGroup = document.getElementById('stat-skill-group');
        const skillLabel = skillSelect ? skillSelect.previousElementSibling : null;
        const isPerfSource = currentStatSource === 'performance';
        const showSkill = !isGoalsTable && (isPerfSource || isPie);
        if (skillGroup) skillGroup.style.display = showSkill ? '' : 'none';
        if (skillSelect) skillSelect.style.display = showSkill ? '' : 'none';
        if (skillLabel && skillLabel.tagName === 'LABEL') skillLabel.style.display = showSkill ? '' : 'none';
        if (yScaleGroup) yScaleGroup.style.display = (isGoalsTable || isPie || isTable) ? 'none' : '';
        const pieModeGroup = document.getElementById('pie-mode-group');
        // Contenuto della Torta (pacchetti/doppia) ha senso solo per origine Sales
        const isSalesSource = currentStatSource === 'sales';
        if (pieModeGroup) pieModeGroup.style.display = (isPie && isSalesSource) ? 'block' : 'none';
    }

    function syncSourceButtons() {
        if (sourcePerfBtn) sourcePerfBtn.classList.toggle('active', currentStatSource === 'performance');
        if (sourceSalesBtn) sourceSalesBtn.classList.toggle('active', currentStatSource === 'sales');
        if (sourceStatiBtn) sourceStatiBtn.classList.toggle('active', currentStatSource === 'stati');
    }

    if (editingStat) {
        if (editingStat.skill) skillSelect.value = editingStat.skill;
        if (editingStat.type) typeSelect.value = editingStat.type;
        if (yMinInput) yMinInput.value = (editingStat.yMin !== undefined && editingStat.yMin !== null && !isNaN(editingStat.yMin)) ? editingStat.yMin : '';
        if (yMaxInput) yMaxInput.value = editingStat.yMax || '';
        if (y2MinInput) y2MinInput.value = (editingStat.y2Min !== undefined && editingStat.y2Min !== null && !isNaN(editingStat.y2Min)) ? editingStat.y2Min : '';
        if (y2MaxInput) y2MaxInput.value = editingStat.y2Max || '';
        const pieModeSelect = document.getElementById('stat-pie-mode');
        if (pieModeSelect && editingStat.pieMode) pieModeSelect.value = editingStat.pieMode;
        const pieGoalCenterCb = document.getElementById('pie-goal-center');
        if (pieGoalCenterCb) pieGoalCenterCb.checked = !!editingStat.pieGoalCenter;
        syncSourceButtons();
        populateTypeSelect(currentStatSource);
        applyTypeUI(editingStat.type || 'bar');
    } else {
        syncSourceButtons();
        populateTypeSelect(currentStatSource);
        applyTypeUI('bar');
    }

    function switchStatSource(source) {
        if (currentStatSource === source) return;
        currentStatSource = source;
        syncSourceButtons();
        // Ricrea le righe metrica per il nuovo filtro origine dati
        metricsContainer.innerHTML = '';
        createMetricRow();
        populateTypeSelect(currentStatSource);
        schedulePreview();
    }

    if (sourcePerfBtn) sourcePerfBtn.onclick = () => switchStatSource('performance');
    if (sourceSalesBtn) sourceSalesBtn.onclick = () => switchStatSource('sales');
    if (sourceStatiBtn) sourceStatiBtn.onclick = () => switchStatSource('stati');

    // Sincronizza l'evidenziazione dei pulsanti tipo con il valore corrente del select
    function syncTypeSelectorButtons() {
        const typeSelector = document.getElementById('stat-type-selector');
        if (!typeSelector) return;
        typeSelector.querySelectorAll('.stat-type-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.type === typeSelect.value);
        });
    }

    typeSelect.onchange = (e) => {
        syncTypeSelectorButtons();
        applyTypeUI(e.target.value);
        schedulePreview();
    };
    skillSelect.onchange = schedulePreview;
    if (yMinInput) yMinInput.oninput = schedulePreview;
    if (yMaxInput) yMaxInput.oninput = schedulePreview;
    if (y2MinInput) y2MinInput.oninput = schedulePreview;
    if (y2MaxInput) y2MaxInput.oninput = schedulePreview;
    if (goalsTableIdSelect) goalsTableIdSelect.onchange = schedulePreview;
    const pieModeSelect2 = document.getElementById('stat-pie-mode');
    if (pieModeSelect2) pieModeSelect2.onchange = schedulePreview;
    const pieGoalCenterCb2 = document.getElementById('pie-goal-center');
    if (pieGoalCenterCb2) pieGoalCenterCb2.onchange = schedulePreview;

    function updatePreviewAvgToggleVisibility() {
        const previewAvgLabel = modal.querySelector('#preview-show-team-avg-label');
        const isAvgActive = viewAvgBtn?.classList.contains('active');
        const isIndActive = modeIndBtn?.classList.contains('active');
        if (previewAvgLabel) {
            previewAvgLabel.style.display = (!isIndActive && isAvgActive) ? 'none' : 'flex';
        }
    }

    // Listener toggle anteprima (media team, obiettivo, tutti/solo media, vista team/singolo)

    if (showAvgToggle) showAvgToggle.addEventListener('change', () => schedulePreview());
    if (showGoalToggle) showGoalToggle.addEventListener('change', () => schedulePreview());
    if (viewAllBtn && viewAvgBtn) {
        viewAllBtn.addEventListener('click', () => {
            viewAllBtn.classList.add('active');
            viewAvgBtn.classList.remove('active');
            updatePreviewAvgToggleVisibility();
            schedulePreview();
        });
        viewAvgBtn.addEventListener('click', () => {
            viewAvgBtn.classList.add('active');
            viewAllBtn.classList.remove('active');
            updatePreviewAvgToggleVisibility();
            schedulePreview();
        });
    }
    if (modeTeamBtn && modeIndBtn) {
        modeTeamBtn.addEventListener('click', () => {
            modeTeamBtn.classList.add('active');
            modeIndBtn.classList.remove('active');
            if (teamTabs) teamTabs.style.display = 'inline-flex';
            if (indSelectContainer) indSelectContainer.style.display = 'none';
            updatePreviewAvgToggleVisibility();
            schedulePreview();
        });
        modeIndBtn.addEventListener('click', () => {
            modeIndBtn.classList.add('active');
            modeTeamBtn.classList.remove('active');
            if (teamTabs) teamTabs.style.display = 'none';
            if (indSelectContainer) indSelectContainer.style.display = 'inline-flex';
            updatePreviewAvgToggleVisibility();
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
    updatePreviewAvgToggleVisibility();
    schedulePreview();
}

function createStatModalHTML() {
    const html = `
    <div id="stat-config-modal" class="modal">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h2>Nuova Statistica</h2>
            <div style="display:flex; align-items:center; gap:12px;">
                <button class="btn primary" id="modal-save-btn" onclick="saveNewStat()" style="padding:6px 16px; font-size:0.85rem;">Salva Statistica</button>
                <button class="close-modal" onclick="document.getElementById('stat-config-modal').classList.remove('open')">&times;</button>
            </div>
        </div>
        <div class="stat-modal-layout">
            <div class="stat-modal-form">
                <div id="stat-source-group" style="margin-bottom:16px;">
                    <label style="font-weight:700;">Origine Dati:</label>
                    <div style="display:flex; gap:8px; margin-top:6px;">
                        <button type="button" class="stat-source-btn active" id="stat-source-performance" data-source="performance" style="flex:1; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                            Performance
                        </button>
                        <button type="button" class="stat-source-btn" id="stat-source-sales" data-source="sales" style="flex:1; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                            Vendita
                        </button>
                        <button type="button" class="stat-source-btn" id="stat-source-stati" data-source="stati" style="flex:1; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            Stati
                        </button>
                    </div>
                </div>

                <label style="font-weight:700;">Tipo Visualizzazione:</label>
                <div id="stat-type-selector" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;"></div>
                <select id="stat-type" style="display:none;"></select>

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

                <div id="pie-mode-group" style="display:none; margin-bottom:16px;">
                    <label style="font-weight:700;">Contenuto della Torta:</label>
                    <select id="stat-pie-mode" style="width:100%; padding:8px;">
                        <option value="collaboratori">Prezzo totale per ogni Collaboratore</option>
                        <option value="pacchetti">Nomi Pacchetti con Quantità (intero Team)</option>
                        <option value="doppia">Doppia Torta: Prezzo Pacchetti (Team) + Collaboratori</option>
                    </select>
                    <label class="toggle-switch" style="display:flex; align-items:center; cursor:pointer; margin-top:10px;">
                        <input type="checkbox" id="pie-goal-center">
                        <span class="slider"></span>
                        <span class="label" style="font-size:0.8rem; margin-left:6px;">Mostra % Obiettivo al Centro</span>
                    </label>
                    <div id="pie-mode-hint" style="font-size:0.75rem; color:var(--text-muted); margin-top:4px; display:none;"></div>
                </div>

                <div id="stat-skill-group">
                    <label>Filtro Skill Performance (opzionale):</label>
                    <select id="stat-skill" style="width:100%; padding:8px; margin-bottom:16px;"></select>
                </div>

                <div id="y-scale-custom-group" style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="font-size:0.78rem;">Min Asse Y (Sinistra):</label>
                            <input type="number" id="stat-y-min" placeholder="es. 0" style="width:100%; padding:6px; font-size:0.85rem;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.78rem;">Max Asse Y (Sinistra):</label>
                            <input type="number" id="stat-y-max" placeholder="es. 7000" style="width:100%; padding:6px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div id="y2-scale-container" style="display:none; gap:12px;">
                        <div style="flex:1;">
                            <label style="font-size:0.78rem;">Min Asse Y (Destra, opz.):</label>
                            <input type="number" id="stat-y2-min" placeholder="es. 0" style="width:100%; padding:6px; font-size:0.85rem;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.78rem;">Max Asse Y (Destra, opz.):</label>
                            <input type="number" id="stat-y2-max" placeholder="es. 500" style="width:100%; padding:6px; font-size:0.85rem;">
                        </div>
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
                        <label class="toggle-switch" id="preview-show-team-avg-label" style="display:flex; align-items:center; cursor:pointer; font-size:0.8rem;">
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
                <div class="stat-modal-preview-inner" id="stat-preview-container" style="flex:1; min-height:220px;">
                    <span style="color:var(--text-muted); font-size:0.85rem;">Seleziona una metrica per vedere l'anteprima</span>
                </div>
            </div>
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
    const currentEditingStatIdPrev = currentEditingStatId;

    // Tipo speciale: Tabella Obiettivi Vendita
    if (type === 'goals_table') {
        const tableId = document.getElementById('stat-goals-table-id')?.value || '';
        if (!tableId) { await appDialog.alert('Seleziona una tabella obiettivi.'); return; }
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
        await appDialog.alert('Seleziona almeno un dato/metrica');
        return;
    }

    const primaryMetric = selectedMetrics[0];
    const rawKeys = selectedMetrics.map(m => m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '').replace('Stati: ', ''));
    const title = rawKeys.join('  +  ');
    const skill = document.getElementById('stat-skill').value;
    const product = '';
    const groupId = (document.getElementById('stat-group')?.value || '') || null;

    const yMinVal = parseFloat(document.getElementById('stat-y-min')?.value);
    const yMaxVal = parseFloat(document.getElementById('stat-y-max')?.value);
    const y2MinVal = parseFloat(document.getElementById('stat-y2-min')?.value);
    const y2MaxVal = parseFloat(document.getElementById('stat-y2-max')?.value);
    const rawPieModeVal = document.getElementById('stat-pie-mode')?.value || 'collaboratori';
    const pieModeVal = (currentStatSource !== 'sales') ? 'collaboratori' : rawPieModeVal;
    const pieGoalCenterVal = document.getElementById('pie-goal-center')?.checked || false;

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
            existing.pieMode = pieModeVal;
            existing.pieGoalCenter = pieGoalCenterVal;
            existing.yMin = !isNaN(yMinVal) ? yMinVal : null;
            existing.yMax = !isNaN(yMaxVal) && yMaxVal > 0 ? yMaxVal : null;
            existing.y2Min = !isNaN(y2MinVal) ? y2MinVal : null;
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
            pieMode: pieModeVal,
            pieGoalCenter: pieGoalCenterVal,
            yMin: !isNaN(yMinVal) ? yMinVal : null,
            yMax: !isNaN(yMaxVal) && yMaxVal > 0 ? yMaxVal : null,
            y2Min: !isNaN(y2MinVal) ? y2MinVal : null,
            y2Max: !isNaN(y2MaxVal) && y2MaxVal > 0 ? y2MaxVal : null,
            groupId: groupId || null,
            templateId: activeTemplateId,
            year: window.appState.activeYear,
            order: maxOrder + 1
        };

        await appDb.addMultiple('custom_stats', [newStat]);
    }
    if (appDb.addImportLog) {
        const action = currentEditingStatIdPrev ? 'Modificata' : 'Creata';
        appDb.addImportLog(`[${new Date().toLocaleTimeString()}] ${action} statistica "${title}" (tipo ${type})${skill && skill !== 'ALL' ? ' [' + skill + ']' : ''}.`, false, 'Statistica');
    }
    document.getElementById('stat-config-modal').classList.remove('open');
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
    renderTeamStats();
}

async function renderTeamStats() {
    const container = document.getElementById('team-stats-container');
    if (!container) return;
    
    const prevHeight = container.offsetHeight;
    if (prevHeight > 0) container.style.minHeight = prevHeight + 'px';

    const year = window.appState.activeYear;
    const activeTemplateId = await getActiveTemplateId();

    const allStats = await appDb.getAll('custom_stats');
    const stats = allStats
        .filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    if (stats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Nessuna statistica presente in questo template. Usa il pulsante "Nuova Statistica".</p>';
        container.style.minHeight = '';
        return;
    }
    
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const statiData = await appDb.getAll('stati', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);
    
    const teamAvgOnly = (teamViewMode === 'avg');
    const cards = [];
    for (const stat of stats) {
        const card = await buildStatCard(stat, perfData, salesData, statiData, goals, false, '', teamAvgOnly, showTeamAvgInTeam, showTeamGoalInTeam);
        if (card) cards.push(card);
    }

    container.innerHTML = '';
    cards.forEach(c => container.appendChild(c));
    container.style.minHeight = '';
}

async function renderIndividualStats() {
    const container = document.getElementById('individual-stats-container');
    if (!container) return;
    const select = document.getElementById('individual-select');
    const employee = select ? select.value : '';
    const placeholder = window.appState.isAnonymous ? 'Seleziona Collab...' : 'Seleziona Collaboratore...';
    const names = Object.keys(window.appState.anonymousMap || {}).sort((a, b) => {
        return window.getDisplayName(a).localeCompare(window.getDisplayName(b), undefined, { numeric: true });
    });

    // Keep header custom dropdown updated
    const headerWrapper = document.getElementById('header-collab-dropdown-wrapper-TAASALO3');
    const headerTrigger = document.getElementById('header-collab-trigger-TAASALO3');
    const headerLabel = document.getElementById('header-collab-label-TAASALO3');
    const headerMenu = document.getElementById('header-collab-menu-TAASALO3');
    if (headerWrapper && headerTrigger && headerLabel && headerMenu) {
        setupCollabCustomDropdown({
            wrapper: headerWrapper,
            trigger: headerTrigger,
            label: headerLabel,
            menu: headerMenu,
            currentValue: employee,
            names: names,
            placeholder: placeholder,
            onSelect: async (val) => {
                if (select) select.value = val;
                if (window.appDb) await appDb.setSetting('stat_selected_employee', val);
                renderIndividualStats();
            }
        });
    }
    
    if (!employee) {
        container.style.minHeight = '';
        container.innerHTML = `
            <div class="card" style="padding: 48px 24px; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; margin-top: 12px; grid-column: 1 / -1; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--bg-base); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--primary); margin: 0 auto;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <div style="max-width: 440px;">
                    <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-main); margin-bottom: 12px;">Nessun Collaboratore Selezionato</h3>
                    <div id="center-collab-dropdown-wrapper" class="collab-dropdown-wrapper center-variant">
                        <button type="button" id="center-collab-trigger" class="collab-select-trigger large" aria-haspopup="listbox" aria-expanded="false" title="Seleziona Collaboratore">
                            <span class="collab-trigger-left">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span id="center-collab-label" class="collab-label">${placeholder}</span>
                            </span>
                            <svg class="collab-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div id="center-collab-menu" class="collab-dropdown-menu"></div>
                    </div>
                </div>
            </div>
        `;

        const centerWrapper = container.querySelector('#center-collab-dropdown-wrapper');
        const centerTrigger = container.querySelector('#center-collab-trigger');
        const centerLabel = container.querySelector('#center-collab-label');
        const centerMenu = container.querySelector('#center-collab-menu');

        setupCollabCustomDropdown({
            wrapper: centerWrapper,
            trigger: centerTrigger,
            label: centerLabel,
            menu: centerMenu,
            currentValue: '',
            names: names,
            placeholder: placeholder,
            onSelect: async (val) => {
                if (select) select.value = val;
                if (window.appDb) await appDb.setSetting('stat_selected_employee', val);
                renderIndividualStats();
            }
        });
        return;
    }
    
    const prevHeight = container.offsetHeight;
    if (prevHeight > 0) container.style.minHeight = prevHeight + 'px';

    const year = window.appState.activeYear;
    // Solo se la vista individuale è effettivamente attiva evita di sovrascrivere il template globale quando siamo in vista Team
    const isIndTabActive = document.querySelector('.tab-btn[data-target="stat-individual"]')?.classList.contains('active');
    if (isIndTabActive) {
        await handleCollaboratorTemplateSwitch(employee);
    }
    const activeTemplateId = await getActiveTemplateId();

    const allStats = await appDb.getAll('custom_stats');
    const stats = allStats
        .filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const statiData = await appDb.getAll('stati', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);

    // Configurazione personalizzata degli obiettivi per questo collaboratore
    const customConfig = (await appDb.getSetting('ind_goals_config_' + employee, null)) || {
        hidden: {},
        targets: {},
        monthlyTargets: {}
    };
    
    container.innerHTML = '';

    // 1. Intestazione Collaboratore (Icona omino SVG + Nome Cognome + Selettore Template + Pulsante Personalizza)
    const displayName = window.getDisplayName(employee);
    let employeeSkills = (window.appState?.collaboratorSkills?.[employee] || [])
        .map(skill => String(skill).trim())
        .filter(Boolean);
    if (employeeSkills.length === 0) {
        const discovered = new Set();
        perfData.forEach(d => { if (d.employee === employee && d.skill) discovered.add(d.skill); });
        salesData.forEach(d => { if (d.employee === employee && d.skill) discovered.add(d.skill); });
        employeeSkills = Array.from(discovered);
    }

    const skillsBadgesHtml = employeeSkills.length > 0
        ? employeeSkills.map(sk => `<span style="font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:12px; background:rgba(59,130,246,0.12); color:var(--primary); border:1px solid rgba(59,130,246,0.25);">${sk}</span>`).join(' ')
        : '';

    const headerCard = document.createElement('div');
    headerCard.className = 'card';
    headerCard.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:16px 20px; margin-top:12px; margin-bottom:20px; border-radius:var(--radius); background:var(--bg-surface); border:1px solid var(--border); flex-wrap:wrap; gap:16px;';

    const tpls = await getTemplates();
    const currentAssignedTemplateId = window.appState?.collaboratorTemplates?.[employee] || '';
    
    let templateOptionsHtml = `<option value="">Nessuno (Default)</option>`;
    tpls.forEach(t => {
        templateOptionsHtml += `<option value="${t.id}" ${t.id === currentAssignedTemplateId ? 'selected' : ''}>${t.name}</option>`;
    });

    headerCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px;">
            <div style="width:48px; height:48px; border-radius:50%; background:rgba(59,130,246,0.12); color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid rgba(59,130,246,0.3);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </div>
            <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <h2 style="font-size:1.25rem; font-weight:700; color:var(--text-main); margin:0;">${displayName}</h2>
                    ${skillsBadgesHtml}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Statistiche & Obiettivi Individuali · Anno ${year}</div>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px; background:var(--bg-base); border:1px solid var(--border); border-radius:6px; padding:4px 8px;">
                <label for="ind-collab-template-select" style="font-size:0.78rem; font-weight:500; color:var(--text-muted); white-space:nowrap; display:flex; align-items:center; gap:4px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Template:
                </label>
                <select id="ind-collab-template-select" style="padding:3px 6px; border-radius:4px; background:var(--bg-surface); color:var(--text-main); border:1px solid var(--border); font-size:0.8rem; cursor:pointer; outline:none;">
                    ${templateOptionsHtml}
                </select>
            </div>
        </div>
    `;
    container.appendChild(headerCard);

    const indTplSelect = headerCard.querySelector('#ind-collab-template-select');
    if (indTplSelect) {
        indTplSelect.addEventListener('change', async () => {
            const newTplId = indTplSelect.value;
            const allMappings = await appDb.getAll('anonymous_map', 'year', year);
            const mapRecord = allMappings.find(m => m.realName === employee);
            if (mapRecord) {
                mapRecord.templateId = newTplId;
                await appDb.updateRecord('anonymous_map', mapRecord);
            }
            if (!window.appState.collaboratorTemplates) window.appState.collaboratorTemplates = {};
            window.appState.collaboratorTemplates[employee] = newTplId;
            
            if (newTplId) {
                await appDb.setSetting('active_stat_template', newTplId);
                const mainTplSelect = document.getElementById('stat-template-select');
                if (mainTplSelect) mainTplSelect.value = newTplId;
            }
            await renderStatistics();
        });
    }

    // 2. Sezione Sales (Stile LolloData Dashboard)
    const goalCardsHtml = await buildIndividualGoalCardsHTML(employee, year, goals, perfData, salesData, customConfig);
    if (goalCardsHtml) {
        const goalsSection = document.createElement('div');
        goalsSection.style.cssText = 'margin-bottom: 24px;';
        goalsSection.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="font-size:1rem; font-weight:700; color:var(--text-main); margin:0;">Sales</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;${goalCardsHtml.gridMaxWidth || ''}">
                ${goalCardsHtml.html}
            </div>
        `;
        container.appendChild(goalsSection);
    }

    // 2b. Tabella Dettaglio Vendite Mensili per Tipo (AOIT, Nuovo Mobile, Nuovo TV, ecc.)
    const monthlyTypesTable = await buildIndividualMonthlyTypesTable(employee, year, salesData, perfData);
    if (monthlyTypesTable) {
        container.appendChild(monthlyTypesTable);
    }

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
            const card = await buildStatCard(stat, perfData, salesData, statiData, goals, true, employee, false, showIndividualTeamAvg, showIndividualTeamGoal);
            if (card) statsGrid.appendChild(card);
        }
    }
    container.appendChild(statsGrid);
    container.style.minHeight = '';
}

function normalizeGoalMetricKey(value = '') {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/^sales:\s*/i, '')
        .replace(/^performance:\s*/i, '')
        .replace(/[()]/g, '')
        .replace(/[+\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/aoit\s*gew|aoit\s*chf|aoit\s*g/gi, 'aoit')
        .replace(/my\s*security\s*m\s*\+\s*l/gi, 'my security m+l')
        .trim();
}

function isSalesGoalMetric(metric = '') {
    const text = String(metric || '').trim();
    if (!text) return false;
    if (/^sales:/i.test(text)) return true;
    const normalized = normalizeGoalMetricKey(text);
    return /(aoit|retention|internet|tv|mobile|my security|my service)/i.test(normalized);
}

function goalMetricMatches(left, right) {
    const leftKey = normalizeGoalMetricKey(left);
    const rightKey = normalizeGoalMetricKey(right);
    if (!leftKey || !rightKey) return false;
    if (leftKey === rightKey) return true;
    if (leftKey.includes('aoit') && rightKey.includes('aoit')) return true;
    if (leftKey.includes('my security') && rightKey.includes('my security')) return true;
    return false;
}

async function buildIndividualGoalCardsHTML(employee, year, goals, perfData, salesData, customConfig) {
    const hiddenMap = customConfig.hidden || {};
    const customTargets = customConfig.targets || {};
    const customMonthlyTargets = customConfig.monthlyTargets || {};
    const employeeSkills = new Set((window.appState?.collaboratorSkills?.[employee] || [])
        .map(skill => String(skill).trim())
        .filter(Boolean));

    const defaultItems = [
        { key: 'AOIT (CHF)', label: 'AOIT (CHF)', isCHF: true, defaultTarget: 5000, color: '#3b82f6' },
        { key: 'Retention', label: 'Retention', isCHF: false, defaultTarget: 12, color: '#059669' },
        { key: 'Internet', label: 'Internet', isCHF: false, defaultTarget: 12, color: '#d97706' },
        { key: 'TV', label: 'TV', isCHF: false, defaultTarget: 12, color: '#8b5cf6' },
        { key: 'Mobile', label: 'Mobile', isCHF: false, defaultTarget: 12, color: '#ec4899' }
    ];

    const salesTablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
    const matchSkillTables = (salesTablesList || []).filter(table => {
        if (!table || !table.skill || table.skill === 'ALL') return true;
        if (employeeSkills.size === 0) return true;
        return employeeSkills.has(table.skill);
    });

    const items = [];

    for (const table of matchSkillTables) {
        const products = await appDb.getSetting(`sales_table_products_${table.id}`, []);
        const savedTargets = (await appDb.getSetting(`sales_table_targets_${year}_${table.id}`, {})) || {};
        const collabWorkPcts = (await appDb.getSetting('collab_work_pcts', {})) || {};
        const totalWork = Object.values(collabWorkPcts).reduce((sum, val) => sum + (Number(val) || 0), 0) || 1;
        const empWorkPct = Number(collabWorkPcts[employee] || 100);

        for (const product of products || []) {
            const label = product.label || product.key || 'Obiettivo';
            let defaultTarget = 0;

            if (product.mode === 'team') {
                defaultTarget = Number(savedTargets['TEAM_' + product.key] || 0);
            } else {
                const indivTotal = Number(savedTargets['INDIV_TOTAL_' + product.key] || 0);
                defaultTarget = totalWork > 0 ? Math.round(indivTotal * (empWorkPct / totalWork)) : 0;
            }

            const mappedMetrics = Array.isArray(product.mappedMetrics)
                ? product.mappedMetrics
                : (product.mappedMetric ? product.mappedMetric.split(',').map(s => s.trim()).filter(Boolean) : []);

            const item = {
                key: label,
                label,
                isCHF: !!product.isCHF,
                defaultTarget,
                color: ['#3b82f6', '#059669', '#d97706', '#8b5cf6', '#ec4899'][items.length % 5],
                skill: table.skill && table.skill !== 'ALL' ? table.skill : null,
                mappedMetrics
            };

            if (defaultTarget > 0 || mappedMetrics.length > 0) {
                items.push(item);
            }
        }
    }

    const fallbackItems = items.length > 0 ? items : defaultItems;

    const getActualForLabel = (itemKey, mappedMetrics, isCHF) => {
        const metricsToUse = mappedMetrics && mappedMetrics.length > 0 ? mappedMetrics : [itemKey];
        return calcActualForMetric(metricsToUse, perfData, salesData, employee, isCHF);
    };

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

    let cardsHtml = '';
    let cardCount = 0;

    fallbackItems.forEach(item => {
        if (hiddenMap[item.key]) return;

        const annualTarget = customTargets[item.key] ?? item.defaultTarget;
        const customMonthly = customMonthlyTargets[item.key];

        const mappedMetrics = Array.isArray(item.mappedMetrics) ? item.mappedMetrics : [];
        let annualAchieved = getActualForLabel(item.label, mappedMetrics, item.isCHF);
        
        const metricsToUse = mappedMetrics.length > 0 ? mappedMetrics : [item.label || item.key];
        const monthlySalesData = latestMonthStr
            ? salesData.filter(r => r.employee === employee && r.date && r.date.startsWith(latestMonthStr))
            : [];
        const monthlyPerfData = latestMonthStr
            ? perfData.filter(r => r.employee === employee && r.date && r.date.startsWith(latestMonthStr))
            : [];
        let monthlyAchieved = calcActualForMetric(metricsToUse, monthlyPerfData, monthlySalesData, employee, item.isCHF);

        // Target mensile: resta dell'anno diviso per i mesi rimanenti (incluso quello corrente)
        const remainingMonths = Math.max(1, 12 - latestMonthIdx);
        const remainingTarget = Math.max(0, annualTarget - annualAchieved);
        const monthlyTarget = customMonthly != null
            ? customMonthly
            : (annualTarget > 0 ? Math.round(remainingTarget / remainingMonths) : 0);

        cardCount++;

        const formatVal = (v) => {
            if (item.isCHF) return 'CHF ' + Math.round(v).toLocaleString('de-CH');
            return Math.round(v).toString();
        };

        const monthPct = monthlyTarget > 0 ? Math.round((monthlyAchieved / monthlyTarget) * 100) : 0;
        const annualPct = annualTarget > 0 ? Math.round((annualAchieved / annualTarget) * 100) : 0;
        const monthPctClamped = Math.min(Math.max(monthPct, 0), 100);
        const annualPctClamped = Math.min(Math.max(annualPct, 0), 100);

        cardsHtml += `
            <div class="goal-mini-card" style="justify-content:space-between;">
                <div>
                    <div style="font-weight: 700; font-size: 13px; color: ${item.color}; margin-bottom: 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        <span>${item.label}</span>
                    </div>
                    
                    <div class="goal-info-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px; gap:6px;">
                        <span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">Mensile ${latestMonthName}</span>
                        <span style="color:var(--text-muted); font-size:11px; font-weight:600; white-space:nowrap;">${formatVal(monthlyAchieved)} / ${formatVal(monthlyTarget)}</span>
                    </div>
                    <div class="goal-progress-track" style="height:16px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:8px; position:relative;">
                        <div class="goal-progress-fill" style="width:${monthPctClamped}%; height:100%; background:${item.color}; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:700; transition: width 0.3s ease;">
                            ${monthPct > 12 ? monthPct + '%' : ''}
                        </div>
                    </div>

                    <div class="goal-info-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px; gap:6px;">
                        <span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">Annuale</span>
                        <span style="color:var(--text-muted); font-size:11px; font-weight:600; white-space:nowrap;">${formatVal(annualAchieved)} / ${formatVal(annualTarget)}</span>
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

    return {
        html: cardsHtml,
        gridMaxWidth: cardCount === 1 ? ' max-width:420px;' : ''
    };
}

async function buildIndividualMonthlyTypesTable(employee, year, salesData, perfData) {
    const section = document.createElement('div');
    section.className = 'card individual-monthly-types-card';
    section.style.cssText = 'margin-bottom: 24px; padding: 18px 20px; border-radius: var(--radius); background: var(--bg-surface); border: 1px solid var(--border);';

    // 1. Recupera le skill del collaboratore
    const employeeSkills = new Set((window.appState?.collaboratorSkills?.[employee] || [])
        .map(skill => String(skill).trim())
        .filter(Boolean));

    // 2. Filtra le tabelle sales associate alle skill del collaboratore
    const salesTablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
    const matchSkillTables = (salesTablesList || []).filter(table => {
        if (!table || !table.skill || table.skill === 'ALL') return true;
        if (employeeSkills.size === 0) return true;
        return employeeSkills.has(table.skill);
    });

    const collabWorkPcts = (await appDb.getSetting('collab_work_pcts', {})) || {};
    const totalWork = Object.values(collabWorkPcts).reduce((sum, val) => sum + (Number(val) || 0), 0) || 1;
    const empWorkPct = Number(collabWorkPcts[employee] || 100);

    const customConfig = (await appDb.getSetting('ind_goals_config_' + employee, null)) || {
        hidden: {},
        targets: {},
        monthlyTargets: {}
    };

    const items = [];
    for (const table of matchSkillTables) {
        const products = await appDb.getSetting(`sales_table_products_${table.id}`, []);
        const savedTargets = (await appDb.getSetting(`sales_table_targets_${year}_${table.id}`, {})) || {};

        for (const product of products || []) {
            const label = product.label || product.key || 'Obiettivo';
            const mappedMetrics = Array.isArray(product.mappedMetrics)
                ? product.mappedMetrics
                : (product.mappedMetric ? product.mappedMetric.split(',').map(s => s.trim()).filter(Boolean) : []);

            let target = 0;
            if (product.mode === 'team') {
                target = Number(savedTargets['TEAM_' + product.key] || 0);
            } else {
                const indivTotal = Number(savedTargets['INDIV_TOTAL_' + product.key] || 0);
                target = totalWork > 0 ? Math.round(indivTotal * (empWorkPct / totalWork)) : 0;
            }

            if (customConfig.targets && customConfig.targets[label] !== undefined) {
                target = Number(customConfig.targets[label]);
            }

            items.push({
                key: label,
                label,
                isCHF: !!product.isCHF,
                skill: table.skill && table.skill !== 'ALL' ? table.skill : null,
                mappedMetrics,
                target
            });
        }
    }

    const defaultItems = [
        { key: 'AOIT (CHF)', label: 'AOIT (CHF)', isCHF: true, mappedMetrics: ['AOIT'], target: customConfig.targets?.['AOIT (CHF)'] ?? 5000 },
        { key: 'Retention', label: 'Retention', isCHF: false, mappedMetrics: ['Retention'], target: customConfig.targets?.['Retention'] ?? 12 },
        { key: 'Internet', label: 'Internet', isCHF: false, mappedMetrics: ['Internet'], target: customConfig.targets?.['Internet'] ?? 12 },
        { key: 'TV', label: 'TV', isCHF: false, mappedMetrics: ['TV'], target: customConfig.targets?.['TV'] ?? 12 },
        { key: 'Mobile', label: 'Mobile', isCHF: false, mappedMetrics: ['Mobile'], target: customConfig.targets?.['Mobile'] ?? 12 }
    ];

    const targetItems = items.length > 0 ? items : defaultItems;

    const monthShortNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const monthFullNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    // 3. Matrice valori per ogni riga/prodotto per i 12 mesi
    const matrix = [];
    const rowTotals = [];

    targetItems.forEach((item, idx) => {
        const monthVals = new Array(12).fill(0);
        let total = 0;

        for (let mIdx = 0; mIdx < 12; mIdx++) {
            const monthSales = (salesData || []).filter(r => {
                if (r.employee !== employee || !r.date) return false;
                const p = r.date.split('-');
                return p.length >= 2 && (parseInt(p[1], 10) - 1) === mIdx;
            });
            const monthPerf = (perfData || []).filter(r => {
                if (r.employee !== employee || !r.date) return false;
                const p = r.date.split('-');
                return p.length >= 2 && (parseInt(p[1], 10) - 1) === mIdx;
            });

            const metricsToUse = item.mappedMetrics && item.mappedMetrics.length > 0
                ? item.mappedMetrics
                : [item.label || item.key];
            const val = calcActualForMetric(metricsToUse, monthPerf, monthSales, employee, item.isCHF);
            monthVals[mIdx] = val;
            total += val;
        }

        matrix.push(monthVals);
        rowTotals.push(total);
    });

    // Funzioni formattazione
    const formatCellValue = (num, isCHF) => {
        if (!num || num === 0) return `<span style="color:var(--text-muted); opacity:0.35;">0</span>`;
        if (isCHF) {
            return `<span style="font-weight:700; color:var(--text-main); font-family:monospace;">${Math.round(num).toLocaleString('de-CH')}</span>`;
        }
        return `<span style="font-weight:700; color:var(--text-main); font-family:monospace;">${Math.round(num)}</span>`;
    };

    const formatTotalValue = (num, isCHF) => {
        if (!num || num === 0) return `<span style="color:var(--text-muted); opacity:0.5;">0</span>`;
        if (isCHF) {
            return `<span style="font-weight:800; color:var(--primary); font-family:monospace;">CHF ${Math.round(num).toLocaleString('de-CH')}</span>`;
        }
        return `<span style="font-weight:800; color:var(--primary); font-family:monospace;">${Math.round(num)}</span>`;
    };

    const formatTargetValue = (num, isCHF) => {
        if (!num || num === 0) return `<span style="color:var(--text-muted); opacity:0.4;">—</span>`;
        if (isCHF) {
            return `<span style="font-weight:700; color:var(--text-muted); font-family:monospace;">CHF ${Math.round(num).toLocaleString('de-CH')}</span>`;
        }
        return `<span style="font-weight:700; color:var(--text-muted); font-family:monospace;">${Math.round(num)}</span>`;
    };

    const formatPctBadge = (pct) => {
        if (pct === null || pct === undefined) return `<span style="color:var(--text-muted); opacity:0.4;">—</span>`;
        let bg = 'rgba(239, 68, 68, 0.15)';
        let color = '#ef4444';
        if (pct >= 100) {
            bg = 'rgba(16, 185, 129, 0.15)';
            color = '#10b981';
        } else if (pct >= 80) {
            bg = 'rgba(59, 130, 246, 0.15)';
            color = '#3b82f6';
        } else if (pct >= 50) {
            bg = 'rgba(245, 158, 11, 0.15)';
            color = '#f59e0b';
        }
        return `<span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700; font-family:monospace; background:${bg}; color:${color};">${pct}%</span>`;
    };

    let tableRowsHtml = '';
    targetItems.forEach((item, idx) => {
        const isCHF = item.isCHF;
        const rowTotal = rowTotals[idx];
        const rowVals = matrix[idx];
        const target = item.target || 0;
        const pct = target > 0 ? Math.round((rowTotal / target) * 100) : null;

        tableRowsHtml += `
            <tr>
                <td style="font-weight: 600; white-space: nowrap;">
                    <div class="ind-monthly-table-type-badge">
                        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${isCHF ? '#3b82f6' : '#10b981'}; flex-shrink:0;"></span>
                        <span style="color:var(--text-main);">${item.label}</span>
                        ${isCHF ? `<span style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">(CHF)</span>` : ''}
                    </div>
                </td>
                ${rowVals.map(val => `
                    <td class="ind-col-month" style="${val > 0 ? 'background: rgba(59,130,246,0.04);' : ''}">
                        ${formatCellValue(val, isCHF)}
                    </td>
                `).join('')}
                <td class="ind-col-total" style="background: var(--bg-base); font-weight: 700;">
                    ${formatTotalValue(rowTotal, isCHF)}
                </td>
                <td class="ind-col-target" style="background: var(--bg-base); font-weight: 700;">
                    ${formatTargetValue(target, isCHF)}
                </td>
                <td class="ind-col-pct" style="background: var(--bg-base); font-weight: 700;">
                    ${formatPctBadge(pct)}
                </td>
            </tr>
        `;
    });

    section.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary); flex-shrink:0;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
                <h3 style="font-size:1rem; font-weight:700; color:var(--text-main); margin:0;">Riepilogo Vendite Mensili per Tipo</h3>
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted);">
                Anno ${year}
            </div>
        </div>
        <div class="ind-monthly-table-wrapper">
            <table class="ind-monthly-table">
                <thead>
                    <tr>
                        <th scope="col" style="min-width:140px;">Tipo</th>
                        ${monthShortNames.map((m, idx) => `
                            <th scope="col" title="${monthFullNames[idx]}" class="ind-col-month">${m}</th>
                        `).join('')}
                        <th scope="col" class="ind-col-total" style="color:var(--primary);">Totale</th>
                        <th scope="col" class="ind-col-target" style="color:var(--text-muted);">Obiettivo</th>
                        <th scope="col" class="ind-col-pct" style="color:var(--text-muted);">%</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>
    `;

    return section;
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

function getStatiAwareValue(data, key) {
    if (!data || !key) return undefined;
    if (data[key] !== undefined) return data[key];
    const stripped = key.replace(/^State Rcode - /, '');
    if (stripped !== key && data[stripped] !== undefined) return data[stripped];
    const prefixed = 'State Rcode - ' + stripped;
    if (data[prefixed] !== undefined) return data[prefixed];
    return undefined;
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

// Genera N colori armoniosi spaziando nella fascia cromatica vicina (colori analoghi)
// e variando luminosità e saturazione per massimizzare la distinzione tra fette adiacenti.
function generateColorShades(hex, count) {
    if (!count || count <= 0) return [];
    if (!hex || typeof hex !== 'string') hex = '#2563EB';
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const baseLight = (max + min) / 2;
    let hue = 0;
    let sat = 0;
    if (max !== min) {
        const d = max - min;
        sat = baseLight > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: hue = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
            case g: hue = ((b - r) / d + 2) * 60; break;
            case b: hue = ((r - g) / d + 4) * 60; break;
        }
    }
    if (count === 1) return ['#' + h];

    const colors = [];
    const maxHueShift = Math.min(50, 15 + count * 4); // fascia di colori vicini
    const baseS = Math.max(sat, 0.7);

    for (let i = 0; i < count; i++) {
        const norm = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
        const curHue = hue + norm * maxHueShift;
        const lightAlt = (i % 2 === 0) 
            ? 0.60 + (i % 4 === 0 ? 0.08 : -0.04) 
            : 0.42 + ((i - 1) % 4 === 0 ? -0.06 : 0.06);
        const curLight = Math.min(Math.max(lightAlt, 0.32), 0.78);
        const curSat = Math.min(Math.max(baseS + (i % 2 === 0 ? -0.06 : 0.06), 0.55), 0.95);

        colors.push(hslToHex(curHue, curSat, curLight));
    }

    if (count > 2) {
        const shuffled = [];
        let left = 0;
        let right = count - 1;
        let toggle = true;
        while (left <= right) {
            if (toggle) {
                shuffled.push(colors[left++]);
            } else {
                shuffled.push(colors[right--]);
            }
            toggle = !toggle;
        }
        return shuffled;
    }

    return colors;
}

function generateBarColorShades(hex, count) {
    if (!count || count <= 0) return [];
    if (!hex || typeof hex !== 'string') hex = '#2563EB';
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const baseLight = (max + min) / 2;
    let hue = 0;
    let sat = 0;
    if (max !== min) {
        const d = max - min;
        sat = baseLight > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: hue = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
            case g: hue = ((b - r) / d + 2) * 60; break;
            case b: hue = ((r - g) / d + 4) * 60; break;
        }
    }
    if (count === 1) return ['#' + h];

    const maxDelta = 0.07;
    const colors = [];
    for (let i = 0; i < count; i++) {
        const norm = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
        const delta = norm * maxDelta;
        const curLight = Math.min(Math.max(baseLight + delta, 0.15), 0.88);
        colors.push(hslToHex(hue, sat, curLight));
    }

    if (count > 2) {
        const interleaved = [];
        let left = 0;
        let right = count - 1;
        let toggle = true;
        while (left <= right) {
            if (toggle) {
                interleaved.push(colors[left++]);
            } else {
                interleaved.push(colors[right--]);
            }
            toggle = !toggle;
        }
        return interleaved;
    }

    return colors;
}

function hslToHex(hue, sat, light) {
    const h = ((hue % 360) + 360) % 360;
    const s = Math.min(Math.max(sat, 0), 1);
    const l = Math.min(Math.max(light, 0), 1);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hexToHsl(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let hue = 0;
    let sat = 0;
    if (max !== min) {
        const d = max - min;
        sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: hue = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
            case g: hue = ((b - r) / d + 2) * 60; break;
            case b: hue = ((r - g) / d + 4) * 60; break;
        }
    }
    return { h: hue, s: sat, l: l };
}

function getMediaTeamLineColor(hex) {
    if (!hex) return '#38BDF8';
    const hsl = hexToHsl(hex);
    // Tonalità brillante, ad alta luminosità e saturazione per staccare nettamente dalle barre scure
    const newLight = 0.74;
    const newSat = 0.95;
    const newHue = (hsl.h + 20) % 360;
    return hslToHex(newHue, newSat, newLight);
}

// Genera N colori armonici attorno al colore di base, con tonalità vicine
// (es. blu → blu, viola, ciano) e alternando chiaro/scuro per contrasto.
// Il colore esatto scelto dall'utente rimane al centro della scala.
function generateHarmoniousColors(hex, count) {
    if (!count || count <= 0) return [];
    if (count === 1) return [hex];
    const hsl = hexToHsl(hex);
    const baseHue = hsl.h;
    const sat = Math.min(Math.max(hsl.s, 0.5), 0.9);
    const hueSpread = 45;
    const center = (count - 1) / 2;
    const colors = [];
    for (let i = 0; i < count; i++) {
        const ratio = count === 1 ? 0 : (i - center) / center;
        const hue = ((baseHue + ratio * hueSpread) % 360 + 360) % 360;
        const isLight = i % 2 === 0;
        let light;
        if (isLight) {
            light = 0.78 - Math.abs(ratio) * 0.08;
        } else {
            light = 0.42 + Math.abs(ratio) * 0.05;
        }
        light = Math.min(Math.max(light, 0.12), 0.88);
        colors.push(hslToHex(hue, sat, light));
    }
    return colors;
}

async function buildStatCard(statConfig, perfData, salesData, statiData, goals, isIndividual, employeeName = '', teamAvgOnly = false, showTeamAvg = false, showTeamGoal = false, isPreview = false) {
    const card = document.createElement('div');
    card.className = 'card stat-card';
    card.style.position = 'relative';
    
    // Gestione tipo speciale: Tabella Obiettivi Vendita
    if (statConfig.type === 'goals_table') {
        if ((isIndividual || Boolean(employeeName)) && !isPreview) {
            return null;
        }
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

            const thresholdsBtn = document.createElement('button');
            thresholdsBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h2M12 6h8M4 12h8M18 12h2M4 18h2M12 18h8"/><circle cx="9" cy="6" r="3"/><circle cx="15" cy="12" r="3"/><circle cx="9" cy="18" r="3"/></svg>';
            thresholdsBtn.className = 'btn secondary';
            thresholdsBtn.style.cssText = 'padding:4px 8px; font-size:0.75rem;';
            thresholdsBtn.title = 'Soglie colori realizzato';
            thresholdsBtn.onclick = async () => {
                await openGoalThresholdsModal(window.appState.activeYear, statConfig.goalsTableId);
            };
            actionsDiv.appendChild(thresholdsBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
            deleteBtn.className = 'btn secondary';
            deleteBtn.style.cssText = 'padding:4px 8px; font-size:0.75rem;';
            deleteBtn.title = 'Elimina statistica';
            deleteBtn.onclick = async () => {
                if (!await appDialog.confirm(`Eliminare la statistica "${statConfig.title}"?`)) return;
                await appDb.deleteRecord('custom_stats', statConfig.id);
                if (appDb.addImportLog) appDb.addImportLog(`[${new Date().toLocaleTimeString()}] Eliminata statistica "${statConfig.title}".`, false, 'Statistica');
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
    const isStati = statConfig.metric.startsWith('Stati: ');
    const rawKey = statConfig.metric.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '').replace('Stati: ', '').replace(/^State Rcode - /, '');
    
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
            if (!await appDialog.confirm(`Eliminare la statistica "${statConfig.title}"?`)) return;
            await appDb.deleteRecord('custom_stats', statConfig.id);
            if (appDb.addImportLog) appDb.addImportLog(`[${new Date().toLocaleTimeString()}] Eliminata statistica "${statConfig.title}".`, false, 'Statistica');
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
    if (statConfig.type === 'table' || statConfig.type === 'goals_table') {
        canvasContainer.style.height = 'auto';
        canvasContainer.style.overflowX = 'auto';
        if (isPreview) {
            canvasContainer.style.maxHeight = '52vh';
            canvasContainer.style.overflowY = 'auto';
        }
    } else if (statConfig.type === 'pie') {
        if (isPreview) {
            canvasContainer.style.height = '0';
            canvasContainer.style.flex = '1 1 auto';
            canvasContainer.style.minHeight = '340px';
            canvasContainer.style.maxHeight = '580px';
            canvasContainer.style.overflow = 'hidden';
        } else {
            canvasContainer.style.height = '390px';
        }
    } else {
        if (isPreview) {
            canvasContainer.style.height = '0';
            canvasContainer.style.flex = '1 1 auto';
            canvasContainer.style.minHeight = '320px';
            canvasContainer.style.maxHeight = '560px';
            canvasContainer.style.overflow = 'hidden';
        } else {
            canvasContainer.style.height = '360px';
        }
    }
    card.appendChild(canvasContainer);
    
    // Process Data
    const sourceData = isStati ? statiData : (isPerf ? perfData : salesData);
    
    const activeYr = window.appState.activeYear || new Date().getFullYear().toString();
    const datesSet = new Set();
    const datesWithData = new Set();

    // Always include all 12 months of the active year (use YYYY-MM keys)
    for (let m = 1; m <= 12; m++) {
        const monthStr = String(m).padStart(2, '0');
        datesSet.add(`${activeYr}-${monthStr}`);
    }
    
    const empSet = new Set();
    const empDateMap = {};
    const aggregatedByDate = {};

    // Helper to render a cell value as HTML: zero values appear muted
    const renderCellHtml = (v, defaultColor = null) => {
        if (v === null || v === undefined || v === '') return '';
        const n = Number(v);
        if (!isNaN(n) && n === 0) return `<span style="color:var(--text-muted);">${n}</span>`;
        if (!isNaN(n)) return defaultColor ? `<span style="color:${defaultColor};">${Math.round(n)}</span>` : `${Math.round(n)}`;
        return `${v}`;
    };

    sourceData.forEach(row => {
        if (isPerf && statConfig.skill && statConfig.skill !== 'ALL') {
            if (row.skill !== statConfig.skill) return;
        }
        if (!isPerf && statConfig.product) {
            if (row.data['Product'] !== statConfig.product) return;
        }
        // Filtro skill anche per Sales/Stati quando grafico a torta (collaboratori per skill)
        if (!isPerf && statConfig.skill && statConfig.skill !== 'ALL' && statConfig.type === 'pie') {
            const empSkills = window.appState.collaboratorSkills?.[row.employee] || [];
            const hasCollabSkill = Array.isArray(empSkills) && empSkills.includes(statConfig.skill);
            const hasRowSkill = row.skill === statConfig.skill;
            if (!hasCollabSkill && !hasRowSkill) return;
        }

        const date = row.date;
        const monthKey = (date && date.length >= 7) ? date.slice(0,7) : date;
        const emp = row.employee;
        const val = parseMetricValue(getStatiAwareValue(row.data, rawKey) ?? 0);

        datesSet.add(monthKey);
        datesWithData.add(monthKey);
        if (emp) empSet.add(emp);

        if (emp) {
            if (!empDateMap[emp]) empDateMap[emp] = {};
            if (!empDateMap[emp][monthKey]) empDateMap[emp][monthKey] = 0;
            empDateMap[emp][monthKey] += val;
        }

        if (!aggregatedByDate[monthKey]) aggregatedByDate[monthKey] = 0;
        aggregatedByDate[monthKey] += val;
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
    function getTeamAvgPtsForMetric(m) {
        const isP = m.startsWith('Performance: ');
        const isSt = m.startsWith('Stati: ');
        const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
        const sData = isSt ? statiData : (isP ? perfData : salesData);
        const empMap = {};
        sData.forEach(row => {
            if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
            if (!isP && !isSt && statConfig.product && row.data['Product'] !== statConfig.product) return;
            if (!isP && statConfig.skill && statConfig.skill !== 'ALL' && statConfig.type === 'pie') {
                const empSkills = window.appState.collaboratorSkills?.[row.employee] || [];
                const hasCollabSkill = Array.isArray(empSkills) && empSkills.includes(statConfig.skill);
                const hasRowSkill = row.skill === statConfig.skill;
                if (!hasCollabSkill && !hasRowSkill) return;
            }
                const date = row.date;
                const monthKey = (date && date.length >= 7) ? date.slice(0,7) : date;
                const emp = row.employee;
                if (!emp) return;
                const val = parseMetricValue(getStatiAwareValue(row.data, rKey) ?? 0);
                if (!empMap[emp]) empMap[emp] = {};
                if (!empMap[emp][monthKey]) empMap[emp][monthKey] = 0;
                empMap[emp][monthKey] += val;
        });

        return labels.map(monthKey => {
            if (!datesWithData.has(monthKey)) return null;
            let sum = 0;
            let count = 0;
            employees.forEach(emp => {
                if (empMap[emp] && empMap[emp][monthKey] !== undefined) {
                    sum += empMap[emp][monthKey];
                    count++;
                }
            });
            return count > 0 ? Math.round(sum / count) : 0;
        });
    }

    if (statConfig.type === 'table') {
        const metricsList = statConfig.metrics && statConfig.metrics.length > 0 ? statConfig.metrics : [statConfig.metric];
        
        if (metricsList.length > 1 && !teamAvgOnly && !isIndividual) {
            // TEAM multi-metrica: una riga per collaboratore per ogni metrica (raggruppate per collaboratore)
            const colHeader = window.appState.isAnonymous ? 'Collab' : 'Collaboratore';
            let html = `<table class="data-table"><thead><tr><th scope="col">${colHeader}</th><th scope="col">Metrica</th>`;
            displayLabels.forEach(l => {
                html += `<th scope="col" style="text-align:center;">${l}</th>`;
            });
            html += `<th scope="col" style="text-align:center; background:var(--bg-base); color:var(--primary);">Media</th>`;
            html += '</tr></thead><tbody>';

            employees.forEach(emp => {
                const dispName = window.getDisplayName(emp);
                metricsList.forEach((m, mIdx) => {
                    const isP = m.startsWith('Performance: ');
                    const isSt = m.startsWith('Stati: ');
                    const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                    const sData = isSt ? statiData : (isP ? perfData : salesData);
                    const color = (statConfig.colors && statConfig.colors[mIdx]) ? statConfig.colors[mIdx] : DISTINCT_COLORS[mIdx % DISTINCT_COLORS.length];
                    const agg = {};
                    sData.forEach(row => {
                        if (row.employee !== emp) return;
                        if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                        if (!isP && !isSt && statConfig.product && row.data['Product'] !== statConfig.product) return;
                        const date = row.date;
                        const monthKey = (date && date.length >= 7) ? date.slice(0,7) : date;
                        const val = parseMetricValue(getStatiAwareValue(row.data, rKey) ?? 0);
                        if (!agg[monthKey]) agg[monthKey] = 0;
                        agg[monthKey] += val;
                    });
                    const isFirstMetric = mIdx === 0;
                    html += `<tr style="${!isFirstMetric ? 'background:rgba(127,127,127,0.02);' : ''}">`;
                    html += `<td style="font-weight:600; white-space:nowrap;">${dispName}</td>`;
                    html += `<td style="font-weight:600; white-space:nowrap;"><span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block; flex-shrink:0;"></span>${rKey}</span></td>`;
                    let _rowSum = 0, _rowCnt = 0;
                    labels.forEach(d => {
                        const rawVal = datesWithData.has(d) ? (agg[d] !== undefined ? agg[d] : 0) : '';
                        const cellVal = (typeof rawVal === 'number') ? Math.round(rawVal) : rawVal;
                        if (typeof cellVal === 'number') { _rowSum += cellVal; _rowCnt++; }
                        const cellHtml = renderCellHtml(cellVal);
                        html += `<td style="text-align:center;">${cellHtml}</td>`;
                    });
                    const _avg = _rowCnt > 0 ? Math.round(_rowSum / _rowCnt) : '';
                    const _avgHtml = _avg === '' ? '' : renderCellHtml(_avg);
                    html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_avgHtml}</td>`;
                    html += '</tr>';
                });
            });

            if (showTeamAvg) {
                metricsList.forEach((m, mIdx) => {
                    const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                    const avgPts = getTeamAvgPtsForMetric(m);
                    const color = (statConfig.colors && statConfig.colors[mIdx]) ? statConfig.colors[mIdx] : DISTINCT_COLORS[mIdx % DISTINCT_COLORS.length];
                    html += '<tr style="font-weight:700; background: rgba(127,127,127,0.1); border-top: 2px solid var(--border);">';
                    html += `<td style="color:var(--primary);">Media Team</td>`;
                    html += `<td style="color:var(--primary);"><span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block;"></span>${rKey}</span></td>`;
                    let _tSum = 0, _tCnt = 0;
                    labels.forEach((date, idx) => {
                        const avgVal = avgPts[idx] === null ? '' : avgPts[idx];
                        if (typeof avgVal === 'number') { _tSum += avgVal; _tCnt++; }
                        html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
                    });
                    const _tAvg = _tCnt > 0 ? Math.round(_tSum / _tCnt) : '';
                    const _tAvgCell = _tAvg === '' ? '' : `<span style="color:var(--primary);">${_tAvg}</span>`;
                    html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_tAvgCell}</td>`;
                    html += '</tr>';
                });
            }

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td style="color:#D946EF;">Obiettivo</td><td style="color:#D946EF;"></td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: #D946EF; font-weight:700;">${targetVal}</td>`;
                });
                const _gAvg = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                html += `<td style="text-align:center; color:#D946EF; font-weight:700; background:var(--bg-base);">${_gAvg}</td>`;
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else if (metricsList.length > 1 && !teamAvgOnly && isIndividual) {
            // INDIVIDUALE multi-metrica: una riga per metrica (solo collaboratore selezionato) con colonna Media
            let html = `<table class="data-table"><thead><tr><th scope="col">Dato / Metrica</th>`;
            displayLabels.forEach(l => {
                html += `<th scope="col" style="text-align:center;">${l}</th>`;
            });
            html += `<th scope="col" style="text-align:center; background:var(--bg-base); color:var(--primary);">Media</th>`;
            html += '</tr></thead><tbody>';

            metricsList.forEach((m, mIdx) => {
                const isP = m.startsWith('Performance: ');
                const isSt = m.startsWith('Stati: ');
                const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                const sData = isSt ? statiData : (isP ? perfData : salesData);
                const color = (statConfig.colors && statConfig.colors[mIdx]) ? statConfig.colors[mIdx] : DISTINCT_COLORS[mIdx % DISTINCT_COLORS.length];
                const agg = {};
                sData.forEach(row => {
                    if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                    if (row.employee !== employeeName) return;
                    const date = row.date;
                    const monthKey = (date && date.length >= 7) ? date.slice(0,7) : date;
                    const val = parseMetricValue(getStatiAwareValue(row.data, rKey) ?? 0);
                    if (!agg[monthKey]) agg[monthKey] = 0;
                    agg[monthKey] += val;
                });

                html += `<tr><td style="font-weight:600;"><span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block;"></span>${rKey}</span></td>`;
                let _rowSum = 0;
                let _rowCnt = 0;
                labels.forEach(d => {
                    const rawVal = datesWithData.has(d) ? (agg[d] !== undefined ? agg[d] : 0) : '';
                    const cellVal = (typeof rawVal === 'number') ? Math.round(rawVal) : rawVal;
                    if (typeof cellVal === 'number') { _rowSum += cellVal; _rowCnt++; }
                    const cellHtml = renderCellHtml(cellVal);
                    html += `<td style="text-align:center;">${cellHtml}</td>`;
                });
                const _avg = _rowCnt > 0 ? Math.round(_rowSum / _rowCnt) : '';
                const _avgHtml = _avg === '' ? '' : renderCellHtml(_avg);
                html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_avgHtml}</td>`;
                html += '</tr>';
            });

            if (showTeamAvg) {
                metricsList.forEach((m, mIdx) => {
                    const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                    const avgPts = getTeamAvgPtsForMetric(m);
                    const color = (statConfig.colors && statConfig.colors[mIdx]) ? statConfig.colors[mIdx] : DISTINCT_COLORS[mIdx % DISTINCT_COLORS.length];
                    html += '<tr style="font-weight:700; background: rgba(127,127,127,0.1); border-top: 2px solid var(--border);">';
                    html += `<td style="color:var(--primary);"><span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block;"></span>Media Team (${rKey})</span></td>`;
                    let _tSum = 0, _tCnt = 0;
                    labels.forEach((date, idx) => {
                        const avgVal = avgPts[idx] === null ? '' : avgPts[idx];
                        if (typeof avgVal === 'number') { _tSum += avgVal; _tCnt++; }
                        html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
                    });
                    const _tAvg = _tCnt > 0 ? Math.round(_tSum / _tCnt) : '';
                    html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_tAvg === '' ? '' : _tAvg}</td>`;
                    html += '</tr>';
                });
            }

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td style="color:#D946EF;">Obiettivo</td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: #D946EF; font-weight:700;">${targetVal}</td>`;
                });
                const _gAvg = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                html += `<td style="text-align:center; color:#D946EF; font-weight:700; background:var(--bg-base);">${_gAvg}</td>`;
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else if (isIndividual) {
            const colHeader = window.appState.isAnonymous ? 'Collab' : 'Collaboratore';
            let html = `<table class="data-table"><thead><tr><th scope="col">${colHeader}</th>`;
            displayLabels.forEach(l => {
                html += `<th scope="col" style="text-align:center;">${l}</th>`;
            });
            html += `<th scope="col" style="text-align:center; background:var(--bg-base); color:var(--primary);">Media</th>`;
            html += '</tr></thead><tbody>';

            const dispName = employeeName ? window.getDisplayName(employeeName) : 'Valore';
            html += `<tr><td style="font-weight:600;">${dispName}</td>`;
            let _indSum = 0, _indCnt = 0;
            displayLabels.forEach((l, idx) => {
                const val = dataPts[idx];
                const displayVal = val === null ? '' : (typeof val === 'number' ? Math.round(val) : val);
                if (typeof displayVal === 'number') { _indSum += displayVal; _indCnt++; }
                const cellHtml = renderCellHtml(displayVal);
                html += `<td style="text-align:center;">${cellHtml}</td>`;
            });
            const _indAvg = _indCnt > 0 ? Math.round(_indSum / _indCnt) : '';
            const _indAvgHtml = _indAvg === '' ? '' : renderCellHtml(_indAvg);
            html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_indAvgHtml}</td>`;
            html += '</tr>';

            if (showTeamAvg) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.1); border-top: 2px solid var(--border);">';
                html += `<td style="color:var(--primary);">Media Team</td>`;
                let _teamSum = 0, _teamCnt = 0;
                labels.forEach((date, idx) => {
                    const avgVal = teamAvgPts[idx] === null ? '' : teamAvgPts[idx];
                    if (typeof avgVal === 'number') { _teamSum += avgVal; _teamCnt++; }
                    html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
                });
                const _teamAvg = _teamCnt > 0 ? Math.round(_teamSum / _teamCnt) : '';
                const _teamAvgCell = _teamAvg === '' ? '' : `<span style="color:var(--primary);">${_teamAvg}</span>`;
                html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_teamAvgCell}</td>`;
                html += '</tr>';
            }

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td style="color:#D946EF;">Obiettivo</td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: #D946EF; font-weight:700;">${targetVal}</td>`;
                });
                const _goalAvg = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                html += `<td style="text-align:center; color:#D946EF; font-weight:700; background:var(--bg-base);">${_goalAvg}</td>`;
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else if (teamAvgOnly) {
            // Solo Media Team nella tabella - con colonna Media
            let html = '<table class="data-table"><thead><tr><th scope="col">Metrica</th>';
            displayLabels.forEach(l => {
                html += `<th scope="col" style="text-align:center;">${l}</th>`;
            });
            html += `<th scope="col" style="text-align:center; background:var(--bg-base); color:var(--primary);">Media</th>`;
            html += '</tr></thead><tbody>';

            metricsList.forEach(m => {
                const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                const avgPts = getTeamAvgPtsForMetric(m);
                const labelText = metricsList.length > 1 ? `Media Team (${rKey})` : 'Media Team';
                html += '<tr style="font-weight:700;">';
                html += `<td style="color:var(--primary);">${labelText}</td>`;
                let _sSum = 0, _sCnt = 0;
                labels.forEach((date, idx) => {
                    const avgVal = avgPts[idx] === null ? '' : avgPts[idx];
                    if (typeof avgVal === 'number') { _sSum += avgVal; _sCnt++; }
                    html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
                });
                const _sAvg = _sCnt > 0 ? Math.round(_sSum / _sCnt) : '';
                const _sAvgCell = _sAvg === '' ? '' : `<span style="color:var(--primary);">${_sAvg}</span>`;
                html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_sAvgCell}</td>`;
                html += '</tr>';
            });

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td style="color:#D946EF;">Obiettivo</td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: #D946EF; font-weight:700;">${targetVal}</td>`;
                });
                const _gAvg = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                html += `<td style="text-align:center; color:#D946EF; font-weight:700; background:var(--bg-base);">${_gAvg}</td>`;
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else {
            const colHeader = window.appState.isAnonymous ? 'Collab' : 'Collaboratore';
            let html = `<table class="data-table"><thead><tr><th scope="col">${colHeader}</th>`;
            displayLabels.forEach(l => {
                html += `<th scope="col" style="text-align:center;">${l}</th>`;
            });
            html += `<th scope="col" style="text-align:center; background:var(--bg-base); color:var(--primary);">Media</th>`;
            html += '</tr></thead><tbody>';

            employees.forEach(emp => {
                const dispName = window.getDisplayName(emp);
                html += `<tr><td style="font-weight:600;">${dispName}</td>`;
                let _rowSum = 0, _rowCnt = 0;
                labels.forEach(date => {
                    let raw = '';
                    if (datesWithData.has(date)) {
                        raw = (empDateMap[emp] && empDateMap[emp][date] !== undefined) ? empDateMap[emp][date] : 0;
                    }
                    const cellVal = (typeof raw === 'number') ? Math.round(raw) : raw;
                    if (typeof cellVal === 'number') { _rowSum += cellVal; _rowCnt++; }
                    const cellHtml = renderCellHtml(cellVal);
                    html += `<td style="text-align:center;">${cellHtml}</td>`;
                });
                const _avg = _rowCnt > 0 ? Math.round(_rowSum / _rowCnt) : '';
                const _avgHtml = _avg === '' ? '' : renderCellHtml(_avg);
                html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_avgHtml}</td>`;
                html += '</tr>';
            });

            if (showTeamAvg) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.1); border-top: 2px solid var(--border);">';
                html += `<td style="color:var(--primary);">Media Team</td>`;
                let _tSum = 0, _tCnt = 0;
                labels.forEach((date, idx) => {
                    const avgVal = teamAvgPts[idx] === null ? '' : teamAvgPts[idx];
                    if (typeof avgVal === 'number') { _tSum += avgVal; _tCnt++; }
                    html += `<td style="text-align:center; color: var(--primary);">${avgVal}</td>`;
                });
                const _tAvg = _tCnt > 0 ? Math.round(_tSum / _tCnt) : '';
                const _tAvgCell = _tAvg === '' ? '' : `<span style="color:var(--primary);">${_tAvg}</span>`;
                html += `<td style="text-align:center; font-weight:700; background:var(--bg-base); color:var(--primary);">${_tAvgCell}</td>`;
                html += '</tr>';
            }

            if (showTeamGoal && relevantGoal) {
                html += '<tr style="font-weight:700; background: rgba(127,127,127,0.05); border-top: 1px dashed var(--border);">';
                html += `<td style="color:#D946EF;">Obiettivo</td>`;
                labels.forEach(() => {
                    const targetVal = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                    html += `<td style="text-align:center; color: #D946EF; font-weight:700;">${targetVal}</td>`;
                });
                const _gAvg = relevantGoal.target !== undefined && relevantGoal.target !== null ? relevantGoal.target : '';
                html += `<td style="text-align:center; color:#D946EF; font-weight:700; background:var(--bg-base);">${_gAvg}</td>`;
                html += '</tr>';
            }

            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        }
    } else if (statConfig.type === 'pie') {
        // --- Grafico a Torta ---
        const metricsList = statConfig.metrics && statConfig.metrics.length > 0 ? statConfig.metrics : [statConfig.metric];
        const pieMode = statConfig.pieMode || 'collaboratori';
        const pieGoalCenter = !!statConfig.pieGoalCenter;
        const isPieMulti = metricsList.length > 1;
        let pieEntries = [];

        // Prezzo totale di un pacchetto per un record Sales (esclude Product e Nb Events)
        const getRecordPrice = (row) => {
            let price = 0;
            Object.keys(row.data || {}).forEach(k => {
                if (k === 'Product' || k === 'Nb Events') return;
                price += parseMetricValue(row.data[k]);
            });
            return price;
        };

        const isSalesRowMatching = (row) => {
            if (!row || !row.data) return false;
            // Se la metrica è AOIT, accetta solo righe AOIT ed escludi altri tipi di vendita (Nuovi Abo, Ret, ecc.)
            if (rawKey.toLowerCase().includes('aoit')) {
                return (row.skill && row.skill.toLowerCase().includes('aoit')) || 
                       row.data['AOIT'] !== undefined || 
                       row.data['AOIT gew'] !== undefined || 
                       row.data['AOIT (CHF)'] !== undefined;
            }
            // Per altre metriche sales:
            if (statConfig.skill && statConfig.skill !== 'ALL' && row.skill && row.skill !== statConfig.skill) return false;
            // Filtro skill collaboratore per torta Sales: se skill selezionato, esige che il collaboratore abbia quello skill
            if (statConfig.skill && statConfig.skill !== 'ALL') {
                const empSkills = window.appState.collaboratorSkills?.[row.employee] || [];
                const hasCollabSkill = Array.isArray(empSkills) && empSkills.includes(statConfig.skill);
                const hasRowSkill = row.skill === statConfig.skill;
                if (!hasCollabSkill && !hasRowSkill) return false;
            }
            if (row.data[rawKey] !== undefined && row.data[rawKey] !== null) return true;
            if (row.skill === rawKey) return true;
            if (row.data.Product && row.data.Product.toLowerCase() === rawKey.toLowerCase()) return true;
            return false;
        };

        // Totale pacchetti (prezzo)
        const buildPackagePriceEntries = (targetEmp = null) => {
            const prodTotals = {};
            salesData.forEach(row => {
                if (!isSalesRowMatching(row)) return;
                if (targetEmp && row.employee !== targetEmp) return;
                // Ulteriore filtro collaboratore se skill selezionato (per modalità pacchetti)
                if (!targetEmp && statConfig.skill && statConfig.skill !== 'ALL') {
                    const empSkills = window.appState.collaboratorSkills?.[row.employee] || [];
                    const hasCollabSkill = Array.isArray(empSkills) && empSkills.includes(statConfig.skill);
                    const hasRowSkill = row.skill === statConfig.skill;
                    if (!hasCollabSkill && !hasRowSkill) return;
                }
                const prod = row.data && row.data.Product;
                if (!prod) return;
                const price = getRecordPrice(row);
                if (price <= 0) return;
                if (!prodTotals[prod]) prodTotals[prod] = 0;
                prodTotals[prod] += price;
            });
            return Object.entries(prodTotals).sort((a, b) => b[1] - a[1]);
        };

        // Totale per collaboratore della metrica selezionata
        const buildCollaboratorEntries = (targetEmp = null) => {
            const empTotals = {};
            const empList = targetEmp ? [targetEmp] : employees;
            empList.forEach(emp => {
                let total = 0;
                labels.forEach(date => {
                    if (datesWithData.has(date) && empDateMap[emp] && empDateMap[emp][date] !== undefined) {
                        total += empDateMap[emp][date];
                    }
                });
                if (total > 0) empTotals[emp] = total;
            });
            return Object.entries(empTotals).map(([e, v]) => [window.getDisplayName(e), v]).sort((a, b) => b[1] - a[1]);
        };

        // Quantità per pacchetto
        const buildPackageQtyEntries = (targetEmp = null) => {
            const prodTotals = {};
            salesData.forEach(row => {
                if (!isSalesRowMatching(row)) return;
                if (targetEmp && row.employee !== targetEmp) return;
                if (!targetEmp && statConfig.skill && statConfig.skill !== 'ALL') {
                    const empSkills = window.appState.collaboratorSkills?.[row.employee] || [];
                    const hasCollabSkill = Array.isArray(empSkills) && empSkills.includes(statConfig.skill);
                    const hasRowSkill = row.skill === statConfig.skill;
                    if (!hasCollabSkill && !hasRowSkill) return;
                }
                const prod = row.data && row.data.Product;
                if (!prod) return;
                const qty = Math.round(parseMetricValue(row.data['Nb Events'])) || 1;
                if (!prodTotals[prod]) prodTotals[prod] = 0;
                prodTotals[prod] += qty;
            });
            return Object.entries(prodTotals).sort((a, b) => b[1] - a[1]);
        };

        // Obiettivo rilevante per questa metrica (team o individuale, da store o da tabelle vendite)
        let relevantGoalTarget = null;
        const metricKey = statConfig.metric || '';
        const rawMetricKey = rawKey;

        const matchesGoalMetric = (g) => {
            if (!g) return false;
            const gMetric = g.metric || '';
            const gRaw = gMetric.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
            if (gMetric === metricKey || gRaw === rawMetricKey || gMetric === rawMetricKey || gRaw === metricKey) return true;
            if (Array.isArray(g.mappedMetrics) && (g.mappedMetrics.includes(metricKey) || g.mappedMetrics.includes(rawMetricKey) || g.mappedMetrics.some(m => m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '') === rawMetricKey))) return true;
            if (g.id && (g.id.endsWith('_' + rawMetricKey) || g.id.includes('_' + rawMetricKey + '_') || g.id.includes('_' + rawMetricKey))) return true;
            return false;
        };

        const matchesGoalSkill = (g) => {
            if (!statConfig.skill || statConfig.skill === 'ALL') return true;
            if (!g.skill || g.skill === 'ALL') return true;
            return g.skill === statConfig.skill;
        };

        const matchingGoals = (goals || []).filter(g => matchesGoalMetric(g) && matchesGoalSkill(g));

        if (isIndividual && employeeName) {
            const indGoal = matchingGoals.find(g => g.employee === employeeName);
            if (indGoal && parseFloat(indGoal.target) > 0) {
                relevantGoalTarget = parseFloat(indGoal.target);
            } else {
                const teamGoal = matchingGoals.find(g => !g.employee);
                if (teamGoal && parseFloat(teamGoal.target) > 0) relevantGoalTarget = parseFloat(teamGoal.target);
            }
        } else {
            const teamGoal = matchingGoals.find(g => !g.employee);
            if (teamGoal && parseFloat(teamGoal.target) > 0) {
                relevantGoalTarget = parseFloat(teamGoal.target);
            } else {
                const indGoals = matchingGoals.filter(g => Boolean(g.employee));
                if (indGoals.length > 0) {
                    const empMap = {};
                    indGoals.forEach(g => {
                        if (g.employee && !empMap[g.employee]) {
                            empMap[g.employee] = parseFloat(g.target) || 0;
                        }
                    });
                    const sum = Object.values(empMap).reduce((s, v) => s + v, 0);
                    if (sum > 0) relevantGoalTarget = sum;
                }
            }
        }

        // Se non ancora trovato nello store goals, verifica nelle impostazioni delle tabelle obiettivi
        if (!relevantGoalTarget) {
            try {
                const yr = window.appState?.activeYear || new Date().getFullYear().toString();
                const tablesList = await appDb.getSetting(`sales_tables_list_${yr}`, []);
                for (const t of (tablesList || [])) {
                    if (statConfig.skill && statConfig.skill !== 'ALL' && t.skill && t.skill !== 'ALL' && t.skill !== statConfig.skill) continue;
                    const products = await appDb.getSetting(`sales_table_products_${t.id}`, []);
                    const matchingProd = (products || []).find(p => {
                        if (p.key === rawMetricKey || p.label === rawMetricKey || p.label === metricKey) return true;
                        if (p.mappedMetric === metricKey || p.mappedMetric === rawMetricKey) return true;
                        if (Array.isArray(p.mappedMetrics) && (p.mappedMetrics.includes(metricKey) || p.mappedMetrics.includes(rawMetricKey))) return true;
                        return false;
                    });
                    if (matchingProd) {
                        const savedTargets = await appDb.getSetting(`sales_table_targets_${yr}_${t.id}`, {});
                        if (savedTargets) {
                            if (isIndividual && employeeName) {
                                const indivTotal = Number(savedTargets['INDIV_TOTAL_' + matchingProd.key] || 0);
                                if (indivTotal > 0) {
                                    const collabWorkPcts = await appDb.getSetting('collab_work_pcts', {});
                                    let totalWork = 0;
                                    Object.values(collabWorkPcts).forEach(v => totalWork += (v ?? 100));
                                    const empWorkPct = collabWorkPcts[employeeName] ?? 100;
                                    relevantGoalTarget = totalWork > 0 ? Math.round(indivTotal * (empWorkPct / totalWork)) : 0;
                                    break;
                                }
                                const teamTgt = Number(savedTargets['TEAM_' + matchingProd.key] || 0);
                                if (teamTgt > 0) { relevantGoalTarget = teamTgt; break; }
                            } else {
                                const teamTgt = Number(savedTargets['TEAM_' + matchingProd.key] || 0);
                                if (teamTgt > 0) { relevantGoalTarget = teamTgt; break; }
                                const indivTotal = Number(savedTargets['INDIV_TOTAL_' + matchingProd.key] || 0);
                                if (indivTotal > 0) { relevantGoalTarget = indivTotal; break; }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Error fetching sales table targets for pie chart:', e);
            }
        }

        // Colore base: quello scelto dall'utente (primo colore della configurazione)
        const baseColor = (statConfig.colors && statConfig.colors.length > 0) ? statConfig.colors[0] : '#2563EB';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#e2e8f0';
        const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim() || '#1e2130';
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#9333EA';

        // Crea il testo al centro dell'anello: % obiettivo (se attivata e presente) altrimenti totale
        const getCenterText = (entries) => {
            const total = entries.reduce((sum, [, v]) => sum + v, 0);
            if (pieGoalCenter && relevantGoalTarget && relevantGoalTarget > 0) {
                const pct = Math.round((total / relevantGoalTarget) * 100);
                return { text: pct + '%', color: primaryColor, size: 28 };
            }
            return { text: Math.round(total).toLocaleString('it-CH'), color: textColor, size: 22 };
        };

        // Renderizza una singola torta dentro un contenitore con spaziatura uniforme
        const renderDonut = (container, entries, labelSuffix = null, titleText = null) => {
            if (entries.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                return;
            }
            const total = entries.reduce((sum, [, v]) => sum + v, 0);
            const pieShades = generateColorShades(baseColor, entries.length);
            const center = getCenterText(entries);
            const labels = entries.map(([label, v]) => {
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return labelSuffix ? `${label} (${labelSuffix(v, pct)})` : `${label} (${pct}%)`;
            });

            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; align-items:center; gap:28px; height:100%; width:100%; min-width:0;';

            const canvasWrap = document.createElement('div');
            canvasWrap.style.cssText = 'width:320px; height:320px; min-width:320px; min-height:320px; position:relative; flex-shrink:0;';
            const canvas = document.createElement('canvas');
            canvasWrap.appendChild(canvas);
            wrap.appendChild(canvasWrap);

            const legendEl = document.createElement('div');
            legendEl.style.cssText = 'display:flex; flex-direction:column; gap:10px; min-width:0; justify-content:center;';
            if (titleText) {
                const tEl = document.createElement('div');
                tEl.style.cssText = 'font-size:15px; font-weight:600; color:var(--text-main); margin-bottom:6px; white-space:nowrap;';
                tEl.textContent = titleText;
                legendEl.appendChild(tEl);
            }

            entries.forEach(([, v], idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-main); cursor:pointer; user-select:none; transition:opacity 0.2s;';
                item.innerHTML = `
                    <span style="width:13px; height:13px; border-radius:3px; background:${pieShades[idx]}; flex-shrink:0; display:inline-block;"></span>
                    <span class="donut-item-label" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${labels[idx]}</span>
                `;
                legendEl.appendChild(item);
            });
            wrap.appendChild(legendEl);
            container.appendChild(wrap);

            const chart = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: entries.map(([, v]) => v),
                        backgroundColor: pieShades,
                        borderWidth: 2,
                        borderColor: surfaceColor
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        centerText: center,
                        legend: { display: false }
                    }
                }
            });

            legendEl.querySelectorAll('div[style*="cursor:pointer"]').forEach((itemEl, idx) => {
                itemEl.addEventListener('click', () => {
                    chart.toggleDataVisibility(idx);
                    chart.update();
                    const isHidden = !chart.getDataVisibility(idx);
                    itemEl.style.textDecoration = isHidden ? 'line-through' : 'none';
                    itemEl.style.opacity = isHidden ? '0.35' : '1';
                });
            });
        };

        if (isPieMulti) {
            // Se multi-metrica, la torta confronta le metriche totali
            const metricTotals = {};
            metricsList.forEach(m => {
                const isP = m.startsWith('Performance: ');
                const isSt = m.startsWith('Stati: ');
                const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '').replace(/^State Rcode - /, '');
                const sData = isSt ? statiData : (isP ? perfData : salesData);
                let sum = 0;
                sData.forEach(row => {
                    if (isIndividual && employeeName && row.employee !== employeeName) return;
                    if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                    sum += parseMetricValue(getStatiAwareValue(row.data, rKey) ?? 0);
                });
                metricTotals[rKey] = sum;
            });
            pieEntries = Object.entries(metricTotals).filter(([, v]) => v > 0);
            if (pieEntries.length === 0) {
                canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile per le metriche selezionate (verifica che i dati Stati siano stati importati per l\'anno ' + activeYr + ').</p>';
            } else {
                // Se la torta è stata creata con modalità pacchetti/doppia (sales-only) ma contiene metriche Stati/Performance, forza comunque la vista confronti metriche
                renderDonut(canvasContainer, pieEntries);
            }
        } else if (pieMode === 'doppia') {
            // Doppia Torta: solo Sales — per Stati/Performance legacy fallback a collaboratori
            const isPieNonSales = statConfig.metric.startsWith('Performance: ') || statConfig.metric.startsWith('Stati: ');
            if (isPieNonSales) {
                const fallbackEntries = buildCollaboratorEntries(isIndividual && employeeName ? employeeName : null);
                if (fallbackEntries.length === 0) {
                    canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                } else {
                    renderDonut(canvasContainer, fallbackEntries);
                }
            } else if (isIndividual && employeeName) {
                // In visuale singolo collaboratore: la torta collaboratori scompare e mostra solo i pacchetti del collaboratore
                const pkgPriceEntries = buildPackagePriceEntries(employeeName);
                if (pkgPriceEntries.length === 0) {
                    canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                } else {
                    renderDonut(canvasContainer, pkgPriceEntries, (v, pct) => 'CHF ' + Math.round(v).toLocaleString('de-CH') + ' · ' + pct + '%', 'Pacchetti — Prezzo Totale');
                }
            } else {
                const pkgPriceEntries = buildPackagePriceEntries();
                const collabEntries = buildCollaboratorEntries();
                if (pkgPriceEntries.length === 0 && collabEntries.length === 0) {
                    canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                } else {
                    canvasContainer.style.height = '390px';
                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = 'display:flex; gap:36px; height:100%; width:100%; flex-wrap:wrap; align-items:center;';
                    const fmtPrice = (v) => 'CHF ' + Math.round(v).toLocaleString('de-CH');
                    if (collabEntries.length > 0) {
                        const box1 = document.createElement('div');
                        box1.style.cssText = 'flex:1 1 380px; display:flex; min-width:0;';
                        wrapper.appendChild(box1);
                        renderDonut(box1, collabEntries, null, 'Totale per Collaboratore');
                    }
                    if (pkgPriceEntries.length > 0) {
                        const box2 = document.createElement('div');
                        box2.style.cssText = 'flex:1 1 380px; display:flex; min-width:0;';
                        wrapper.appendChild(box2);
                        renderDonut(box2, pkgPriceEntries, (v, pct) => 'CHF ' + Math.round(v).toLocaleString('de-CH') + ' · ' + pct + '%', 'Pacchetti — Prezzo Totale (Team)');
                    }
                    canvasContainer.appendChild(wrapper);
                }
            }
        } else if (pieMode === 'pacchetti') {
            // Modalità Pacchetti: solo Sales — per Stati/Performance legacy fallback a collaboratori
            const isPieNonSales = statConfig.metric.startsWith('Performance: ') || statConfig.metric.startsWith('Stati: ');
            if (isPieNonSales) {
                const fallbackEntries = buildCollaboratorEntries(isIndividual && employeeName ? employeeName : null);
                if (fallbackEntries.length === 0) {
                    canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                } else {
                    renderDonut(canvasContainer, fallbackEntries);
                }
            } else {
                const targetEmp = (isIndividual && employeeName) ? employeeName : null;
                pieEntries = buildPackageQtyEntries(targetEmp);
                if (pieEntries.length === 0) {
                    canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                } else {
                    renderDonut(canvasContainer, pieEntries, (v, pct) => Math.round(v) + ' pz · ' + pct + '%');
                }
            }
        } else {
            // Modalità Collaboratori: totale per ogni collaboratore (per Stati/Performance è l'unica valida; per Sales mostra pacchetti del singolo se in visuale individuale)
            const isPieSales = statConfig.metric.startsWith('Sales: ');
            if (isIndividual && employeeName) {
                if (isPieSales) {
                    pieEntries = buildPackagePriceEntries(employeeName);
                    if (pieEntries.length === 0) {
                        canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                    } else {
                        renderDonut(canvasContainer, pieEntries, (v, pct) => 'CHF ' + Math.round(v).toLocaleString('de-CH') + ' · ' + pct + '%', 'Pacchetti — Prezzo Totale');
                    }
                } else {
                    pieEntries = buildCollaboratorEntries(employeeName);
                    if (pieEntries.length === 0) {
                        canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                    } else {
                        renderDonut(canvasContainer, pieEntries);
                    }
                }
            } else {
                pieEntries = buildCollaboratorEntries();
                if (pieEntries.length === 0) {
                    canvasContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px 0;">Nessun dato disponibile</p>';
                } else {
                    renderDonut(canvasContainer, pieEntries);
                }
            }
        }
        if (!canvasContainer.style.height) canvasContainer.style.height = '390px';
    } else {
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        let datasets = [];
        const colorsList = (statConfig.colors && statConfig.colors.length > 0) ? statConfig.colors : DISTINCT_COLORS;

        const isBar = statConfig.type === 'bar';
        const metricsList = statConfig.metrics && statConfig.metrics.length > 0 ? statConfig.metrics : [statConfig.metric];

        if (metricsList.length > 1 && !teamAvgOnly) {
            if (isIndividual) {
                metricsList.forEach((m, idx) => {
                    const isP = m.startsWith('Performance: ');
                    const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                    const sData = isP ? perfData : salesData;
                    const dateAgg = {};
                    sData.forEach(row => {
                        if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                        if (!isP && statConfig.product && row.data['Product'] !== statConfig.product) return;
                        if (row.employee !== employeeName) return;
                        const date = row.date;
                        const monthKey = (date && date.length >= 7) ? date.slice(0,7) : date;
                        const val = parseMetricValue(getStatiAwareValue(row.data, rKey) ?? 0);
                        if (!dateAgg[monthKey]) dateAgg[monthKey] = 0;
                        dateAgg[monthKey] += val;
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

                if (showTeamAvg) {
                    if (metricsList.length > 1) {
                        metricsList.forEach((m, idx) => {
                            const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                            const avgPts = getTeamAvgPtsForMetric(m);
                            const baseColor = colorsList[idx % colorsList.length];
                            const lineColor = getMediaTeamLineColor(baseColor);
                            const yAxisID = idx > 0 ? 'y2' : 'y';
                            datasets.push({
                                label: `Media Team (${rKey})`,
                                data: avgPts,
                                type: 'line',
                                yAxisID: yAxisID,
                                borderColor: lineColor,
                                backgroundColor: lineColor,
                                borderWidth: 3.5,
                                borderDash: [6, 3],
                                pointRadius: 0,
                                pointHoverRadius: 5,
                                pointBackgroundColor: lineColor,
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 2,
                                fill: false,
                                tension: 0.35,
                                order: 0
                            });
                        });
                    } else {
                        const baseColor = colorsList[0] || '#2563EB';
                        const lineColor = getMediaTeamLineColor(baseColor);
                        datasets.push({
                            label: 'Media Team',
                            data: teamAvgPts,
                            type: 'line',
                            borderColor: lineColor,
                            backgroundColor: lineColor,
                            borderWidth: 3.5,
                            borderDash: [6, 3],
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointBackgroundColor: lineColor,
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            fill: false,
                            tension: 0.35,
                            order: 0
                        });
                    }
                }
            } else {
                metricsList.forEach((m, idx) => {
                    const isP = m.startsWith('Performance: ');
                    const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                    const sData = isP ? perfData : salesData;
                    const empMap = {};
                    sData.forEach(row => {
                        if (isP && statConfig.skill && statConfig.skill !== 'ALL' && row.skill !== statConfig.skill) return;
                        if (!isP && statConfig.product && row.data['Product'] !== statConfig.product) return;
                        const date = row.date;
                        const monthKey = (date && date.length >= 7) ? date.slice(0,7) : date;
                        const emp = row.employee;
                        if (!emp) return;
                        const val = parseMetricValue(getStatiAwareValue(row.data, rKey) ?? 0);
                        if (!empMap[emp]) empMap[emp] = {};
                        if (!empMap[emp][monthKey]) empMap[emp][monthKey] = 0;
                        empMap[emp][monthKey] += val;
                    });

                    const baseColor = colorsList[idx % colorsList.length];
                    const yAxisID = (metricsList.length > 1 && idx > 0) ? 'y2' : 'y';
                    const metricShades = generateBarColorShades(baseColor, employees.length);

                    employees.forEach((emp, empIdx) => {
                        const empColor = metricShades[empIdx] || baseColor;
                        const pts = labels.map(l => datesWithData.has(l) ? ((empMap[emp] && empMap[emp][l] !== undefined) ? empMap[emp][l] : 0) : null);
                        const empName = window.getDisplayName(emp);
                        const labelText = `${empName} (${rKey})`;

                        datasets.push({
                            label: labelText,
                            data: pts,
                            type: isBar ? 'bar' : 'line',
                            yAxisID: yAxisID,
                            backgroundColor: isBar ? hexToRgba(empColor, 0.85) : hexToRgba(empColor, 0.15),
                            borderColor: empColor,
                            borderWidth: isBar ? 1 : 1.8,
                            borderRadius: isBar ? 4 : 0,
                            minBarLength: isBar ? 4 : 0,
                            pointRadius: 0,
                            pointHoverRadius: isBar ? 0 : 5,
                            pointBackgroundColor: empColor,
                            tension: 0.35,
                            order: 2
                        });
                    });
                });

                if (showTeamAvg) {
                    metricsList.forEach((m, idx) => {
                        const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                        const avgPts = getTeamAvgPtsForMetric(m);
                        const baseColor = colorsList[idx % colorsList.length];
                        const lineColor = getMediaTeamLineColor(baseColor);
                        const yAxisID = idx > 0 ? 'y2' : 'y';
                        datasets.push({
                            label: `Media Team (${rKey})`,
                            data: avgPts,
                            type: 'line',
                            yAxisID: yAxisID,
                            borderColor: lineColor,
                            backgroundColor: lineColor,
                            borderWidth: 3.5,
                            borderDash: [6, 3],
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointBackgroundColor: lineColor,
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            fill: false,
                            tension: 0.35,
                            order: 0
                        });
                    });
                }
            }
        } else if (isIndividual) {
            const indColor = colorsList[0];
            datasets.push({
                label: employeeName ? window.getDisplayName(employeeName) : statConfig.title,
                data: dataPts,
                type: isBar ? 'bar' : 'line',
                backgroundColor: isBar ? hexToRgba(indColor, 0.8) : hexToRgba(indColor, 0.15),
                borderColor: indColor,
                borderWidth: isBar ? 1 : 1.8,
                borderRadius: isBar ? 4 : 0,
                minBarLength: isBar ? 4 : 0,
                pointRadius: 0,
                pointHoverRadius: isBar ? 0 : 5,
                tension: 0.35,
                order: 2
            });

            if (showTeamAvg) {
                const lineColor = getMediaTeamLineColor(indColor);
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: 'line',
                    borderColor: lineColor,
                    backgroundColor: lineColor,
                    borderWidth: 3.5,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    order: 0
                });
            }
        } else if (teamAvgOnly) {
            // Solo Media Team
            if (metricsList.length > 1) {
                metricsList.forEach((m, idx) => {
                    const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                    const avgPts = getTeamAvgPtsForMetric(m);
                    const baseColor = colorsList[idx % colorsList.length];
                    const yAxisID = idx > 0 ? 'y2' : 'y';
                    datasets.push({
                        label: `Media Team (${rKey})`,
                        data: avgPts,
                        type: isBar ? 'bar' : 'line',
                        yAxisID: yAxisID,
                        backgroundColor: isBar ? hexToRgba(baseColor, 0.85) : hexToRgba(baseColor, 0.15),
                        borderColor: baseColor,
                        borderWidth: isBar ? 1 : 3.5,
                        borderRadius: isBar ? 4 : 0,
                        minBarLength: isBar ? 4 : 0,
                        pointRadius: 0,
                        pointHoverRadius: isBar ? 0 : 5,
                        pointBackgroundColor: baseColor,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        borderDash: isBar ? [] : [6, 4],
                        tension: 0.35,
                        order: 1
                    });
                });
            } else {
                const teamBaseColor = colorsList[0] || '#2563EB';
                const lineColor = getMediaTeamLineColor(teamBaseColor);
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: isBar ? 'bar' : 'line',
                    backgroundColor: isBar ? hexToRgba(teamBaseColor, 0.85) : hexToRgba(teamBaseColor, 0.15),
                    borderColor: isBar ? teamBaseColor : lineColor,
                    borderWidth: isBar ? 1 : 3.5,
                    borderRadius: isBar ? 4 : 0,
                    minBarLength: isBar ? 4 : 0,
                    pointRadius: 0,
                    pointHoverRadius: isBar ? 0 : 5,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    borderDash: isBar ? [] : [6, 4],
                    tension: 0.35,
                    order: 1
                });
            }
        } else {
            const teamBaseColor = colorsList[0];
            const teamShades = generateBarColorShades(teamBaseColor, employees.length);
            employees.forEach((emp, idx) => {
                const color = teamShades[idx] || teamBaseColor;
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
                const lineColor = getMediaTeamLineColor(teamBaseColor);
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: 'line',
                    borderColor: lineColor,
                    backgroundColor: lineColor,
                    borderWidth: 3.5,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    order: 0
                });
            }
        }

        let maxTarget = undefined;
        let minTarget = undefined;

        if (relevantGoal) {
            maxTarget = relevantGoal.target;
            minTarget = relevantGoal.target;

            const range = window.computeGoalRange ? window.computeGoalRange(relevantGoal) : { min: relevantGoal.target, max: relevantGoal.target };
            if (range.max !== null) maxTarget = range.max;
            if (range.min !== null) minTarget = range.min;
        }
        
        // Calculate adaptive min and max for Y and Y2 scales
        let allVals = [];
        let allY2Vals = [];
        datasets.forEach(ds => {
            if (ds.data && Array.isArray(ds.data)) {
                ds.data.forEach(v => {
                    if (v !== null && v !== undefined && !isNaN(v)) {
                        if (ds.yAxisID === 'y2') {
                            allY2Vals.push(v);
                        } else {
                            allVals.push(v);
                        }
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
            return Math.ceil(val * 100) / 100;
        }
        function niceRoundDown(val) {
            if (val === 0) return 0;
            const absVal = Math.abs(val);
            if (absVal >= 1) return Math.floor(val);
            return Math.floor(val * 100) / 100;
        }

        let yScalesConfig = {};
        const hasYMin = statConfig.yMin !== null && statConfig.yMin !== undefined && !isNaN(statConfig.yMin);
        const hasYMax = statConfig.yMax !== null && statConfig.yMax !== undefined && !isNaN(statConfig.yMax);
        if (hasYMin || hasYMax) {
            if (hasYMin) yScalesConfig.min = statConfig.yMin;
            else yScalesConfig.beginAtZero = true;
            if (hasYMax) yScalesConfig.max = statConfig.yMax;
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

        const isMultiMetrics = metricsList.length > 1;
        // Precisione dei tick: per valori sotto 1 (es. percentuali) mostra 2 decimali
        const yTickPrecision = allVals.length > 0 && Math.max(...allVals.map(v => Math.abs(v))) < 1 ? 2 : undefined;
        const scalesConfig = {
            x: {
                grid: {
                    display: false,
                    drawOnChartArea: false
                }
            },
            y: {
                ...yScalesConfig,
                ticks: yTickPrecision !== undefined ? { precision: yTickPrecision } : undefined,
                grid: {
                    color: 'rgba(128, 128, 128, 0.15)'
                }
            }
        };

        if (isMultiMetrics) {
            let y2ScalesConfig = {};
            const hasY2Min = statConfig.y2Min !== null && statConfig.y2Min !== undefined && !isNaN(statConfig.y2Min);
            const hasY2Max = statConfig.y2Max !== null && statConfig.y2Max !== undefined && !isNaN(statConfig.y2Max);
            if (hasY2Min || hasY2Max) {
                if (hasY2Min) y2ScalesConfig.min = statConfig.y2Min;
                else y2ScalesConfig.beginAtZero = true;
                if (hasY2Max) y2ScalesConfig.max = statConfig.y2Max;
            } else if (allY2Vals.length > 0) {
                const minVal = Math.min(...allY2Vals);
                const maxVal = Math.max(...allY2Vals);
                if (minVal === 0 && maxVal === 0) {
                    y2ScalesConfig = { min: 0, max: 1 };
                } else {
                    const range = maxVal - minVal;
                    const margin = (range > 0 ? range : Math.abs(maxVal) || 1) * 0.15;
                    const calculatedMin = (minVal >= 0 && minVal <= maxVal * 0.3) ? 0 : Math.max(0, niceRoundDown(minVal - margin));
                    const calculatedMax = niceRoundUp(maxVal + margin);
                    y2ScalesConfig = {
                        min: calculatedMin,
                        max: calculatedMax || 1
                    };
                }
            } else {
                y2ScalesConfig = { beginAtZero: true };
            }
            const y2TickPrecision = allY2Vals.length > 0 && Math.max(...allY2Vals.map(v => Math.abs(v))) < 1 ? 2 : undefined;
            scalesConfig.y2 = {
                position: 'right',
                ...y2ScalesConfig,
                ticks: y2TickPrecision !== undefined ? { precision: y2TickPrecision } : undefined,
                grid: { drawOnChartArea: false }
            };
        }

        new Chart(canvas, {
            type: isBar ? 'bar' : 'line',
            data: {
                labels: displayLabels,
                datasets: datasets
            },
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
                        display: metricsList.length > 1,
                        position: 'bottom',
                        align: 'start',
                        onClick: function(e, legendItem, legend) {
                            if (metricsList.length > 1 && legendItem.metricIndex !== undefined) {
                                const idx = legendItem.metricIndex;
                                const chart = legend.chart;
                                if (!isIndividual && !teamAvgOnly) {
                                    const startDs = idx * employees.length;
                                    const endDs = (idx + 1) * employees.length;
                                    const isVisible = chart.isDatasetVisible(startDs);
                                    for (let i = startDs; i < endDs; i++) {
                                        chart.setDatasetVisibility(i, !isVisible);
                                    }
                                } else {
                                    chart.setDatasetVisibility(idx, !chart.isDatasetVisible(idx));
                                }
                                chart.update();
                            } else {
                                Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
                            }
                        },
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#e2e8f0',
                            font: { size: 11 },
                            padding: 12,
                            boxWidth: 12,
                            generateLabels: function(chart) {
                                const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#e2e8f0';
                                if (metricsList.length > 1) {
                                    return metricsList.map((m, idx) => {
                                        const rKey = m.replace('Performance: ', '').replace('Sales: ', '').replace('Stati: ', '');
                                        const color = colorsList[idx % colorsList.length];
                                        const firstDsIndex = (!isIndividual && !teamAvgOnly) ? idx * employees.length : idx;
                                        const isHidden = !chart.isDatasetVisible(firstDsIndex);
                                        return {
                                            text: rKey,
                                            fillStyle: color,
                                            strokeStyle: color,
                                            fontColor: textColor,
                                            hidden: isHidden,
                                            datasetIndex: firstDsIndex,
                                            metricIndex: idx
                                        };
                                    });
                                }
                                return Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            }
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

const GOAL_COLORS = {
    notReached: { bg: 'transparent', border: 'var(--border)', label: 'Non raggiunto' },
    almost:     { bg: 'rgba(234,179,8,0.32)',  border: '#eab308', label: 'Quasi raggiunto' },
    reached:    { bg: 'rgba(34,197,94,0.32)',  border: '#22c55e', label: 'Raggiunto' },
    surpassed:  { bg: 'rgba(168,85,247,0.32)', border: '#a855f7', label: 'Superato' }
};

const DEFAULT_ALMOST_PCT = 80;
const DEFAULT_SURPASS_PCT = 105;
const DEFAULT_ALMOST_VAL = 1;
const DEFAULT_SURPASS_VAL = 1;

function getGoalReachedKey(actual, target, p) {
    const a = parseFloat(actual);
    const t = parseFloat(target);
    if (isNaN(a) || isNaN(t) || t <= 0) return null;
    if (p.thresholdMode === 'val') {
        const almostDelta = (p.almostVal !== undefined && p.almostVal !== null) ? p.almostVal : DEFAULT_ALMOST_VAL;
        const surpassDelta = (p.surpassVal !== undefined && p.surpassVal !== null) ? p.surpassVal : DEFAULT_SURPASS_VAL;
        if (a < t - almostDelta) return 'notReached';
        if (a < t) return 'almost';
        if (a < t + surpassDelta) return 'reached';
        return 'surpassed';
    }
    const almostPct = (p.almostPct !== undefined && p.almostPct !== null) ? p.almostPct : DEFAULT_ALMOST_PCT;
    const surpassPct = (p.surpassPct !== undefined && p.surpassPct !== null) ? p.surpassPct : DEFAULT_SURPASS_PCT;
    const ratio = a / t;
    if (ratio < (almostPct / 100)) return 'notReached';
    if (ratio < 1) return 'almost';
    if (ratio < (surpassPct / 100)) return 'reached';
    return 'surpassed';
}

function goalCellStyle(actual, target, p) {
    const key = getGoalReachedKey(actual, target, p);
    if (!key || key === 'notReached') return '';
    const c = GOAL_COLORS[key];
    return `background:${c.bg};`;
}

function buildGoalLegendHTML() {
    return `
        <div style="display:flex; align-items:center; gap:18px; flex-wrap:wrap; font-size:0.82rem; color:var(--text-muted); font-weight:500;">
            <span style="display:inline-flex; align-items:center; gap:7px; white-space:nowrap;"><span style="width:14px; height:14px; border-radius:4px; background:${GOAL_COLORS.notReached.bg}; border:1.5px solid ${GOAL_COLORS.notReached.border};"></span> ${GOAL_COLORS.notReached.label}</span>
            <span style="display:inline-flex; align-items:center; gap:7px; white-space:nowrap;"><span style="width:14px; height:14px; border-radius:4px; background:${GOAL_COLORS.almost.bg}; border:1.5px solid ${GOAL_COLORS.almost.border};"></span> ${GOAL_COLORS.almost.label}</span>
            <span style="display:inline-flex; align-items:center; gap:7px; white-space:nowrap;"><span style="width:14px; height:14px; border-radius:4px; background:${GOAL_COLORS.reached.bg}; border:1.5px solid ${GOAL_COLORS.reached.border};"></span> ${GOAL_COLORS.reached.label}</span>
            <span style="display:inline-flex; align-items:center; gap:7px; white-space:nowrap;"><span style="width:14px; height:14px; border-radius:4px; background:${GOAL_COLORS.surpassed.bg}; border:1.5px solid ${GOAL_COLORS.surpassed.border};"></span> ${GOAL_COLORS.surpassed.label}</span>
        </div>
    `;
}

/**
 * Calcola il valore realizzato per un collaboratore (o tutto il team) per una lista di metriche mappate.
 */
function calcActualForMetric(mappedMetrics, perfData, salesData, employee, isCHF = undefined) {
    let total = 0;
    if (!mappedMetrics || mappedMetrics.length === 0) return total;

    mappedMetrics.forEach(metric => {
        const isPerf = metric.startsWith('Performance: ');
        const rawKey = metric.replace(/^Performance:\s*/i, '').replace(/^Sales:\s*/i, '').trim();
        const normKey = normalizeGoalMetricKey(rawKey);
        const source = isPerf ? (perfData || []) : (salesData || []);

        const wantsCHF = (isCHF !== undefined && isCHF !== null)
            ? !!isCHF
            : (normKey.includes('aoit') || normKey.includes('chf'));

        source.forEach(row => {
            if (employee && row.employee !== employee) return;
            if (!row.data) return;

            let val = 0;
            if (isPerf) {
                val = parseMetricValue(getStatiAwareValue(row.data, rawKey) ?? 0);
            } else {
                // Sales data
                const rowProduct = row.data.Product || '';
                const normProduct = normalizeGoalMetricKey(rowProduct);
                const isAOITMetric = normKey.includes('aoit') || normKey === 'aoit';
                const isAOITRow = row.skill === 'AOIT' || row.category === 'sales_aoit' || row.data.AOIT !== undefined || row.data['AOIT (CHF)'] !== undefined || row.data['AOIT gew'] !== undefined;

                if (isAOITMetric) {
                    if (isAOITRow) {
                        val = wantsCHF
                            ? parseMetricValue(row.data.AOIT ?? row.data['AOIT (CHF)'] ?? row.data['AOIT gew'] ?? row.data.Value ?? 0)
                            : parseMetricValue(row.data.Quantity ?? row.data['Nb Events'] ?? 1);
                    } else if (rowProduct === rawKey || (normProduct && normProduct === normKey)) {
                        val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? row.data[rawKey] ?? 0);
                    }
                } else if (rowProduct && (rowProduct === rawKey || (normProduct && normProduct === normKey) || goalMetricMatches(rowProduct, rawKey))) {
                    if (isAOITRow) {
                        val = wantsCHF
                            ? parseMetricValue(row.data.AOIT ?? row.data['AOIT (CHF)'] ?? row.data['AOIT gew'] ?? row.data.Value ?? 0)
                            : parseMetricValue(row.data.Quantity ?? row.data['Nb Events'] ?? 1);
                    } else {
                        val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? row.data[rawKey] ?? row.data['Nb Events'] ?? 1);
                    }
                } else if (row.data[rawKey] !== undefined) {
                    val = parseMetricValue(getStatiAwareValue(row.data, rawKey) ?? 0);
                } else if (normKey.includes('internet') && (normProduct.includes('internet') || normProduct.includes('bb acq'))) {
                    val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? row.data['Nb Events'] ?? 1);
                } else if (normKey.includes('tv') && normProduct.includes('tv')) {
                    val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? row.data['Nb Events'] ?? 1);
                } else if (normKey.includes('mobile') && normProduct.includes('mobile')) {
                    val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? row.data['Nb Events'] ?? 1);
                } else if (normKey.includes('retention') && (normProduct.includes('retention') || normProduct.includes('ret'))) {
                    val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? row.data['Nb Events'] ?? 1);
                } else if (normKey.includes('security') && normProduct.includes('security')) {
                    if (isAOITRow) {
                        val = wantsCHF
                            ? parseMetricValue(row.data.AOIT ?? row.data['AOIT (CHF)'] ?? row.data['AOIT gew'] ?? row.data.Value ?? 0)
                            : parseMetricValue(row.data.Quantity ?? row.data['Nb Events'] ?? 1);
                    } else {
                        val = parseMetricValue(row.data.Value ?? row.data.Quantity ?? 1);
                    }
                }
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
        return Math.round(num).toString();
    };

    const table = document.createElement('table');
    table.style.cssText = 'width:auto; border-collapse:collapse; font-size:0.87rem; color:var(--text-main);';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
    wrapper.innerHTML = buildGoalLegendHTML();

    const thead = document.createElement('thead');
    let headHtml = `<tr style="background:var(--bg-base); border-bottom:1px solid var(--border);">
        <th rowspan="2" scope="colgroup" style="padding:10px 12px; text-align:left; border-right:1px solid var(--border); width:180px; min-width:160px; font-weight:700;">Collaboratore</th>
        <th rowspan="2" scope="colgroup" style="padding:10px 6px; text-align:center; border-right:1px solid var(--border); width:95px; min-width:85px; font-weight:700;">Occupazione</th>`;

    products.forEach(p => {
        headHtml += `<th colspan="2" scope="colgroup" style="padding:8px 12px; text-align:center; border-right:1px solid var(--border); font-weight:700; background:rgba(59,130,246,0.05);">
            <span>${p.label}</span>
        </th>`;
    });
    headHtml += '</tr>';

    headHtml += `<tr style="background:var(--bg-base); border-bottom:2px solid var(--border);">`;
    products.forEach(p => {
        headHtml += `
            <th scope="col" style="padding:6px 10px; text-align:center; border-right:1px solid var(--border); font-size:0.72rem; font-weight:600; color:var(--text-muted); background:rgba(59,130,246,0.02); min-width:80px;">Realizzato</th>
            <th scope="col" style="padding:6px 10px; text-align:center; border-right:1px solid var(--border); font-size:0.72rem; font-weight:600; color:var(--text-muted); background:rgba(59,130,246,0.02); min-width:80px;">Target</th>`;
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
            const mappedMetrics = (Array.isArray(p.mappedMetrics) && p.mappedMetrics.length > 0) ? p.mappedMetrics
                : (p.mappedMetric ? p.mappedMetric.split(',').map(s => s.trim()).filter(Boolean) : [p.label || p.key]);
            const actualVal = calcActualForMetric(mappedMetrics, perfData, salesData, emp, p.isCHF);

            if (p.mode === 'team') {
                const teamTotal = savedTargets['TEAM_' + p.key] ?? 0;
                rowHtml += `
                    <td style="padding:8px 10px; text-align:center; border-right:1px solid var(--border); font-family:monospace; font-weight:700; color:var(--text-main);">${formatVal(actualVal, p.isCHF)}</td>`;
                if (empIdx === 0) {
                    rowHtml += `
                        <td rowspan="${employees.length}" style="padding:12px; text-align:center; vertical-align:middle; border-right:1px solid var(--border); background:rgba(99,102,241,0.03); font-weight:800; color:var(--primary); font-family:monospace; font-size:0.95rem;">
                            ${formatVal(teamTotal, p.isCHF)}
                        </td>`;
                }
            } else {
                const indivTotal = savedTargets['INDIV_TOTAL_' + p.key] ?? 0;
                const objIndiv = totalWorkPctSum > 0 ? Math.round(indivTotal * (empWorkPct / totalWorkPctSum)) : 0;
                const cellBg = goalCellStyle(actualVal, objIndiv, p);
                rowHtml += `
                    <td style="padding:8px 10px; text-align:center; border-right:1px solid var(--border); font-family:monospace; font-weight:700; color:var(--text-main); ${cellBg}">${formatVal(actualVal, p.isCHF)}</td>
                    <td style="padding:8px 10px; text-align:center; border-right:1px solid var(--border); font-family:monospace; color:var(--text-muted);">${formatVal(objIndiv, p.isCHF)}</td>`;
            }
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    const tfoot = document.createElement('tfoot');
    let footHtml = `<tr style="background:var(--bg-base); font-weight:700; border-top:2px solid var(--border);">
        <td style="padding:10px 12px; border-right:1px solid var(--border); font-weight:800; color:var(--primary);">TOTALI</td>
        <td style="padding:10px 6px; text-align:center; border-right:1px solid var(--border); font-weight:800;"></td>`;

    products.forEach(p => {
        const mappedMetrics = (Array.isArray(p.mappedMetrics) && p.mappedMetrics.length > 0) ? p.mappedMetrics
            : (p.mappedMetric ? p.mappedMetric.split(',').map(s => s.trim()).filter(Boolean) : [p.label || p.key]);
        const actualTeam = calcActualForMetric(mappedMetrics, perfData, salesData, null, p.isCHF);
        if (p.mode === 'team') {
            const teamTotal = savedTargets['TEAM_' + p.key] ?? 0;
            const cellBg = goalCellStyle(actualTeam, teamTotal, p);
            footHtml += `
                <td style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); font-weight:800; color:var(--text-main); font-family:monospace; ${cellBg}">${formatVal(actualTeam, p.isCHF)}</td>
                <td style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); font-weight:800; color:var(--primary); font-family:monospace;">${formatVal(teamTotal, p.isCHF)}</td>`;
        } else {
            const indivTotal = savedTargets['INDIV_TOTAL_' + p.key] ?? 0;
            const cellBg = goalCellStyle(actualTeam, indivTotal, p);
            footHtml += `
                <td style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); font-weight:800; color:var(--text-main); font-family:monospace; ${cellBg}">${formatVal(actualTeam, p.isCHF)}</td>
                <td style="padding:10px 8px; text-align:center; border-right:1px solid var(--border); font-weight:800; color:var(--primary); font-family:monospace;">${formatVal(indivTotal, p.isCHF)}</td>`;
        }
    });
    footHtml += '</tr>';
    tfoot.innerHTML = footHtml;

    table.appendChild(tbody);
    table.appendChild(tfoot);
    wrapper.appendChild(table);
    return wrapper;
}

async function openGoalThresholdsModal(year, tableId) {
    const tablesList = await appDb.getSetting(`sales_tables_list_${year}`, []);
    const t = (tablesList || []).find(tbl => tbl.id === tableId);
    let products = await appDb.getSetting(`sales_table_products_${tableId}`, []);
    if (!products || !Array.isArray(products) || products.length === 0) return;

    let modal = document.getElementById('goal-thresholds-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'goal-thresholds-modal';
        modal.className = 'modal';
        modal.style.cssText = 'max-width: 740px; width: 96%; border-radius: 14px; max-height: 86vh;';
        document.body.appendChild(modal);
    }

    const overlay = document.getElementById('modal-overlay');
    const title = t ? t.name : 'Tabella Obiettivi';

    const modes = products.map(p => (p.thresholdMode === 'val' ? 'val' : 'pct'));
    const pctVals = products.map(p => [
        (p.almostPct !== undefined && p.almostPct !== null) ? p.almostPct : DEFAULT_ALMOST_PCT,
        (p.surpassPct !== undefined && p.surpassPct !== null) ? p.surpassPct : DEFAULT_SURPASS_PCT
    ]);
    const valVals = products.map(p => [
        (p.almostVal !== undefined && p.almostVal !== null) ? p.almostVal : DEFAULT_ALMOST_VAL,
        (p.surpassVal !== undefined && p.surpassVal !== null) ? p.surpassVal : DEFAULT_SURPASS_VAL
    ]);

    const modeLabels = {
        pct: { almost: 'Quasi raggiunto da', surpass: 'Superato da', unit: '%' },
        val: { almost: 'Quasi raggiunto entro', surpass: 'Superato di', unit: '' }
    };

    modal.innerHTML = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px 18px; border-bottom:1px solid var(--border);">
            <h2 style="font-size:1rem; font-weight:800; margin:0; color:var(--text-main); letter-spacing:-0.02em;">Soglie Colori Realizzato — ${title}</h2>
            <button class="close-modal" id="close-thr-modal" style="background:var(--bg-base); border:1px solid var(--border); width:30px; height:30px; border-radius:7px; font-size:1.25rem; cursor:pointer; color:var(--text-muted); display:flex; align-items:center; justify-content:center; flex-shrink:0; line-height:1;">&times;</button>
        </div>
        <div class="modal-body" style="padding:12px 16px; display:flex; flex-direction:column; gap:10px; overflow-y:auto; flex:1; min-height:0;">
            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; padding:8px 10px; background:var(--bg-base); border:1px solid var(--border); border-radius:8px;">
                <div style="display:inline-flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:0.68rem; font-weight:600; color:var(--text-muted);">
                    <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:9px; height:9px; border-radius:2px; background:transparent; border:1px solid var(--border);"></span> Non raggiunto</span>
                    <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:9px; height:9px; border-radius:2px; background:rgba(234,179,8,0.32); border:1px solid #eab308;"></span> Quasi</span>
                    <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:9px; height:9px; border-radius:2px; background:rgba(34,197,94,0.32); border:1px solid #22c55e;"></span> Raggiunto</span>
                    <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:9px; height:9px; border-radius:2px; background:rgba(168,85,247,0.32); border:1px solid #a855f7;"></span> Superato</span>
                </div>
                <span style="margin-left:auto; font-size:0.66rem; color:var(--text-muted); white-space:nowrap; border-left:1px solid var(--border); padding-left:10px;">Es: &lt;80% non raggiunto · 80–99% quasi · 100–104% raggiunto · ≥105% superato</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; padding:4px 10px 0; font-size:0.62rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--text-muted);">
                <span style="flex:1;">Prodotto</span>
                <span style="flex:0 0 108px; text-align:center;">Modalità</span>
                <span style="flex:0 0 78px; text-align:center; display:inline-flex; align-items:center; justify-content:center; gap:4px;"><span style="width:7px; height:7px; border-radius:2px; background:#eab308;"></span> Quasi</span>
                <span style="flex:0 0 78px; text-align:center; display:inline-flex; align-items:center; justify-content:center; gap:4px;"><span style="width:7px; height:7px; border-radius:2px; background:#a855f7;"></span> Superato</span>
            </div>
            <div id="threshold-cols-list" style="display:flex; flex-direction:column; gap:6px;">
                ${products.map((p, idx) => {
                    const m = modes[idx];
                    const vals = m === 'pct' ? pctVals[idx] : valVals[idx];
                    const unit = m === 'pct' ? '%' : '';
                    return `
                    <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--bg-base);">
                        <span style="font-weight:700; font-size:0.84rem; color:var(--text-main); flex:1; min-width:0; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.label}">${p.label}</span>
                        <div style="display:inline-flex; border:1px solid var(--border); border-radius:7px; overflow:hidden; flex:0 0 108px; background:var(--bg-surface);" role="group" aria-label="Modalità soglia">
                            <button type="button" class="thr-mode-btn" data-idx="${idx}" data-mode="pct" title="Percentuale sul target" style="flex:1; padding:6px 0; font-size:0.62rem; font-weight:800; letter-spacing:0.04em; border:none; cursor:pointer; line-height:1; ${m==='pct' ? 'background:rgba(59,130,246,0.18); color:#3b82f6;' : 'background:transparent; color:var(--text-muted);'}">% PCT</button>
                            <button type="button" class="thr-mode-btn" data-idx="${idx}" data-mode="val" title="Valore assoluto" style="flex:1; padding:6px 0; font-size:0.62rem; font-weight:800; letter-spacing:0.04em; border:none; border-left:1px solid var(--border); cursor:pointer; line-height:1; ${m==='val' ? 'background:rgba(16,185,129,0.18); color:#10b981;' : 'background:transparent; color:var(--text-muted);'}">VALORE</button>
                        </div>
                        <div style="flex:0 0 78px; display:flex; align-items:center; justify-content:center; gap:3px;">
                            <input type="number" class="thr-almost-input" data-idx="${idx}" value="${vals[0]}" min="0" step="any" style="width:62px; padding:6px 6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-weight:700; font-size:0.86rem; text-align:center; outline:none;">
                            <span class="thr-almost-unit" data-idx="${idx}" style="font-size:0.76rem; font-weight:700; color:var(--text-muted); min-width:10px; text-align:left;">${unit}</span>
                        </div>
                        <div style="flex:0 0 78px; display:flex; align-items:center; justify-content:center; gap:3px;">
                            <input type="number" class="thr-surpass-input" data-idx="${idx}" value="${vals[1]}" min="0" step="any" style="width:62px; padding:6px 6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main); font-weight:700; font-size:0.86rem; text-align:center; outline:none;">
                            <span class="thr-surpass-unit" data-idx="${idx}" style="font-size:0.76rem; font-weight:700; color:var(--text-muted); min-width:10px; text-align:left;">${unit}</span>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; padding:10px 16px; border-top:1px solid var(--border); background:var(--bg-surface); border-radius:0 0 14px 14px;">
            <button class="btn secondary" id="cancel-thr-btn" style="padding:7px 14px; font-size:0.82rem; font-weight:600; border-radius:7px; min-width:84px;">Annulla</button>
            <button class="btn primary" id="save-thr-btn" style="padding:7px 18px; font-size:0.82rem; font-weight:700; border-radius:7px; min-width:116px;">Salva Soglie</button>
        </div>
    `;

    const refreshRow = (idx) => {
        const m = modes[idx];
        const lbl = modeLabels[m];
        const vals = m === 'pct' ? pctVals[idx] : valVals[idx];
        const pctBtn = modal.querySelector(`.thr-mode-btn[data-idx="${idx}"][data-mode="pct"]`);
        const valBtn = modal.querySelector(`.thr-mode-btn[data-idx="${idx}"][data-mode="val"]`);
        const almostUnit = modal.querySelector(`.thr-almost-unit[data-idx="${idx}"]`);
        const almostInp = modal.querySelector(`.thr-almost-input[data-idx="${idx}"]`);
        const surpassUnit = modal.querySelector(`.thr-surpass-unit[data-idx="${idx}"]`);
        const surpassInp = modal.querySelector(`.thr-surpass-input[data-idx="${idx}"]`);
        if (pctBtn) {
            const isPct = m === 'pct';
            pctBtn.style.background = isPct ? 'rgba(59,130,246,0.18)' : 'transparent';
            pctBtn.style.color = isPct ? '#3b82f6' : 'var(--text-muted)';
        }
        if (valBtn) {
            const isVal = m === 'val';
            valBtn.style.background = isVal ? 'rgba(16,185,129,0.18)' : 'transparent';
            valBtn.style.color = isVal ? '#10b981' : 'var(--text-muted)';
        }
        if (almostUnit) almostUnit.textContent = lbl.unit;
        if (surpassUnit) surpassUnit.textContent = lbl.unit;
        if (almostInp) almostInp.value = vals[0];
        if (surpassInp) surpassInp.value = vals[1];
    };

    modal.querySelectorAll('.thr-mode-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const target = btn.dataset.mode;
            if (isNaN(idx) || (target !== 'pct' && target !== 'val')) return;
            if (modes[idx] === target) return;
            const cur = modes[idx];
            const almostInp = modal.querySelector(`.thr-almost-input[data-idx="${idx}"]`);
            const surpassInp = modal.querySelector(`.thr-surpass-input[data-idx="${idx}"]`);
            const store = cur === 'pct' ? pctVals[idx] : valVals[idx];
            store[0] = parseFloat(almostInp?.value) || 0;
            store[1] = parseFloat(surpassInp?.value) || 0;
            modes[idx] = target;
            refreshRow(idx);
        };
    });
    products.forEach((_, idx) => refreshRow(idx));

    const closeModal = () => {
        modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };
    modal.querySelector('#close-thr-modal').onclick = closeModal;
    modal.querySelector('#cancel-thr-btn').onclick = closeModal;
    modal.querySelector('#save-thr-btn').onclick = async () => {
        products.forEach((p, idx) => {
            const almostInp = modal.querySelector(`.thr-almost-input[data-idx="${idx}"]`);
            const surpassInp = modal.querySelector(`.thr-surpass-input[data-idx="${idx}"]`);
            if (almostInp) {
                const v = parseFloat(almostInp.value);
                if (modes[idx] === 'pct') {
                    p.almostPct = (!isNaN(v) && v > 0 && v < 100) ? v : DEFAULT_ALMOST_PCT;
                } else {
                    p.almostVal = (!isNaN(v) && v >= 0) ? v : DEFAULT_ALMOST_VAL;
                }
            }
            if (surpassInp) {
                const v = parseFloat(surpassInp.value);
                if (modes[idx] === 'pct') {
                    p.surpassPct = (!isNaN(v) && v > 100) ? v : DEFAULT_SURPASS_PCT;
                } else {
                    p.surpassVal = (!isNaN(v) && v > 0) ? v : DEFAULT_SURPASS_VAL;
                }
            }
            p.thresholdMode = modes[idx];
        });
        await appDb.setSetting(`sales_table_products_${tableId}`, products);
        closeModal();
        if (window.renderStatistics) window.renderStatistics();
    };

    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
}


