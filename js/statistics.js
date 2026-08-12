// js/statistics.js

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

async function initTemplateControls() {
    const select = document.getElementById('stat-template-select');
    const newBtn = document.getElementById('new-template-btn');
    const renameBtn = document.getElementById('rename-template-btn');
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

    newBtn.onclick = async () => {
        const name = prompt('Nome del nuovo template:');
        if (!name || !name.trim()) return;
        const cleanName = name.trim();
        const currentTpls = await getTemplates();
        const newId = 'tpl_' + Date.now();
        currentTpls.push({ id: newId, name: cleanName });
        await appDb.setSetting('stat_templates', currentTpls);
        await appDb.setSetting('active_stat_template', newId);
        await initTemplateControls();
        await renderStatistics();
    };

    renameBtn.onclick = async () => {
        const currentTpls = await getTemplates();
        const currentId = await getActiveTemplateId();
        const target = currentTpls.find(t => t.id === currentId);
        if (!target) return;
        const newName = prompt('Nuovo nome per il template:', target.name);
        if (!newName || !newName.trim()) return;
        target.name = newName.trim();
        await appDb.setSetting('stat_templates', currentTpls);
        await initTemplateControls();
    };

    deleteBtn.onclick = async () => {
        const currentTpls = await getTemplates();
        if (currentTpls.length <= 1) {
            alert('Impossibile eliminare l\'unico template rimasto.');
            return;
        }
        const currentId = await getActiveTemplateId();
        const target = currentTpls.find(t => t.id === currentId);
        if (!target) return;

        if (!confirm(`Eliminare il template "${target.name}" e tutte le sue statistiche?`)) return;

        const allStats = await appDb.getAll('custom_stats');
        for (const s of allStats) {
            if (s.templateId === currentId || (!s.templateId && currentId === 'default')) {
                await appDb.deleteRecord('custom_stats', s.id);
            }
        }

        const remaining = currentTpls.filter(t => t.id !== currentId);
        await appDb.setSetting('stat_templates', remaining);
        await appDb.setSetting('active_stat_template', remaining[0].id);
        await initTemplateControls();
        await renderStatistics();
    };
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
    
    // Setup Individual Select change listener
    const indSelect = document.getElementById('individual-select');
    if(indSelect) {
        indSelect.addEventListener('change', renderIndividualStats);
    }

    const indAvgToggle = document.getElementById('show-team-avg-individual-toggle');
    if (indAvgToggle) {
        indAvgToggle.addEventListener('change', (e) => {
            showIndividualTeamAvg = e.target.checked;
            renderIndividualStats();
        });
    }

    const indGoalToggle = document.getElementById('show-team-goal-individual-toggle');
    if (indGoalToggle) {
        indGoalToggle.addEventListener('change', (e) => {
            showIndividualTeamGoal = e.target.checked;
            renderIndividualStats();
        });
    }

    const teamAvgToggle = document.getElementById('show-team-avg-team-toggle');
    if (teamAvgToggle) {
        teamAvgToggle.addEventListener('change', (e) => {
            showTeamAvgInTeam = e.target.checked;
            renderTeamStats();
        });
    }

    const teamGoalToggle = document.getElementById('show-team-goal-team-toggle');
    if (teamGoalToggle) {
        teamGoalToggle.addEventListener('change', (e) => {
            showTeamGoalInTeam = e.target.checked;
            renderTeamStats();
        });
    }

    // Setup Team view mode toggle
    const allBtn = document.getElementById('team-view-all-btn');
    const avgBtn = document.getElementById('team-view-avg-btn');
    if (allBtn && avgBtn) {
        allBtn.addEventListener('click', () => {
            teamViewMode = 'all';
            allBtn.classList.add('active');
            avgBtn.classList.remove('active');
            renderTeamStats();
        });
        avgBtn.addEventListener('click', () => {
            teamViewMode = 'avg';
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

        // Populate individual select
        const select = document.getElementById('individual-select');
        const currentVal = select.value;
        select.innerHTML = '<option value="">Seleziona Collaboratore...</option>';
        
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

async function openStatModal() {
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
    
    // Gather unique skills from performance
    const skills = new Set();
    perfData.forEach(d => { if (d.skill) skills.add(d.skill); });

    // 2. Show Modal
    let modal = document.getElementById('stat-config-modal');
    if (!modal) {
        modal = createStatModalHTML();
    }
    
    const metricSelect = document.getElementById('stat-metric');
    metricSelect.innerHTML = '';
    Array.from(metrics).sort().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        metricSelect.appendChild(opt);
    });

    const skillSelect = document.getElementById('stat-skill');
    skillSelect.innerHTML = '<option value="ALL">Tutte le Skill</option>';
    Array.from(skills).sort().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        skillSelect.appendChild(opt);
    });
    
    modal.classList.add('open');
}

function createStatModalHTML() {
    const html = `
    <div id="stat-config-modal" class="modal">
        <div class="modal-header">
            <h2>Nuova Statistica</h2>
            <button class="close-modal" onclick="document.getElementById('stat-config-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
            <label>Dato / Metrica:</label>
            <select id="stat-metric" style="width:100%; padding:8px; margin-bottom:16px;"></select>
            
            <label>Filtro Skill Performance (opzionale):</label>
            <select id="stat-skill" style="width:100%; padding:8px; margin-bottom:16px;"></select>

            <label>Tipo Visualizzazione:</label>
            <select id="stat-type" style="width:100%; padding:8px; margin-bottom:16px;">
                <option value="bar">Grafico a Barre</option>
                <option value="line">Grafico a Linee</option>
                <option value="table">Tabella Dati</option>
            </select>
            
            <label>Filtro Prodotto (solo per Sales, opzionale):</label>
            <input type="text" id="stat-product" placeholder="es. Multiroom Max" style="width:100%; padding:8px; margin-bottom:16px;">
        </div>
        <div class="modal-footer">
            <button class="btn primary" onclick="saveNewStat()">Salva Statistica</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    return document.getElementById('stat-config-modal');
}

async function saveNewStat() {
    const metric = document.getElementById('stat-metric').value;
    const rawKey = metric.replace('Performance: ', '').replace('Sales: ', '');
    const title = rawKey;
    const skill = document.getElementById('stat-skill').value;
    const type = document.getElementById('stat-type').value;
    const product = document.getElementById('stat-product').value;
    
    const activeTemplateId = await getActiveTemplateId();

    const newStat = {
        id: 'stat_' + Date.now(),
        title, metric, skill, type, product,
        templateId: activeTemplateId,
        year: window.appState.activeYear
    };
    
    await appDb.addMultiple('custom_stats', [newStat]);
    document.getElementById('stat-config-modal').classList.remove('open');
    renderTeamStats();
}

async function renderTeamStats() {
    const container = document.getElementById('team-stats-container');
    if (!container) return;
    container.innerHTML = '';
    
    const year = window.appState.activeYear;
    const activeTemplateId = await getActiveTemplateId();

    const allStats = await appDb.getAll('custom_stats');
    const stats = allStats.filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'));
    
    if (stats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Nessuna statistica presente in questo template. Usa il pulsante "Nuova Statistica".</p>';
        return;
    }
    
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);
    
    const teamAvgOnly = (teamViewMode === 'avg');
    
    stats.forEach(stat => {
        const card = buildStatCard(stat, perfData, salesData, goals, false, '', teamAvgOnly, showTeamAvgInTeam, showTeamGoalInTeam);
        container.appendChild(card);
    });
}

async function renderIndividualStats() {
    const container = document.getElementById('individual-stats-container');
    if (!container) return;
    const employee = document.getElementById('individual-select').value;
    
    if (!employee) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = 'Caricamento...';
    const year = window.appState.activeYear;
    const activeTemplateId = await getActiveTemplateId();

    const allStats = await appDb.getAll('custom_stats');
    const stats = allStats.filter(s => s.templateId === activeTemplateId || (!s.templateId && activeTemplateId === 'default'));

    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);
    
    container.innerHTML = '';
    if (stats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Nessuna statistica in questo template.</p>';
        return;
    }
    
    stats.forEach(stat => {
        const card = buildStatCard(stat, perfData, salesData, goals, true, employee, false, showIndividualTeamAvg, showIndividualTeamGoal);
        container.appendChild(card);
    });
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

function buildStatCard(statConfig, perfData, salesData, goals, isIndividual, employeeName = '', teamAvgOnly = false, showTeamAvg = false, showTeamGoal = false) {
    const card = document.createElement('div');
    card.className = 'card stat-card';
    card.style.position = 'relative';
    
    const isPerf = statConfig.metric.startsWith('Performance: ');
    const rawKey = statConfig.metric.replace('Performance: ', '').replace('Sales: ', '');
    
    const title = document.createElement('h3');
    title.textContent = statConfig.title || rawKey;
    title.style.marginBottom = '4px';
    card.appendChild(title);
    
    // Stat info line
    const info = document.createElement('div');
    info.className = 'stat-info';
    let infoParts = [];
    if (isPerf) {
        if (statConfig.skill && statConfig.skill !== 'ALL') {
            infoParts.push(statConfig.skill);
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

    // Search text for filtering
    card.setAttribute('data-search-text', `${title.textContent} ${infoText}`);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'position:absolute; top:16px; right:16px; display:flex; gap:6px;';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    deleteBtn.className = 'btn secondary';
    deleteBtn.style.cssText = 'padding:4px 8px; font-size:0.75rem;';
    deleteBtn.onclick = async () => {
        if (!confirm(`Eliminare la statistica "${statConfig.title}"?`)) return;
        await appDb.deleteRecord('custom_stats', statConfig.id);
        renderTeamStats();
    };
    actionsDiv.appendChild(deleteBtn);
    card.appendChild(actionsDiv);
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.marginTop = '12px';
    if (statConfig.type === 'table') {
        canvasContainer.style.height = 'auto';
        canvasContainer.style.overflowX = 'auto';
    } else {
        canvasContainer.style.height = '360px';
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
        return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    });

    if (statConfig.type === 'table') {
        if (isIndividual) {
            let html = '<table class="data-table"><thead><tr><th>Collaboratore</th>';
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
            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        } else {
            let html = '<table class="data-table"><thead><tr><th>Collaboratore</th>';
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
            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        }
    } else {
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        let datasets = [];

        // Palette sgargiante ad alto contrasto
        const PALETTE = [
            '#FF2D55', '#00E5FF', '#FFEA00', '#39FF14', '#FF6600',
            '#BF5FFF', '#FF007F', '#00FFCC', '#FFB300', '#2979FF',
            '#FF1744', '#00E676'
        ];

        const isBar = statConfig.type === 'bar';

        if (isIndividual) {
            datasets.push({
                label: employeeName ? window.getDisplayName(employeeName) : statConfig.title,
                data: dataPts,
                type: isBar ? 'bar' : 'line',
                backgroundColor: isBar ? hexToRgba('#2979FF', 0.8) : 'rgba(41, 121, 255, 0.15)',
                borderColor: '#2979FF',
                borderWidth: isBar ? 1 : 1.5,
                borderRadius: isBar ? 4 : 0,
                minBarLength: isBar ? 4 : 0,
                pointRadius: isBar ? 0 : 0,
                tension: 0.35,
                order: 2
            });

            if (showTeamAvg) {
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: 'line',
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb',
                    borderWidth: 3,
                    borderDash: [6, 4],
                    pointRadius: 4,
                    pointBackgroundColor: '#2563eb',
                    fill: false,
                    order: 1
                });
            }
        } else if (teamAvgOnly) {
            // Solo Media Team
            datasets.push({
                label: 'Media Team',
                data: teamAvgPts,
                type: isBar ? 'bar' : 'line',
                backgroundColor: isBar ? hexToRgba('#FFEA00', 0.85) : 'rgba(255, 234, 0, 0.15)',
                borderColor: '#FFEA00',
                borderWidth: isBar ? 1 : 3,
                borderRadius: isBar ? 4 : 0,
                minBarLength: isBar ? 4 : 0,
                pointRadius: isBar ? 0 : 7,
                pointHoverRadius: 10,
                pointBackgroundColor: '#FFEA00',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0.35,
                order: 1
            });
        } else {
            employees.forEach((emp, idx) => {
                const color = PALETTE[idx % PALETTE.length];
                const empPts = labels.map(date => {
                    if (!datesWithData.has(date)) return null;
                    return (empDateMap[emp] && empDateMap[emp][date] !== undefined) ? empDateMap[emp][date] : 0;
                });
                datasets.push({
                    label: window.getDisplayName(emp),
                    data: empPts,
                    type: isBar ? 'bar' : 'line',
                    backgroundColor: isBar ? hexToRgba(color, 0.82) : hexToRgba(color, 0.12),
                    borderColor: color,
                    borderWidth: isBar ? 1 : 1.5,
                    borderRadius: isBar ? 4 : 0,
                    minBarLength: isBar ? 4 : 0,
                    pointRadius: isBar ? 0 : 0,
                    tension: 0.35,
                    order: 2
                });
            });

            if (showTeamAvg) {
                datasets.push({
                    label: 'Media Team',
                    data: teamAvgPts,
                    type: 'line',
                    borderColor: '#FFEA00',
                    backgroundColor: '#FFEA00',
                    borderWidth: 3.5,
                    borderDash: [8, 4],
                    pointRadius: 7,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#FFEA00',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    order: 1
                });
            }
        }
        
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
        
        if (relevantGoal) {
            datasets.push({
                label: 'Obiettivo',
                data: labels.map(() => relevantGoal.target),
                type: 'line',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0,
                order: 0
            });

            if (relevantGoal.toleranceType && relevantGoal.toleranceType !== 'none') {
                const plus = parseFloat(relevantGoal.tolerancePlus) || 0;
                const minus = parseFloat(relevantGoal.toleranceMinus) || 0;
                let maxTarget = relevantGoal.target;
                let minTarget = relevantGoal.target;

                if (relevantGoal.toleranceType === 'numeric') {
                    maxTarget = relevantGoal.target + plus;
                    minTarget = relevantGoal.target - minus;
                } else if (relevantGoal.toleranceType === 'percentage') {
                    maxTarget = relevantGoal.target * (1 + plus / 100);
                    minTarget = relevantGoal.target * (1 - minus / 100);
                }

                if (plus > 0) {
                    datasets.push({
                        label: 'Tolleranza Max',
                        data: labels.map(() => maxTarget),
                        type: 'line',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        fill: false,
                        pointRadius: 0,
                        order: 0
                    });
                }
                if (minus > 0) {
                    datasets.push({
                        label: 'Tolleranza Min',
                        data: labels.map(() => minTarget),
                        type: 'line',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        fill: plus > 0 ? '-1' : false,
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        pointRadius: 0,
                        order: 0
                    });
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

        // Round up/down to a "nice" number respecting magnitude
        function niceRoundUp(val) {
            if (val === 0) return 0;
            const absVal = Math.abs(val);
            if (absVal >= 1) return Math.ceil(val);
            // For small decimals, round up to the next step in same order of magnitude
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
        if (allVals.length > 0) {
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

        new Chart(canvas, {
            type: isBar ? 'bar' : 'line',
            data: {
                labels: displayLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: 8,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    y: {
                        ...yScalesConfig,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.08)'
                        }
                    }
                }
            }
        });
    }
    
    return card;
}
