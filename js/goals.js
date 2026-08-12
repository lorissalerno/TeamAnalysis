// js/goals.js

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('add-goal-btn');
    if (addBtn) {
        addBtn.addEventListener('click', openGoalModal);
    }
    
    window.renderGoals = async function() {
        const list = document.getElementById('goals-list');
        if (!list) return;
        
        const year = window.appState.activeYear;
        const goals = await appDb.getAll('goals', 'year', year);
        
        list.innerHTML = '';
        if (goals.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted)">Nessun obiettivo impostato.</p>';
            return;
        }
        
        goals.forEach(g => {
            const card = document.createElement('div');
            card.className = 'card';
            const skillLabel = g.skill && g.skill !== 'ALL' ? `Skill: ${g.skill}` : 'Tutti gli Skill';
            const empLabel = g.employee ? ` | ${window.getDisplayName(g.employee)}` : ' (Tutto il Team)';
            card.innerHTML = `
                <h3>${g.metric}</h3>
                <p style="margin-top:8px;">Target: <strong>${g.target}</strong></p>
                <p style="font-size:0.85rem; color:var(--text-muted)">Applicato a: ${skillLabel}${empLabel}</p>
                <button class="btn secondary" style="margin-top:16px; padding:4px 8px; font-size:0.85rem;" onclick="deleteGoal('${g.id}')">Elimina</button>
            `;
            list.appendChild(card);
        });
    };
});

window.deleteGoal = async function(id) {
    const transaction = appDb._db.transaction(['goals'], 'readwrite');
    const store = transaction.objectStore('goals');
    store.delete(id);
    transaction.oncomplete = () => {
        renderGoals();
        if(window.renderStatistics) renderStatistics();
    };
}

async function openGoalModal() {
    let modal = document.getElementById('goal-config-modal');
    if (!modal) {
        modal = createGoalModalHTML();
    }
    
    // Populate metrics
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
    
    const metricSelect = document.getElementById('goal-metric');
    metricSelect.innerHTML = '';
    Array.from(metrics).sort().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        metricSelect.appendChild(opt);
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
            <select id="goal-metric" style="width:100%; padding:8px; margin-bottom:16px;"></select>
            
            <label>Target Numerico:</label>
            <input type="number" id="goal-target" style="width:100%; padding:8px; margin-bottom:16px;">
            
            <label>Skill (opzionale):</label>
            <select id="goal-skill" style="width:100%; padding:8px; margin-bottom:16px;"></select>
            
            <label>Assegna a dipendente (opzionale):</label>
            <select id="goal-employee" style="width:100%; padding:8px; margin-bottom:16px;"></select>
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
    const skill = document.getElementById('goal-skill').value;
    const employee = document.getElementById('goal-employee').value;
    
    if (isNaN(target)) {
        alert("Inserisci un target numerico valido.");
        return;
    }
    
    const newGoal = {
        id: 'goal_' + Date.now(),
        metric,
        target,
        skill,
        employee,
        year: window.appState.activeYear
    };
    
    await appDb.addMultiple('goals', [newGoal]);
    document.getElementById('goal-config-modal').classList.remove('open');
    renderGoals();
    
    // Re-render statistics to show the new goal line if it's open
    if(document.getElementById('statistics').classList.contains('active')) {
        renderStatistics();
    }
}
