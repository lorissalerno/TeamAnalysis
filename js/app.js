/**
 * TeamAnalysis - By Loris Salerno (taasalo3) - Loris.Salerno@swisscom.com
 */
window.getAuthorInfo = function() {
    return {
        author: "Loris Salerno",
        sigla: "taasalo3",
        email: "Loris.Salerno@swisscom.com"
    };
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize DB
    try {
        await appDb.init();
    } catch (e) {
        alert("Errore caricamento Database: " + e);
        return;
    }

    // 2. Global State
    window.appState = {
        isAnonymous: false,
        activeYear: new Date().getFullYear().toString(),
        anonymousMap: {} // { "Loris Salerno": 1, ... }
    };

    // Load Settings
    const savedTheme = await appDb.getSetting('theme', 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedAnon = await appDb.getSetting('isAnonymous', false);
    document.getElementById('anon-toggle').checked = savedAnon;
    window.appState.isAnonymous = savedAnon;

    const savedYear = await appDb.getSetting('activeYear', window.appState.activeYear);
    window.appState.activeYear = savedYear;

    await refreshYearsList();
    await loadAnonymousMap();

    // 3. Navigation
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
            document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
            
            e.target.classList.add('active');
            const sectionId = e.target.getAttribute('data-section');
            document.getElementById(sectionId).classList.add('active');
            
            // Trigger specific section render if needed
            if (sectionId === 'statistics') renderStatistics();
            if (sectionId === 'dashboard') renderDashboard();
            if (sectionId === 'goals' && window.renderGoals) renderGoals();
        });
    });

    // Sub-navigation tabs (Statistics)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.parentElement.parentElement.parentElement.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(e.target.getAttribute('data-target')).classList.add('active');
        });
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', async () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        await appDb.setSetting('theme', next);
    });

    // Anon Toggle
    document.getElementById('anon-toggle').addEventListener('change', async (e) => {
        window.appState.isAnonymous = e.target.checked;
        await appDb.setSetting('isAnonymous', e.target.checked);
        // Refresh views
        renderDashboard();
        renderStatistics();
    });

    // Year Change
    document.getElementById('active-year').addEventListener('change', async (e) => {
        window.appState.activeYear = e.target.value;
        await appDb.setSetting('activeYear', e.target.value);
        await loadAnonymousMap();
        renderDashboard();
        renderStatistics();
    });

    // 4. Database Imports
    setupImports();

    // 5. Settings / Backup
    setupSettings();
    
    // Initial render
    renderDashboard();
});

// --- STATE MANAGEMENT ---
async function refreshYearsList() {
    // Get unique years from performance and sales
    const perf = await appDb.getAll('performance');
    const sales = await appDb.getAll('sales');
    const years = new Set([new Date().getFullYear().toString()]);
    
    perf.forEach(p => years.add(p.year));
    sales.forEach(s => years.add(s.year));
    
    const select = document.getElementById('active-year');
    select.innerHTML = '';
    
    Array.from(years).sort().reverse().forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === window.appState.activeYear) opt.selected = true;
        select.appendChild(opt);
    });
}

async function loadAnonymousMap() {
    const mappings = await appDb.getAll('anonymous_map', 'year', window.appState.activeYear);
    window.appState.anonymousMap = {};
    mappings.forEach(m => {
        window.appState.anonymousMap[m.realName] = m.anonId;
    });
}

window.getDisplayName = function(realName) {
    if (!window.appState.isAnonymous) return realName;
    const id = window.appState.anonymousMap[realName];
    return id ? `Collaboratore ${id}` : realName;
};

// --- IMPORT CSV ---
function logImport(msg, isError = false) {
    const log = document.getElementById('import-log');
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    if (isError) div.style.color = 'var(--danger)';
    log.prepend(div);
}

function setupImports() {
    const perfInput = document.getElementById('perf-file');
    const salesInput = document.getElementById('sales-file');

    perfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const startDate = document.getElementById('perf-date').value;
        
        try {
            logImport(`Lettura ${file.name}...`);
            const parsed = await CSVParser.parse(file, startDate);
            
            if (startDate) {
                await appDb.deleteFromDate('performance', startDate);
                logImport(`Eliminati vecchi dati performance dal ${startDate} in poi.`);
            }
            
            await appDb.addMultiple('performance', parsed.data);
            logImport(`Importati ${parsed.data.length} record in Performance.`);
            
            // Auto-assign anon IDs for new names
            await autoAssignAnonIds(parsed.data);
            
            await refreshYearsList();
        } catch (err) {
            logImport(`Errore: ${err}`, true);
        }
        perfInput.value = '';
    });

    salesInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const startDate = document.getElementById('sales-date').value;
        
        try {
            logImport(`Lettura ${file.name}...`);
            const parsed = await CSVParser.parse(file, startDate);
            
            if (startDate) {
                // If we know which subset of sales we are replacing, it's better.
                // For now, simple replace all sales >= startDate
                await appDb.deleteFromDate('sales', startDate);
                logImport(`Eliminati vecchi dati sales dal ${startDate} in poi.`);
            }
            
            await appDb.addMultiple('sales', parsed.data);
            logImport(`Importati ${parsed.data.length} record in Sales.`);
            
            await autoAssignAnonIds(parsed.data);
            await refreshYearsList();
        } catch (err) {
            logImport(`Errore: ${err}`, true);
        }
        salesInput.value = '';
    });
}

// Ensure every name has an ID in the current year
async function autoAssignAnonIds(dataList) {
    const yearNames = {};
    dataList.forEach(d => {
        if (!yearNames[d.year]) yearNames[d.year] = new Set();
        yearNames[d.year].add(d.employee);
    });
    
    for (const year in yearNames) {
        const existing = await appDb.getAll('anonymous_map', 'year', year);
        const existingNames = new Set(existing.map(e => e.realName));
        const maxId = existing.reduce((max, e) => Math.max(max, parseInt(e.anonId) || 0), 0);
        
        let nextId = maxId + 1;
        const newRecords = [];
        
        // Sort names alphabetically as requested by default
        const sortedNames = Array.from(yearNames[year]).sort();
        
        sortedNames.forEach(name => {
            if (!existingNames.has(name)) {
                newRecords.push({ year, realName: name, anonId: nextId });
                if (year === window.appState.activeYear) {
                    window.appState.anonymousMap[name] = nextId;
                }
                nextId++;
            }
        });
        
        if (newRecords.length > 0) {
            await appDb.addMultiple('anonymous_map', newRecords);
        }
    }
}

// --- SETTINGS ---
function setupSettings() {
    const manageBtn = document.getElementById('manage-mapping-btn');
    const modal = document.getElementById('mapping-modal');
    const closeBtn = document.querySelector('.close-modal');
    const saveBtn = document.getElementById('save-mapping-btn');
    
    manageBtn.addEventListener('click', async () => {
        const tbody = document.querySelector('#mapping-table tbody');
        tbody.innerHTML = '';
        
        const mappings = await appDb.getAll('anonymous_map', 'year', window.appState.activeYear);
        mappings.sort((a,b) => a.realName.localeCompare(b.realName)).forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.realName}</td>
                <td><input type="number" class="anon-id-input" data-id="${m.id}" value="${m.anonId}"></td>
            `;
            tbody.appendChild(tr);
        });
        
        modal.classList.add('open');
    });
    
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    
    saveBtn.addEventListener('click', async () => {
        const inputs = document.querySelectorAll('.anon-id-input');
        const updates = [];
        // To update, we must get the object, modify it, and put it back.
        // It's faster to recreate the store or use a cursor, but we can do simple gets.
        // For simplicity, let's just do it directly.
        const transaction = appDb._db.transaction(['anonymous_map'], 'readwrite');
        const store = transaction.objectStore('anonymous_map');
        
        inputs.forEach(input => {
            const req = store.get(parseInt(input.getAttribute('data-id')));
            req.onsuccess = () => {
                const data = req.result;
                data.anonId = parseInt(input.value);
                store.put(data);
                if (data.year === window.appState.activeYear) {
                    window.appState.anonymousMap[data.realName] = data.anonId;
                }
            };
        });
        
        transaction.oncomplete = () => {
            modal.classList.remove('open');
            renderDashboard();
            renderStatistics();
        };
    });
    
    // Backup Export
    document.getElementById('export-backup-btn').addEventListener('click', async () => {
        const json = await appDb.exportJSON();
        const blob = new Blob([json], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TeamAnalysis_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    });
    
    // Backup Import
    document.getElementById('import-backup-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                await appDb.importJSON(ev.target.result);
                alert('Backup ripristinato con successo!');
                location.reload();
            } catch (err) {
                alert('Errore ripristino backup: ' + err);
            }
        };
        reader.readAsText(file);
    });
}

// --- RENDERING (Placeholders) ---
function renderDashboard() {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = '<p style="color:var(--text-muted)">Nessun widget configurato. Aggiungi un widget.</p>';
}

function renderStatistics() {
    // Populate individual select
    const select = document.getElementById('individual-select');
    select.innerHTML = '<option value="">Seleziona Collaboratore...</option>';
    
    const names = Object.keys(window.appState.anonymousMap).sort();
    names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = window.getDisplayName(name); // Don't use anon for individual as per specs?
        // Wait, spec says: "eccetto la sotto-sezione "Individuale" di Statistiche"
        // So in Individuale, we ALWAYS show real names? Or do we?
        // "Modalità Nominativo / Anonimo ... Interruttore presente in tutte le sezioni, eccetto la sotto-sezione "Individuale" di Statistiche"
        // This means Individual section doesn't have the toggle, or ignores it. We will always show real name there.
        opt.textContent = name; 
        select.appendChild(opt);
    });
}
