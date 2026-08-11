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
        // For sales, metrics are properties in data, but also product based. Let's just use properties.
        Object.keys(d.data).forEach(k => {
            if(k !== 'Product') metrics.add(`Sales: ${k}`);
        });
    });
    
    // 2. Show Modal (we will dynamically create or use an existing one in HTML)
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
    const type = document.getElementById('stat-type').value;
    const product = document.getElementById('stat-product').value;
    
    const newStat = {
        id: 'stat_' + Date.now(),
        title, metric, type, product,
        year: window.appState.activeYear // save as a template for this year
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

function buildStatCard(statConfig, perfData, salesData, goals, isIndividual, employeeName = '') {
    const card = document.createElement('div');
    card.className = 'card stat-card';
    card.style.position = 'relative';
    
    const title = document.createElement('h3');
    title.textContent = statConfig.title;
    title.style.marginBottom = '16px';
    card.appendChild(title);
    
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'CSV';
    exportBtn.className = 'btn secondary';
    exportBtn.style.position = 'absolute';
    exportBtn.style.top = '16px';
    exportBtn.style.right = '16px';
    exportBtn.style.padding = '4px 8px';
    exportBtn.style.fontSize = '0.75rem';
    
    card.appendChild(exportBtn);
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.height = '250px';
    card.appendChild(canvasContainer);
    
    // Process Data
    const isPerf = statConfig.metric.startsWith('Performance: ');
    const rawKey = statConfig.metric.replace('Performance: ', '').replace('Sales: ', '');
    const sourceData = isPerf ? perfData : salesData;
    
    // Aggregate by date (month/week)
    const aggregated = {};
    sourceData.forEach(row => {
        if (!isPerf && statConfig.product) {
            if (row.data['Product'] !== statConfig.product) return;
        }
        
        const date = row.date;
        const val = row.data[rawKey] || 0;
        if (!aggregated[date]) aggregated[date] = 0;
        aggregated[date] += val;
    });
    
    const labels = Object.keys(aggregated).sort();
    const dataPts = labels.map(l => aggregated[l]);
    
    exportBtn.onclick = () => {
        let csv = 'Data,' + statConfig.title + '\n';
        labels.forEach((l, idx) => csv += `${l},${dataPts[idx]}\n`);
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = statConfig.title.replace(/\s/g, '_') + '.csv';
        a.click();
    };
    
    if (statConfig.type === 'table') {
        let html = '<table class="data-table"><thead><tr><th>Data</th><th>Valore</th></tr></thead><tbody>';
        labels.forEach((l, idx) => {
            html += `<tr><td>${l}</td><td>${dataPts[idx]}</td></tr>`;
        });
        html += '</tbody></table>';
        canvasContainer.innerHTML = html;
        canvasContainer.style.overflowY = 'auto';
    } else {
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        let datasets = [{
            label: statConfig.title,
            data: dataPts,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            tension: 0.3
        }];
        
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
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            });
        }
        
        new Chart(canvas, {
            type: statConfig.type,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    return card;
}
