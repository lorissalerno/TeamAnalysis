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
    await populateSkillsUI();

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
            if (sectionId === 'database') renderImportedData();
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
        renderImportedData();
    });

    // Year Change
    document.getElementById('active-year').addEventListener('change', async (e) => {
        window.appState.activeYear = e.target.value;
        await appDb.setSetting('activeYear', e.target.value);
        await loadAnonymousMap();
        renderDashboard();
        renderStatistics();
        renderImportedData();
    });

    // 4. Database Imports & Skills
    setupImports();

    // 5. Settings / Backup
    setupSettings();
    
    // Initial render
    renderDashboard();
    renderImportedData();
});

// --- SKILLS MANAGEMENT ---
async function getSkills() {
    const saved = await appDb.getSetting('skills', null);
    if (saved && Array.isArray(saved) && saved.length > 0) {
        return saved;
    }
    const defaults = ["Performance MyService VAS", "Performance MyService OP", "Performance Wline"];
    await appDb.setSetting('skills', defaults);
    return defaults;
}

async function saveSkills(skillsList) {
    await appDb.setSetting('skills', skillsList);
    await populateSkillsUI();
}

async function populateSkillsUI() {
    const skills = await getSkills();
    const perfSelect = document.getElementById('perf-skill-select');
    const filterSelect = document.getElementById('db-filter-skill');
    
    if (!perfSelect || !filterSelect) return;

    const currentPerf = perfSelect.value;
    const currentFilter = filterSelect.value;

    perfSelect.innerHTML = '';
    skills.forEach(skill => {
        const opt = document.createElement('option');
        opt.value = skill;
        opt.textContent = skill;
        perfSelect.appendChild(opt);
    });
    if (currentPerf && skills.includes(currentPerf)) {
        perfSelect.value = currentPerf;
    }

    filterSelect.innerHTML = `
        <option value="ALL">Tutte le fonti (Performance & Sales)</option>
        <option value="SALES">Solo Sales</option>
    `;
    skills.forEach(skill => {
        const opt = document.createElement('option');
        opt.value = skill;
        opt.textContent = `Skill: ${skill}`;
        filterSelect.appendChild(opt);
    });
    if (currentFilter) {
        filterSelect.value = currentFilter;
    }
}

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
    const addSkillBtn = document.getElementById('add-skill-btn');
    const filterSelect = document.getElementById('db-filter-skill');
    const searchInput = document.getElementById('db-search-input');
    const clearFilteredBtn = document.getElementById('clear-filtered-db-btn');

    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', async () => {
            const name = prompt("Inserisci il nome del nuovo Skill (es. Performance MyService VAS):");
            if (!name || !name.trim()) return;
            const cleanName = name.trim();
            const skills = await getSkills();
            if (!skills.includes(cleanName)) {
                skills.push(cleanName);
                await saveSkills(skills);
                document.getElementById('perf-skill-select').value = cleanName;
                logImport(`Creato nuovo skill: "${cleanName}"`);
            } else {
                alert("Questo skill esiste già!");
            }
        });
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', () => renderImportedData());
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => renderImportedData());
    }

    if (clearFilteredBtn) {
        clearFilteredBtn.addEventListener('click', async () => {
            const filterValue = document.getElementById('db-filter-skill').value;
            const activeYear = window.appState.activeYear;

            let confirmMsg = "";
            if (filterValue === 'ALL') {
                confirmMsg = `Sei sicuro di voler eliminare TUTTI i dati (Performance e Sales) per l'anno ${activeYear}?`;
            } else if (filterValue === 'SALES') {
                confirmMsg = `Sei sicuro di voler eliminare tutti i dati Sales per l'anno ${activeYear}?`;
            } else {
                confirmMsg = `Sei sicuro di voler eliminare tutti i dati della Skill "${filterValue}" per l'anno ${activeYear}?`;
            }

            if (!confirm(confirmMsg)) return;

            if (filterValue === 'ALL') {
                const perf = await appDb.getAll('performance', 'year', activeYear);
                const sales = await appDb.getAll('sales', 'year', activeYear);
                for (const r of perf) await appDb.deleteRecord('performance', r.id);
                for (const r of sales) await appDb.deleteRecord('sales', r.id);
                logImport(`Eliminati tutti i dati per l'anno ${activeYear}.`);
            } else if (filterValue === 'SALES') {
                const sales = await appDb.getAll('sales', 'year', activeYear);
                for (const r of sales) await appDb.deleteRecord('sales', r.id);
                logImport(`Eliminati tutti i dati Sales per l'anno ${activeYear}.`);
            } else {
                await appDb.deleteBySkill('performance', filterValue, activeYear);
                logImport(`Eliminati tutti i dati della Skill "${filterValue}" per l'anno ${activeYear}.`);
            }

            await refreshYearsList();
            await renderImportedData();
            if (window.renderStatistics) renderStatistics();
        });
    }

    perfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const startDate = document.getElementById('perf-date').value;
        const selectedSkill = document.getElementById('perf-skill-select').value;
        
        if (!selectedSkill) {
            alert("Seleziona o crea uno skill prima di importare i dati performance.");
            perfInput.value = '';
            return;
        }

        try {
            logImport(`Lettura ${file.name} per lo skill "${selectedSkill}"...`);
            const parsed = await CSVParser.parse(file, startDate);
            
            // Assign selected skill to all performance items
            parsed.data.forEach(d => {
                d.skill = selectedSkill;
            });

            if (startDate) {
                await appDb.deleteFromDate('performance', startDate, selectedSkill);
                logImport(`Eliminati vecchi dati performance ("${selectedSkill}") dal ${startDate} in poi.`);
            }
            
            await appDb.addMultiple('performance', parsed.data);
            logImport(`Importati ${parsed.data.length} record in Performance ("${selectedSkill}").`);
            
            // Auto-assign anon IDs for new names
            await autoAssignAnonIds(parsed.data);
            
            await refreshYearsList();
            await renderImportedData();
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
                await appDb.deleteFromDate('sales', startDate);
                logImport(`Eliminati vecchi dati sales dal ${startDate} in poi.`);
            }
            
            await appDb.addMultiple('sales', parsed.data);
            logImport(`Importati ${parsed.data.length} record in Sales.`);
            
            await autoAssignAnonIds(parsed.data);
            await refreshYearsList();
            await renderImportedData();
        } catch (err) {
            logImport(`Errore: ${err}`, true);
        }
        salesInput.value = '';
    });
}

// --- RENDER IMPORTED DATABASE DATA ---
async function renderImportedData() {
    const activeYearLabel = document.getElementById('db-active-year-label');
    const tbody = document.getElementById('db-imported-tbody');
    const badgesContainer = document.getElementById('db-summary-badges');
    
    if (!tbody || !activeYearLabel) return;

    const activeYear = window.appState.activeYear;
    activeYearLabel.textContent = `Anno attivo: ${activeYear}`;

    const perfRecords = await appDb.getAll('performance', 'year', activeYear);
    const salesRecords = await appDb.getAll('sales', 'year', activeYear);
    
    const filterValue = document.getElementById('db-filter-skill').value;
    const searchTerm = (document.getElementById('db-search-input').value || '').toLowerCase().trim();

    // Summary badges calculation
    const skillCounts = {};
    let totalPerf = 0;
    let totalSales = 0;

    perfRecords.forEach(r => {
        totalPerf++;
        const sk = r.skill || 'Performance (Generale)';
        skillCounts[sk] = (skillCounts[sk] || 0) + 1;
    });
    salesRecords.forEach(() => {
        totalSales++;
    });

    let badgesHtml = `<span style="padding:4px 10px; border-radius:12px; background:var(--secondary); font-size:0.8rem; font-weight:500;">Totale Anno: ${totalPerf + totalSales} record</span>`;
    for (const [sk, count] of Object.entries(skillCounts)) {
        badgesHtml += `<span style="padding:4px 10px; border-radius:12px; background:var(--primary); color:#fff; font-size:0.8rem; font-weight:500;">${sk}: ${count}</span>`;
    }
    if (totalSales > 0) {
        badgesHtml += `<span style="padding:4px 10px; border-radius:12px; background:#10b981; color:#fff; font-size:0.8rem; font-weight:500;">Sales: ${totalSales}</span>`;
    }
    badgesContainer.innerHTML = badgesHtml;

    // Combine records for table display
    let allRecords = [];
    
    perfRecords.forEach(r => {
        allRecords.push({
            id: r.id,
            store: 'performance',
            date: r.date,
            employee: r.employee,
            type: 'Performance',
            skill: r.skill || 'Performance (Generale)',
            data: r.data
        });
    });

    salesRecords.forEach(r => {
        allRecords.push({
            id: r.id,
            store: 'sales',
            date: r.date,
            employee: r.employee,
            type: 'Sales',
            skill: r.data.Product ? `Sales (${r.data.Product})` : 'Sales (Generale)',
            data: r.data
        });
    });

    // Apply Filter by Skill / Sales
    if (filterValue === 'SALES') {
        allRecords = allRecords.filter(r => r.store === 'sales');
    } else if (filterValue !== 'ALL') {
        allRecords = allRecords.filter(r => r.store === 'performance' && r.skill === filterValue);
    }

    // Apply Search Filter by Employee Name
    if (searchTerm) {
        allRecords = allRecords.filter(r => {
            const dispName = window.getDisplayName(r.employee).toLowerCase();
            const realName = r.employee.toLowerCase();
            return dispName.includes(searchTerm) || realName.includes(searchTerm);
        });
    }

    // Sort by date desc, then employee
    allRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.employee.localeCompare(b.employee));

    tbody.innerHTML = '';

    if (allRecords.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:32px;">Nessun dato trovato nel database per l'anno ${activeYear}.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    allRecords.forEach(r => {
        const tr = document.createElement('tr');
        const dispEmployee = window.getDisplayName(r.employee);

        const metricsStr = Object.entries(r.data)
            .map(([k, v]) => `<span style="display:inline-block; margin-right:6px; margin-bottom:3px; padding:3px 8px; background:var(--bg-base); border:1px solid var(--border); border-radius:4px; font-size:0.78rem;"><strong>${k}:</strong> ${v}</span>`)
            .join('');

        const skillBadge = r.store === 'performance' 
            ? `<span style="padding:3px 8px; border-radius:4px; background:var(--primary); color:#fff; font-size:0.75rem; font-weight:600;">${r.skill}</span>`
            : `<span style="padding:3px 8px; border-radius:4px; background:#10b981; color:#fff; font-size:0.75rem; font-weight:600;">${r.skill}</span>`;

        tr.innerHTML = `
            <td style="white-space:nowrap; font-weight:500;">${r.date || '-'}</td>
            <td><strong>${dispEmployee}</strong></td>
            <td>${skillBadge}</td>
            <td style="font-size:0.85rem;">${metricsStr}</td>
            <td style="text-align:center;">
                <button class="icon-btn delete-rec-btn" data-store="${r.store}" data-id="${r.id}" title="Elimina questo record" style="color:var(--danger, #ef4444); border-radius:4px; padding:4px;">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);

    // Attach single row delete event handlers
    tbody.querySelectorAll('.delete-rec-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const store = e.currentTarget.getAttribute('data-store');
            if (confirm("Eliminare questo singolo record dal database?")) {
                await appDb.deleteRecord(store, id);
                logImport(`Record ID ${id} eliminato.`);
                await refreshYearsList();
                await renderImportedData();
                if (window.renderStatistics) renderStatistics();
            }
        });
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
