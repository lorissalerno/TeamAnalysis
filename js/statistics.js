// js/statistics.js

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
    
    // We export a function to be called from app.js when year changes
    window.renderStatistics = async function() {
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
            <label>Titolo:</label>
            <input type="text" id="stat-title" style="width:100%; padding:8px; margin-bottom:16px;">
            
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
    const title = document.getElementById('stat-title').value || 'Nuova Statistica';
    const metric = document.getElementById('stat-metric').value;
    const skill = document.getElementById('stat-skill').value;
    const type = document.getElementById('stat-type').value;
    const product = document.getElementById('stat-product').value;
    
    const newStat = {
        id: 'stat_' + Date.now(),
        title, metric, skill, type, product,
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
    // According to specs, settings/templates are reused. But if we scope to year, it's easier.
    // Spec: "Le impostazioni di grafici e tabelle... restano invece disponibili come template riutilizzabile per il nuovo anno".
    // So we fetch all custom_stats regardless of year, but populate with current year's data!
    const stats = await appDb.getAll('custom_stats');
    
    if (stats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Nessuna statistica creata. Usa il pulsante in alto.</p>';
        return;
    }
    
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);
    
    stats.forEach(stat => {
        const card = buildStatCard(stat, perfData, salesData, goals, false);
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
    const stats = await appDb.getAll('custom_stats');
    const perfData = (await appDb.getAll('performance', 'year', year)).filter(d => d.employee === employee);
    const salesData = (await appDb.getAll('sales', 'year', year)).filter(d => d.employee === employee);
    const goals = await appDb.getAll('goals', 'year', year);
    
    container.innerHTML = '';
    if (stats.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Nessuna statistica creata. Creale nella tab Team prima.</p>';
        return;
    }
    
    stats.forEach(stat => {
        const card = buildStatCard(stat, perfData, salesData, goals, true, employee);
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

function buildStatCard(statConfig, perfData, salesData, goals, isIndividual, employeeName = '') {
    const card = document.createElement('div');
    card.className = 'card stat-card';
    card.style.position = 'relative';
    
    const title = document.createElement('h3');
    title.textContent = statConfig.title;
    title.style.marginBottom = '4px';
    card.appendChild(title);
    
    // Stat info line
    const info = document.createElement('div');
    info.className = 'stat-info';
    const isPerf = statConfig.metric.startsWith('Performance: ');
    const rawKey = statConfig.metric.replace('Performance: ', '').replace('Sales: ', '');
    let infoText = `${statConfig.metric}`;
    if (isPerf && statConfig.skill && statConfig.skill !== 'ALL') {
        infoText += ` · ${statConfig.skill}`;
    }
    if (!isPerf && statConfig.product) {
        infoText += ` · ${statConfig.product}`;
    }
    const typeLabels = { bar: 'Barre', line: 'Linee', table: 'Tabella' };
    infoText += ` · ${typeLabels[statConfig.type] || statConfig.type}`;
    info.textContent = infoText;
    card.appendChild(info);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'position:absolute; top:16px; right:16px; display:flex; gap:6px;';
    
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📥 CSV';
    exportBtn.className = 'btn secondary';
    exportBtn.style.cssText = 'padding:4px 10px; font-size:0.75rem;';
    actionsDiv.appendChild(exportBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑';
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
    
    const datesSet = new Set();
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
        if (isIndividual && employeeName) {
            return (empDateMap[employeeName] && empDateMap[employeeName][l] !== undefined) ? empDateMap[employeeName][l] : 0;
        }
        return aggregatedByDate[l] || 0;
    });

    // Compute team average for each date
    const teamAvgPts = labels.map(date => {
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
    
    exportBtn.onclick = () => {
        let csv = '';
        if (isIndividual) {
            csv = 'Mese,Valore\n';
            displayLabels.forEach((l, idx) => {
                csv += `"${l}",${dataPts[idx]}\n`;
            });
        } else {
            csv = 'Collaboratore,' + displayLabels.map(l => `"${l}"`).join(',') + '\n';
            employees.forEach(emp => {
                const dispName = window.getDisplayName(emp);
                const rowVals = labels.map(date => (empDateMap[emp] && empDateMap[emp][date] !== undefined) ? empDateMap[emp][date] : 0);
                csv += `"${dispName}",${rowVals.join(',')}\n`;
            });
            csv += `"Media Team",${teamAvgPts.join(',')}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = statConfig.title.replace(/\s/g, '_') + '.csv';
        a.click();
    };
    
    if (statConfig.type === 'table') {
        if (isIndividual) {
            let html = '<table class="data-table"><thead><tr><th>Mese</th><th>Valore</th></tr></thead><tbody>';
            displayLabels.forEach((l, idx) => {
                html += `<tr><td>${l}</td><td>${dataPts[idx]}</td></tr>`;
            });
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
                    const val = (empDateMap[emp] && empDateMap[emp][date] !== undefined) ? empDateMap[emp][date] : 0;
                    html += `<td style="text-align:center;">${val}</td>`;
                });
                html += '</tr>';
            });

            html += '<tr style="font-weight:700; background: rgba(127,127,127,0.1); border-top: 2px solid var(--border);">';
            html += `<td>Media Team</td>`;
            labels.forEach((date, idx) => {
                html += `<td style="text-align:center; color: var(--primary);">${teamAvgPts[idx]}</td>`;
            });
            html += '</tr>';
            html += '</tbody></table>';
            canvasContainer.innerHTML = html;
        }
    } else {
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        let datasets = [];

        const PALETTE = [
            '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
            '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6', 
            '#e11d48', '#a855f7'
        ];

        const isBar = statConfig.type === 'bar';

        if (isIndividual) {
            datasets.push({
                label: employeeName ? window.getDisplayName(employeeName) : statConfig.title,
                data: dataPts,
                backgroundColor: isBar ? hexToRgba('#3b82f6', 0.75) : 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3b82f6',
                borderWidth: isBar ? 1 : 2,
                borderRadius: isBar ? 4 : 0,
                tension: 0.3
            });
        } else {
            employees.forEach((emp, idx) => {
                const color = PALETTE[idx % PALETTE.length];
                const empPts = labels.map(date => (empDateMap[emp] && empDateMap[emp][date] !== undefined) ? empDateMap[emp][date] : 0);
                datasets.push({
                    label: window.getDisplayName(emp),
                    data: empPts,
                    backgroundColor: isBar ? hexToRgba(color, 0.75) : hexToRgba(color, 0.2),
                    borderColor: color,
                    borderWidth: isBar ? 1 : 2,
                    borderRadius: isBar ? 4 : 0,
                    tension: 0.3
                });
            });

            datasets.push({
                label: 'Media Team',
                data: teamAvgPts,
                type: 'line',
                borderColor: '#00f2fe',
                backgroundColor: '#00f2fe',
                borderWidth: 3,
                borderDash: [6, 4],
                pointRadius: 4,
                pointBackgroundColor: '#00f2fe',
                fill: false,
                order: -1
            });
        }
        
        // Check for goals
        let relevantGoal = null;
        if (isIndividual) {
            relevantGoal = goals.find(g => g.metric === statConfig.metric && (g.employee === employeeName || !g.employee));
        } else {
            relevantGoal = goals.find(g => g.metric === statConfig.metric && !g.employee);
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
                order: -2
            });
        }
        
        new Chart(canvas, {
            type: statConfig.type,
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
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    return card;
}
