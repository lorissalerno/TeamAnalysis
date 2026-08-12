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

            card.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 20px; flex-wrap:wrap;';

            card.innerHTML = `
                <!-- Sinistra: Titolo + Badge -->
                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:280px; flex-wrap:wrap;">
                    <h3 style="font-size:0.95rem; font-weight:700; color:var(--text-main); margin:0; line-height:1.3;">
                        ${g.metric}
                    </h3>
                    <span style="font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:12px; background:rgba(99,102,241,0.15); color:var(--primary, #6366f1); border:1px solid rgba(99,102,241,0.25); white-space:nowrap;">
                        Skill: ${skillText}
                    </span>
                    <span style="font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:12px; background:var(--bg-alt, rgba(255,255,255,0.05)); color:var(--text-muted); border:1px solid var(--border, rgba(255,255,255,0.1)); white-space:nowrap;">
                        ${empText}
                    </span>
                </div>

                <!-- Centro: Target & Range -->
                <div style="display:flex; align-items:center; gap:16px; flex-shrink:0;">
                    <div style="display:flex; align-items:baseline; gap:6px;">
                        <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">Target</span>
                        <span style="font-size:1.15rem; font-weight:800; color:var(--primary, #6366f1); font-family:monospace;">${g.target}</span>
                    </div>

                    ${minVal !== null ? `
                    <div style="display:flex; align-items:baseline; gap:6px; background:var(--bg-alt, rgba(255,255,255,0.03)); border:1px solid var(--border, rgba(255,255,255,0.08)); border-radius:6px; padding:4px 10px;">
                        <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">Range</span>
                        <span style="font-size:0.9rem; font-weight:700; color:var(--text-main); font-family:monospace;">${minVal} – ${maxVal}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">(${tolLabel})</span>
                    </div>
                    ` : ''}
                </div>

                <!-- Destra: Pulsanti -->
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    <button class="btn secondary" style="padding:4px 12px; font-size:0.8rem;" onclick="openGoalModal('${g.id}')">Modifica</button>
                    <button class="btn secondary" style="padding:4px 12px; font-size:0.8rem; color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="deleteGoal('${g.id}')">Elimina</button>
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
}

function createGoalModalHTML() {
    const html = `
    <div id="goal-config-modal" class="modal">
        <div class="modal-header">
            <h2>Nuovo Obiettivo</h2>
            <button class="close-modal" onclick="document.getElementById('goal-config-modal').classList.remove('open')">&times;</button>
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
    editingGoalId = null;
    renderGoals();
    
    // Re-render statistics to show the new goal line if it's open
    if (document.getElementById('statistics').classList.contains('active') && window.renderStatistics) {
        renderStatistics();
    }
}
