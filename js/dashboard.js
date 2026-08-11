// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('add-widget-btn');
    if (addBtn) {
        addBtn.addEventListener('click', openWidgetModal);
    }
    
    // Enable simple Drag and Drop on grid
    const grid = document.getElementById('dashboard-grid');
    if (grid) {
        let dragged;
        grid.addEventListener('dragstart', (e) => {
            dragged = e.target;
            e.target.style.opacity = .5;
        });
        
        grid.addEventListener('dragend', async (e) => {
            e.target.style.opacity = "";
            // Save new order
            const newOrder = Array.from(grid.children).map(c => c.getAttribute('data-id'));
            const widgets = await appDb.getAll('dashboard_widgets');
            widgets.forEach(w => {
                w.order = newOrder.indexOf(w.id);
            });
            await appDb.addMultiple('dashboard_widgets', widgets);
        });
        
        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        grid.addEventListener('dragenter', (e) => {
            if (e.target.className === 'card stat-card') {
                e.target.style.transform = 'scale(1.02)';
            }
        });
        
        grid.addEventListener('dragleave', (e) => {
            if (e.target.className === 'card stat-card') {
                e.target.style.transform = '';
            }
        });
        
        grid.addEventListener('drop', (e) => {
            e.preventDefault();
            let target = e.target.closest('.card');
            if (target && target !== dragged) {
                target.style.transform = '';
                // Swap places visually
                const all = Array.from(grid.children);
                const draggedIdx = all.indexOf(dragged);
                const targetIdx = all.indexOf(target);
                if (draggedIdx < targetIdx) {
                    target.parentNode.insertBefore(dragged, target.nextSibling);
                } else {
                    target.parentNode.insertBefore(dragged, target);
                }
            }
        });
    }
});

// We override the placeholder in app.js
window.renderDashboard = async function() {
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const year = window.appState.activeYear;
    let widgets = await appDb.getAll('dashboard_widgets');
    
    if (widgets.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Nessun widget configurato. Aggiungi un widget.</p>';
        return;
    }
    
    // Sort by order
    widgets.sort((a,b) => (a.order || 0) - (b.order || 0));
    
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);
    
    widgets.forEach(w => {
        // Reuse buildStatCard from statistics.js!
        // We need to filter data if it's individual
        let wPerf = perfData;
        let wSales = salesData;
        if (w.isIndividual && w.employee) {
            wPerf = perfData.filter(d => d.employee === w.employee);
            wSales = salesData.filter(d => d.employee === w.employee);
        }
        
        const card = buildStatCard(w, wPerf, wSales, goals, w.isIndividual, w.employee);
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-id', w.id);
        card.style.cursor = 'grab';
        
        // Add delete button
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '&times;';
        delBtn.style.position = 'absolute';
        delBtn.style.top = '16px';
        delBtn.style.right = '60px'; // Next to CSV export
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.fontSize = '1.2rem';
        delBtn.style.color = 'var(--danger)';
        delBtn.style.cursor = 'pointer';
        delBtn.onclick = async () => {
            const tx = appDb._db.transaction(['dashboard_widgets'], 'readwrite');
            tx.objectStore('dashboard_widgets').delete(w.id);
            tx.oncomplete = () => renderDashboard();
        };
        card.appendChild(delBtn);
        
        grid.appendChild(card);
    });
}

async function openWidgetModal() {
    let modal = document.getElementById('widget-config-modal');
    if (!modal) {
        modal = createWidgetModalHTML();
    }
    
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
    
    const metricSelect = document.getElementById('widget-metric');
    metricSelect.innerHTML = '';
    Array.from(metrics).sort().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        metricSelect.appendChild(opt);
    });
    
    const empSelect = document.getElementById('widget-employee');
    empSelect.innerHTML = '<option value="">Tutto il Team</option>';
    const names = Object.keys(window.appState.anonymousMap || {}).sort();
    names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = window.getDisplayName(n);
        empSelect.appendChild(opt);
    });
    
    modal.classList.add('open');
}

function createWidgetModalHTML() {
    const html = `
    <div id="widget-config-modal" class="modal">
        <div class="modal-header">
            <h2>Nuovo Widget Dashboard</h2>
            <button class="close-modal" onclick="document.getElementById('widget-config-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
            <label>Titolo:</label>
            <input type="text" id="widget-title" style="width:100%; padding:8px; margin-bottom:16px;">
            
            <label>Dato / Metrica:</label>
            <select id="widget-metric" style="width:100%; padding:8px; margin-bottom:16px;"></select>
            
            <label>Livello Dettaglio (Dipendente):</label>
            <select id="widget-employee" style="width:100%; padding:8px; margin-bottom:16px;"></select>
            
            <label>Tipo Visualizzazione:</label>
            <select id="widget-type" style="width:100%; padding:8px; margin-bottom:16px;">
                <option value="bar">Grafico a Barre</option>
                <option value="line">Grafico a Linee</option>
                <option value="table">Tabella Dati</option>
            </select>
        </div>
        <div class="modal-footer">
            <button class="btn primary" onclick="saveNewWidget()">Aggiungi Widget</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    return document.getElementById('widget-config-modal');
}

async function saveNewWidget() {
    const title = document.getElementById('widget-title').value || 'Nuovo Widget';
    const metric = document.getElementById('widget-metric').value;
    const type = document.getElementById('widget-type').value;
    const employee = document.getElementById('widget-employee').value;
    
    const widgets = await appDb.getAll('dashboard_widgets');
    
    const newWidget = {
        id: 'widget_' + Date.now(),
        title, metric, type,
        isIndividual: employee !== "",
        employee: employee,
        order: widgets.length,
        year: window.appState.activeYear
    };
    
    await appDb.addMultiple('dashboard_widgets', [newWidget]);
    document.getElementById('widget-config-modal').classList.remove('open');
    renderDashboard();
}
