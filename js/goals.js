// js/goals.js

let editingGoalId = null;

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
            const skillLabel = g.skill && g.skill !== 'ALL' ? `Skill: ${g.skill}` : 'Tutti gli Skill';
            const empLabel = g.employee ? ` | ${window.getDisplayName(g.employee)}` : ' (Tutto il Team)';
            
            let toleranceHtml = '';
            if (g.toleranceType && g.toleranceType !== 'none') {
                const plus = parseFloat(g.tolerancePlus) || 0;
                const minus = parseFloat(g.toleranceMinus) || 0;
                if (g.toleranceType === 'numeric') {
                    const minVal = g.target - minus;
                    const maxVal = g.target + plus;
                    toleranceHtml = `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">Tolleranza: +${plus} / -${minus} (Range: ${minVal} - ${maxVal})</p>`;
                } else if (g.toleranceType === 'percentage') {
                    const minVal = (g.target * (1 - minus / 100)).toFixed(2);
                    const maxVal = (g.target * (1 + plus / 100)).toFixed(2);
                    toleranceHtml = `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">Tolleranza: +${plus}% / -${minus}% (Range: ${minVal} - ${maxVal})</p>`;
                }
            }

            card.innerHTML = `
                <h3>${g.metric}</h3>
                <p style="margin-top:8px;">Target: <strong>${g.target}</strong></p>
                ${toleranceHtml}
                <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">Applicato a: ${skillLabel}${empLabel}</p>
                <div style="margin-top:16px; display:flex; gap:8px;">
                    <button class="btn secondary" style="padding:4px 10px; font-size:0.85rem;" onclick="openGoalModal('${g.id}')">Modifica</button>
                    <button class="btn secondary" style="padding:4px 10px; font-size:0.85rem;" onclick="deleteGoal('${g.id}')">Elimina</button>
                </div>
            `;
            list.appendChild(card);
        });
    };
});

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
    const metricSelect = document.getElementById('goal-metric');
    
    function populateMetricOptions(filterText = '') {
        const selectedVal = metricSelect.value;
        metricSelect.innerHTML = '';
        const query = filterText.toLowerCase().trim();
        allMetrics.forEach(m => {
            if (!query || m.toLowerCase().includes(query)) {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                metricSelect.appendChild(opt);
            }
        });
        if (selectedVal && Array.from(metricSelect.options).some(o => o.value === selectedVal)) {
            metricSelect.value = selectedVal;
        } else if (metricSelect.options.length > 0) {
            metricSelect.options[0].selected = true;
        }
    }
    
    metricSearchInput.value = '';
    populateMetricOptions('');
    metricSearchInput.oninput = (e) => populateMetricOptions(e.target.value);

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

    // Tolerance field toggle logic
    const toleranceTypeSelect = document.getElementById('goal-tolerance-type');
    const toleranceContainer = document.getElementById('tolerance-fields-container');
    const tolerancePlusInput = document.getElementById('goal-tolerance-plus');
    const toleranceMinusInput = document.getElementById('goal-tolerance-minus');

    const updateToleranceDisplay = () => {
        const type = toleranceTypeSelect.value;
        if (type === 'none') {
            toleranceContainer.style.display = 'none';
        } else {
            toleranceContainer.style.display = 'flex';
            const plusLabel = document.getElementById('tolerance-plus-label');
            const minusLabel = document.getElementById('tolerance-minus-label');
            if (type === 'percentage') {
                if (plusLabel) plusLabel.textContent = 'Tolleranza + (%)';
                if (minusLabel) minusLabel.textContent = 'Tolleranza - (%)';
            } else {
                if (plusLabel) plusLabel.textContent = 'Tolleranza + (Valore)';
                if (minusLabel) minusLabel.textContent = 'Tolleranza - (Valore)';
            }
        }
    };
    toleranceTypeSelect.onchange = updateToleranceDisplay;

    // Load existing goal values if editing
    if (editingGoalId) {
        const goals = await appDb.getAll('goals', 'year', year);
        const existing = goals.find(g => g.id === editingGoalId);
        if (existing) {
            populateMetricOptions('');
            metricSelect.value = existing.metric || '';
            document.getElementById('goal-target').value = existing.target ?? '';
            skillSelect.value = existing.skill || 'ALL';
            empSelect.value = existing.employee || '';
            toleranceTypeSelect.value = existing.toleranceType || 'none';
            tolerancePlusInput.value = existing.tolerancePlus ?? 0;
            toleranceMinusInput.value = existing.toleranceMinus ?? 0;
        }
    } else {
        document.getElementById('goal-target').value = '';
        skillSelect.value = 'ALL';
        empSelect.value = '';
        toleranceTypeSelect.value = 'none';
        tolerancePlusInput.value = 0;
        toleranceMinusInput.value = 0;
    }

    updateToleranceDisplay();
    modal.classList.add('open');
}

function createGoalModalHTML() {
    const html = `
    <div id="goal-config-modal" class="modal">
        <div class="modal-header">
            <h2>Nuovo Obiettivo</h2>
            <button class="close-modal" onclick="document.getElementById('goal-config-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
            <label>Cerca Dato / Metrica:</label>
            <input type="text" id="goal-metric-search" placeholder="Filtra metriche in tempo reale..." style="width:100%; padding:8px; margin-bottom:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
            
            <label>Dato / Metrica:</label>
            <select id="goal-metric" size="5" style="width:100%; padding:8px; margin-bottom:16px; min-height:110px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);"></select>
            
            <label>Target Numerico:</label>
            <input type="number" step="any" id="goal-target" style="width:100%; padding:8px; margin-bottom:16px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
            
            <label>Tipo Tolleranza:</label>
            <select id="goal-tolerance-type" style="width:100%; padding:8px; margin-bottom:16px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
                <option value="none">Nessuna Tolleranza</option>
                <option value="numeric">Numerica (Valore Assoluto)</option>
                <option value="percentage">Percentuale (%)</option>
            </select>
            
            <div id="tolerance-fields-container" style="display:none; gap:12px; margin-bottom:16px;">
                <div style="flex:1;">
                    <label id="tolerance-plus-label">Tolleranza + (Valore):</label>
                    <input type="number" step="any" id="goal-tolerance-plus" value="0" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
                </div>
                <div style="flex:1;">
                    <label id="tolerance-minus-label">Tolleranza - (Valore):</label>
                    <input type="number" step="any" id="goal-tolerance-minus" value="0" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);">
                </div>
            </div>

            <label>Skill (opzionale):</label>
            <select id="goal-skill" style="width:100%; padding:8px; margin-bottom:16px; border-radius:6px; border:1px solid var(--border); background:var(--bg-base); color:var(--text-main);"></select>
            
            <label>Assegna a dipendente (opzionale):</label>
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
    const toleranceType = document.getElementById('goal-tolerance-type').value;
    const tolerancePlus = parseFloat(document.getElementById('goal-tolerance-plus').value) || 0;
    const toleranceMinus = parseFloat(document.getElementById('goal-tolerance-minus').value) || 0;
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
    editingGoalId = null;
    renderGoals();
    
    // Re-render statistics to show the new goal line if it's open
    if (document.getElementById('statistics').classList.contains('active') && window.renderStatistics) {
        renderStatistics();
    }
}
