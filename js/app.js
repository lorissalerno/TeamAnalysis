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
    setupCustomMonthSelects();
    setupManualDataModalListeners();

    // 3. Navigation
    async function navigateToSection(sectionId) {
        if (!sectionId || !document.getElementById(sectionId)) {
            sectionId = 'dashboard';
        }
        
        document.querySelectorAll('.nav-links a').forEach(a => {
            if (a.getAttribute('data-section') === sectionId) {
                a.classList.add('active');
            } else {
                a.classList.remove('active');
            }
        });

        document.querySelectorAll('.page-section').forEach(s => {
            if (s.id === sectionId) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });

        window.location.hash = sectionId;
        await appDb.setSetting('last_active_section', sectionId);

        // Trigger specific section render if needed
        if (sectionId === 'statistics' && window.renderStatistics) renderStatistics();
        if (sectionId === 'dashboard' && window.renderDashboard) window.renderDashboard();
        if (sectionId === 'database') renderImportedData();
        if (sectionId === 'goals' && window.renderGoals) renderGoals();
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            navigateToSection(sectionId);
        });
    });

    // Sub-navigation tabs (Statistics)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.tab-btn');
            if (!tabBtn) return;
            const targetId = tabBtn.getAttribute('data-target');
            if (!targetId) return;

            const parentContainer = tabBtn.parentElement;
            if (parentContainer) parentContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            
            const targetEl = document.getElementById(targetId);
            if (targetEl && targetEl.parentElement) {
                targetEl.parentElement.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                targetEl.classList.add('active');
            }
            tabBtn.classList.add('active');
        });
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', async () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        await appDb.setSetting('theme', next);
    });

    // Sidebar Toggle
    const sidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const savedSidebarCollapsed = await appDb.getSetting('sidebar_collapsed', false);

    if (savedSidebarCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
        if (sidebarToggleBtn) sidebarToggleBtn.title = "Espandi Menu";
    }

    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', async () => {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            sidebarToggleBtn.title = isCollapsed ? "Espandi Menu" : "Comprimi Menu";
            await appDb.setSetting('sidebar_collapsed', isCollapsed);
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 260);
        });
    }

    // Anon Toggle
    document.getElementById('anon-toggle').addEventListener('change', async (e) => {
        window.appState.isAnonymous = e.target.checked;
        await appDb.setSetting('isAnonymous', e.target.checked);
        // Refresh views
        if (window.renderDashboard) window.renderDashboard();
        if (window.renderStatistics) renderStatistics();
        renderImportedData();
    });

    // Year Change
    document.getElementById('active-year').addEventListener('change', async (e) => {
        window.appState.activeYear = e.target.value;
        await appDb.setSetting('activeYear', e.target.value);
        await loadAnonymousMap();
        if (window.renderDashboard) window.renderDashboard();
        if (window.renderStatistics) renderStatistics();
        renderImportedData();
    });

    // 4. Database Imports & Skills
    setupImports();

    // 5. Settings / Backup
    setupSettings();
    
    // Restore active section on page reload
    const hashSection = window.location.hash.replace('#', '');
    const savedSection = await appDb.getSetting('last_active_section', 'dashboard');
    const initialSection = hashSection || savedSection || 'dashboard';

    await navigateToSection(initialSection);
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
    return id ? `${id}` : realName;
};

// --- IMPORT CSV ---
function logImport(msg, isError = false) {
    const liveLogs = document.getElementById('wizard-live-logs');
    const oldLog = document.getElementById('import-log');
    const timeStr = new Date().toLocaleTimeString();
    
    const div = document.createElement('div');
    div.textContent = `[${timeStr}] ${msg}`;
    if (isError) div.style.color = 'var(--danger, #ef4444)';

    if (liveLogs) {
        if (liveLogs.children.length === 1 && liveLogs.children[0].textContent.includes('Nessuna operazione')) {
            liveLogs.innerHTML = '';
        }
        liveLogs.prepend(div.cloneNode(true));
    }
    if (oldLog) {
        oldLog.prepend(div.cloneNode(true));
    }

    if (window.appDb && window.appDb.addImportLog) {
        window.appDb.addImportLog(`[${timeStr}] ${msg}`, isError).catch(() => {});
    }
}

function setupImports() {
    const perfInput = document.getElementById('perf-file');
    const salesInput = document.getElementById('sales-file');
    const addSkillBtn = document.getElementById('add-skill-btn');
    const filterSelect = document.getElementById('db-filter-skill');
    const searchInput = document.getElementById('db-search-input');
    const clearFilteredBtn = document.getElementById('clear-filtered-db-btn');

    setupSkillsModal();
    setupImportWizard();
    setupLogHistoryModal();

    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', async () => {
            const name = prompt("Inserisci il nome del nuovo Skill (es. Performance MyService VAS):");
            if (!name || !name.trim()) return;
            const cleanName = name.trim();
            const skills = await getSkills();
            if (!skills.includes(cleanName)) {
                skills.push(cleanName);
                await saveSkills(skills);
                const perfSel = document.getElementById('perf-skill-select') || document.getElementById('wizard-perf-skill-select');
                if (perfSel) perfSel.value = cleanName;
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

    if (perfInput) {
        perfInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const monthVal = document.getElementById('perf-date') ? document.getElementById('perf-date').value : '';
            const startDate = monthVal ? `${window.appState.activeYear}-${monthVal}-01` : null;
            const selectedSkill = document.getElementById('perf-skill-select') ? document.getElementById('perf-skill-select').value : '';
            
            if (!selectedSkill) {
                alert("Seleziona o crea uno skill prima di importare i dati performance.");
                perfInput.value = '';
                return;
            }

            try {
                logImport(`Lettura ${file.name} per lo skill "${selectedSkill}"...`);
                const parsed = await CSVParser.parse(file, startDate);
                parsed.data.forEach(d => { d.skill = selectedSkill; });

                if (startDate) {
                    await appDb.deleteFromDate('performance', startDate, selectedSkill);
                    logImport(`Eliminati vecchi dati performance ("${selectedSkill}") da ${monthVal}/${window.appState.activeYear} in poi.`);
                }
                
                await appDb.addMultiple('performance', parsed.data);
                logImport(`Importati ${parsed.data.length} record in Performance ("${selectedSkill}").`);
                await autoAssignAnonIds(parsed.data);
                await refreshYearsList();
                await renderImportedData();
            } catch (err) {
                logImport(`Errore: ${err}`, true);
            }
            perfInput.value = '';
        });
    }

    if (salesInput) {
        salesInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const monthVal = document.getElementById('sales-date') ? document.getElementById('sales-date').value : '';
            const startDate = monthVal ? `${window.appState.activeYear}-${monthVal}-01` : null;
            
            try {
                logImport(`Lettura ${file.name}...`);
                const parsed = await CSVParser.parse(file, startDate);
                
                if (startDate) {
                    await appDb.deleteFromDate('sales', startDate);
                    logImport(`Eliminati vecchi dati sales da ${monthVal}/${window.appState.activeYear} in poi.`);
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
}

// --- SKILLS MANAGEMENT MODAL ---
function setupSkillsModal() {
    const editSkillsBtn = document.getElementById('edit-skills-btn');
    const skillsModal = document.getElementById('skills-modal');
    const closeSkillsModal = document.getElementById('close-skills-modal');
    const saveSkillsModalBtn = document.getElementById('save-skills-modal-btn');
    const modalAddSkillBtn = document.getElementById('modal-add-skill-btn');

    if (editSkillsBtn) {
        editSkillsBtn.addEventListener('click', async () => {
            await renderSkillsModalList();
            skillsModal.classList.add('open');
        });
    }

    if (closeSkillsModal) {
        closeSkillsModal.addEventListener('click', () => skillsModal.classList.remove('open'));
    }

    if (saveSkillsModalBtn) {
        saveSkillsModalBtn.addEventListener('click', async () => {
            const inputs = Array.from(document.querySelectorAll('#skills-list-container .skill-edit-input'));
            const newSkillsList = [];

            for (const input of inputs) {
                const val = input.value.trim();
                if (!val) {
                    alert("Il nome dello skill non può essere vuoto.");
                    input.focus();
                    return;
                }
                if (newSkillsList.includes(val)) {
                    alert(`Lo skill "${val}" è presente più volte.`);
                    input.focus();
                    return;
                }
                newSkillsList.push(val);
            }

            // Process renames in DB
            for (const input of inputs) {
                const oldName = input.getAttribute('data-original');
                const newName = input.value.trim();
                if (oldName && oldName !== newName) {
                    await appDb.renameSkill(oldName, newName);
                    logImport(`Rinominato skill da "${oldName}" a "${newName}".`);
                }
            }

            await saveSkills(newSkillsList);
            await renderImportedData();
            if (window.renderStatistics) renderStatistics();
            if (window.renderGoals) renderGoals();
            if (window.renderDashboard) renderDashboard();
            skillsModal.classList.remove('open');
        });
    }

    if (modalAddSkillBtn) {
        modalAddSkillBtn.addEventListener('click', () => {
            const container = document.getElementById('skills-list-container');
            if (!container) return;

            const emptyMsg = container.querySelector('p');
            if (emptyMsg) emptyMsg.remove();

            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.gap = '8px';
            item.style.alignItems = 'center';

            item.innerHTML = `
                <input type="text" class="skill-edit-input" data-original="" value="" placeholder="Nome nuovo skill..." style="flex:1; padding:8px; border-radius:6px; background:var(--bg-base); color:var(--text-main); border:1px solid var(--border);">
                <button type="button" class="btn secondary delete-skill-btn" title="Elimina questo skill" style="color:var(--danger, #ef4444);">&times;</button>
            `;
            container.appendChild(item);

            const input = item.querySelector('input');
            input.focus();

            item.querySelector('.delete-skill-btn').addEventListener('click', () => {
                item.remove();
            });
        });
    }
}

async function renderSkillsModalList() {
    const container = document.getElementById('skills-list-container');
    if (!container) return;
    const skills = await getSkills();
    container.innerHTML = '';

    if (skills.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);">Nessun skill presente.</p>';
        return;
    }

    skills.forEach(skill => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.gap = '8px';
        item.style.alignItems = 'center';

        item.innerHTML = `
            <input type="text" class="skill-edit-input" data-original="${skill}" value="${skill}" style="flex:1; padding:8px; border-radius:6px; background:var(--bg-base); color:var(--text-main); border:1px solid var(--border);">
            <button type="button" class="btn secondary delete-skill-btn" title="Elimina questo skill" style="color:var(--danger, #ef4444);">&times;</button>
        `;
        container.appendChild(item);
    });

    container.querySelectorAll('.delete-skill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const parent = e.currentTarget.parentElement;
            parent.remove();
        });
    });
}

// --- RENDER IMPORTED DATABASE DATA (SINGLE ROW PER METRIC) ---
async function renderImportedData() {
    const activeYearLabel = document.getElementById('db-active-year-label');
    const tbody = document.getElementById('db-imported-tbody');
    const badgesContainer = document.getElementById('db-summary-badges');
    
    if (!tbody || !activeYearLabel) return;

    const activeYear = window.appState.activeYear;
    activeYearLabel.textContent = `Anno attivo: ${activeYear}`;

    const perfRecords = await appDb.getAll('performance', 'year', activeYear);
    const salesRecords = await appDb.getAll('sales', 'year', activeYear);
    
    const filterSelect = document.getElementById('db-filter-skill');
    const filterValue = filterSelect ? filterSelect.value : 'ALL';
    const searchInput = document.getElementById('db-search-input');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

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

    let badgesHtml = `<span style="padding:4px 10px; border-radius:12px; background:var(--secondary); font-size:0.8rem; font-weight:500;">Totale Anno: ${totalPerf + totalSales} importazioni</span>`;
    for (const [sk, count] of Object.entries(skillCounts)) {
        badgesHtml += `<span style="padding:4px 10px; border-radius:12px; background:var(--primary); color:#fff; font-size:0.8rem; font-weight:500;">${sk}: ${count}</span>`;
    }
    if (totalSales > 0) {
        badgesHtml += `<span style="padding:4px 10px; border-radius:12px; background:#10b981; color:#fff; font-size:0.8rem; font-weight:500;">Sales: ${totalSales}</span>`;
    }
    badgesContainer.innerHTML = badgesHtml;

    const dbColHeader = document.querySelector('#db-imported-table th:nth-child(2)');
    if (dbColHeader) {
        dbColHeader.textContent = window.appState.isAnonymous ? 'Collab' : 'Collaboratore';
    }

    // Explode records into single rows (1 row per metric key-value)
    let singleRows = [];

    perfRecords.forEach(r => {
        const skillName = r.skill || 'Performance (Generale)';
        if (r.data && typeof r.data === 'object') {
            Object.entries(r.data).forEach(([metricName, val]) => {
                singleRows.push({
                    recordId: r.id,
                    store: 'performance',
                    date: r.date,
                    employee: r.employee,
                    type: 'Performance',
                    skill: skillName,
                    metric: metricName,
                    value: val
                });
            });
        }
    });

    salesRecords.forEach(r => {
        const productName = r.data.Product || 'Generale';
        const skillName = `Sales (${productName})`;
        if (r.data && typeof r.data === 'object') {
            Object.entries(r.data).forEach(([metricName, val]) => {
                if (metricName === 'Product') return;
                singleRows.push({
                    recordId: r.id,
                    store: 'sales',
                    date: r.date,
                    employee: r.employee,
                    type: 'Sales',
                    skill: skillName,
                    metric: metricName,
                    value: val
                });
            });
        }
    });

    // Apply Filter by Skill / Sales
    if (filterValue === 'SALES') {
        singleRows = singleRows.filter(r => r.store === 'sales');
    } else if (filterValue !== 'ALL') {
        singleRows = singleRows.filter(r => r.store === 'performance' && r.skill === filterValue);
    }

    // Apply Search Filter across all fields
    if (searchTerm) {
        singleRows = singleRows.filter(r => {
            const dispName = window.getDisplayName(r.employee).toLowerCase();
            const realName = r.employee.toLowerCase();
            const metric = r.metric.toLowerCase();
            const skill = r.skill.toLowerCase();
            const date = (r.date || '').toLowerCase();
            const val = String(r.value).toLowerCase();
            return dispName.includes(searchTerm) || realName.includes(searchTerm) || metric.includes(searchTerm) || skill.includes(searchTerm) || date.includes(searchTerm) || val.includes(searchTerm);
        });
    }

    // Sort by date desc, then employee asc, then metric asc
    singleRows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.employee.localeCompare(b.employee) || a.metric.localeCompare(b.metric));

    tbody.innerHTML = '';

    if (singleRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:32px;">Nessuna riga trovata nel database per l'anno ${activeYear}.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    singleRows.forEach(r => {
        const tr = document.createElement('tr');
        const dispEmployee = window.getDisplayName(r.employee);

        const skillBadge = r.store === 'performance' 
            ? `<span style="padding:3px 8px; border-radius:4px; background:var(--primary); color:#fff; font-size:0.75rem; font-weight:600;">${r.skill}</span>`
            : `<span style="padding:3px 8px; border-radius:4px; background:#10b981; color:#fff; font-size:0.75rem; font-weight:600;">${r.skill}</span>`;

        tr.innerHTML = `
            <td style="white-space:nowrap; font-weight:500;">${r.date || '-'}</td>
            <td><strong>${dispEmployee}</strong></td>
            <td>${skillBadge}</td>
            <td style="font-weight:500;">${r.metric}</td>
            <td style="font-weight:600;">${r.value}</td>
            <td style="text-align:center;">
                <button class="icon-btn edit-metric-row-btn" data-store="${r.store}" data-id="${r.recordId}" data-metric="${r.metric}" title="Modifica questa riga" style="color:var(--primary); border-radius:4px; padding:4px; margin-right:4px;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="icon-btn delete-metric-row-btn" data-store="${r.store}" data-id="${r.recordId}" data-metric="${r.metric}" title="Elimina questa riga" style="color:var(--danger, #ef4444); border-radius:4px; padding:4px;">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);

    // Attach row edit handlers
    tbody.querySelectorAll('.edit-metric-row-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const store = e.currentTarget.getAttribute('data-store');
            const metricKey = e.currentTarget.getAttribute('data-metric');
            await openManualDataModal('edit', { id, store, metricKey });
        });
    });

    // Attach row delete handlers
    tbody.querySelectorAll('.delete-metric-row-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const store = e.currentTarget.getAttribute('data-store');
            const metricKey = e.currentTarget.getAttribute('data-metric');

            if (confirm(`Eliminare la riga metrica "${metricKey}"?`)) {
                const records = await appDb.getAll(store);
                const targetRecord = records.find(x => x.id === id);
                if (targetRecord && targetRecord.data) {
                    delete targetRecord.data[metricKey];
                    const remainingKeys = Object.keys(targetRecord.data);
                    if (remainingKeys.length === 0 || (store === 'sales' && remainingKeys.length === 1 && remainingKeys[0] === 'Product')) {
                        await appDb.deleteRecord(store, id);
                    } else {
                        const transaction = appDb._db.transaction([store], 'readwrite');
                        transaction.objectStore(store).put(targetRecord);
                    }
                }
                logImport(`Eliminata riga metrica "${metricKey}".`);
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
            if (window.renderDashboard) window.renderDashboard();
            if (window.renderStatistics) renderStatistics();
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

function renderStatistics() {
    // Populate individual select
    const select = document.getElementById('individual-select');
    const placeholder = window.appState.isAnonymous ? 'Seleziona Collab...' : 'Seleziona Collaboratore...';
    select.innerHTML = `<option value="">${placeholder}</option>`;
    
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

function setupCustomMonthSelects() {
    const currentMonthVal = String(new Date().getMonth() + 1).padStart(2, '0');

    document.querySelectorAll('.custom-month-select').forEach(container => {
        const trigger = container.querySelector('.custom-month-trigger');
        const dropdown = container.querySelector('.custom-month-dropdown');
        const selectedText = container.querySelector('.selected-text');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const items = container.querySelectorAll('.searchable-dropdown-item');

        if (!trigger || !dropdown || !hiddenInput) return;

        // Set default to current month
        let defaultItem = Array.from(items).find(i => i.getAttribute('data-value') === currentMonthVal);
        if (!defaultItem && items.length > 0) defaultItem = items[0];

        if (defaultItem) {
            items.forEach(i => i.classList.remove('selected'));
            defaultItem.classList.add('selected');
            hiddenInput.value = defaultItem.getAttribute('data-value');
            selectedText.textContent = defaultItem.textContent;
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-month-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = item.getAttribute('data-value');
                hiddenInput.value = val;
                selectedText.textContent = item.textContent;

                items.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                dropdown.classList.remove('open');

                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-month-select')) {
            document.querySelectorAll('.custom-month-dropdown').forEach(d => d.classList.remove('open'));
        }
    });
}

// --- MANUAL DATA MODAL MANAGEMENT ---
async function populateManualDataDatalists(storeType) {
    const skillDatalist = document.getElementById('manual-skill-list');
    const employeeDatalist = document.getElementById('manual-employee-list');
    const metricDatalist = document.getElementById('manual-metric-list');

    if (!skillDatalist || !employeeDatalist || !metricDatalist) return;

    skillDatalist.innerHTML = '';
    employeeDatalist.innerHTML = '';
    metricDatalist.innerHTML = '';

    const activeYear = window.appState.activeYear;
    const perfRecords = await appDb.getAll('performance', 'year', activeYear);
    const salesRecords = await appDb.getAll('sales', 'year', activeYear);

    // Skills / Products
    const skillsSet = new Set();
    if (storeType === 'performance') {
        const customSkills = await appDb.getSetting('custom_skills', ['Voice Inbound']);
        customSkills.forEach(s => skillsSet.add(s));
        perfRecords.forEach(r => { if (r.skill) skillsSet.add(r.skill); });
    } else {
        salesRecords.forEach(r => { if (r.data && r.data.Product) skillsSet.add(r.data.Product); });
    }
    skillsSet.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        skillDatalist.appendChild(opt);
    });

    // Employees
    const employeeSet = new Set();
    Object.keys(window.appState.anonymousMap || {}).forEach(e => employeeSet.add(e));
    perfRecords.forEach(r => { if (r.employee) employeeSet.add(r.employee); });
    salesRecords.forEach(r => { if (r.employee) employeeSet.add(r.employee); });

    Array.from(employeeSet).sort().forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp;
        employeeDatalist.appendChild(opt);
    });

    // Metrics
    const metricSet = new Set();
    if (storeType === 'performance') {
        perfRecords.forEach(r => {
            if (r.data) Object.keys(r.data).forEach(k => metricSet.add(k));
        });
    } else {
        salesRecords.forEach(r => {
            if (r.data) Object.keys(r.data).forEach(k => { if (k !== 'Product') metricSet.add(k); });
        });
    }
    Array.from(metricSet).sort().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        metricDatalist.appendChild(opt);
    });
}

async function openManualDataModal(mode = 'add', editTarget = null) {
    const modal = document.getElementById('manual-data-modal');
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('manual-data-modal-title');
    
    const modeInput = document.getElementById('manual-edit-mode');
    const recordIdInput = document.getElementById('manual-record-id');
    const oldStoreInput = document.getElementById('manual-old-store');
    const oldMetricInput = document.getElementById('manual-old-metric');

    const storeSelect = document.getElementById('manual-store-type');
    const skillInput = document.getElementById('manual-skill-input');
    const employeeInput = document.getElementById('manual-employee-input');
    const dateInput = document.getElementById('manual-date-input');
    const metricInput = document.getElementById('manual-metric-input');
    const valueInput = document.getElementById('manual-value-input');

    if (!modal || !overlay) return;

    modeInput.value = mode;

    if (mode === 'edit' && editTarget) {
        titleEl.textContent = 'Modifica Dato Manuale';
        const { id, store, metricKey } = editTarget;
        recordIdInput.value = id;
        oldStoreInput.value = store;
        oldMetricInput.value = metricKey;

        const records = await appDb.getAll(store);
        const record = records.find(r => r.id === id);

        if (record && record.data) {
            storeSelect.value = store;
            skillInput.value = store === 'performance' ? (record.skill || '') : (record.data.Product || '');
            employeeInput.value = record.employee || '';
            dateInput.value = record.date || `${window.appState.activeYear}-01-01`;
            metricInput.value = metricKey;
            valueInput.value = record.data[metricKey] !== undefined ? record.data[metricKey] : '';
        }
    } else {
        titleEl.textContent = 'Aggiungi Dato Manuale';
        recordIdInput.value = '';
        oldStoreInput.value = '';
        oldMetricInput.value = '';

        storeSelect.value = 'performance';
        skillInput.value = '';
        employeeInput.value = '';
        dateInput.value = `${window.appState.activeYear}-01-01`;
        metricInput.value = '';
        valueInput.value = '';
    }

    await populateManualDataDatalists(storeSelect.value);

    modal.classList.add('open');
    overlay.classList.add('open');
}

function closeManualDataModal() {
    const modal = document.getElementById('manual-data-modal');
    const overlay = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

async function saveManualData() {
    const mode = document.getElementById('manual-edit-mode').value;
    const recordId = parseInt(document.getElementById('manual-record-id').value);
    const oldStore = document.getElementById('manual-old-store').value;
    const oldMetric = document.getElementById('manual-old-metric').value;

    const store = document.getElementById('manual-store-type').value;
    const skillName = document.getElementById('manual-skill-input').value.trim();
    const employee = document.getElementById('manual-employee-input').value.trim();
    const dateStr = document.getElementById('manual-date-input').value.trim();
    const metric = document.getElementById('manual-metric-input').value.trim();
    const rawVal = document.getElementById('manual-value-input').value.trim();

    if (!skillName) {
        alert("Inserisci uno Skill o Prodotto.");
        return;
    }
    if (!employee) {
        alert("Inserisci il nome del collaboratore.");
        return;
    }
    if (!dateStr) {
        alert("Seleziona una data valida.");
        return;
    }
    if (!metric) {
        alert("Inserisci il nome della metrica.");
        return;
    }
    if (rawVal === '') {
        alert("Inserisci un valore.");
        return;
    }

    let val = rawVal;
    const num = parseFloat(rawVal.replace(',', '.'));
    if (!isNaN(num) && String(num).length >= rawVal.replace(',', '.').trim().length - 2) {
        val = num;
    }

    const year = dateStr.split('-')[0] || window.appState.activeYear;

    if (mode === 'edit' && recordId && oldStore && oldMetric) {
        const oldRecords = await appDb.getAll(oldStore);
        const oldRecord = oldRecords.find(r => r.id === recordId);
        if (oldRecord && oldRecord.data) {
            delete oldRecord.data[oldMetric];
            const remainingKeys = Object.keys(oldRecord.data);
            if (remainingKeys.length === 0 || (oldStore === 'sales' && remainingKeys.length === 1 && remainingKeys[0] === 'Product')) {
                await appDb.deleteRecord(oldStore, recordId);
            } else {
                const tx = appDb._db.transaction([oldStore], 'readwrite');
                tx.objectStore(oldStore).put(oldRecord);
            }
        }
    }

    const targetRecords = await appDb.getAll(store, 'year', year);
    let targetRec = targetRecords.find(r => {
        if (r.date !== dateStr || r.employee !== employee) return false;
        if (store === 'performance') return (r.skill || '') === skillName;
        return (r.data && r.data.Product) === skillName;
    });

    if (targetRec) {
        targetRec.isManual = true;
        if (!targetRec.manualMetrics) targetRec.manualMetrics = {};
        targetRec.manualMetrics[metric] = true;
        targetRec.data[metric] = val;
        const tx = appDb._db.transaction([store], 'readwrite');
        tx.objectStore(store).put(targetRec);
    } else {
        const newRec = {
            year: year,
            date: dateStr,
            employee: employee,
            isManual: true,
            manualMetrics: { [metric]: true },
            data: {}
        };
        if (store === 'performance') {
            newRec.skill = skillName;
        } else {
            newRec.data.Product = skillName;
        }
        newRec.data[metric] = val;
        await appDb.addMultiple(store, [newRec]);
    }

    await autoAssignAnonIds([{ year, employee }]);

    closeManualDataModal();
    logImport(mode === 'edit' ? `Modificata riga metrica "${metric}".` : `Aggiunta nuova metrica "${metric}".`);
    await refreshYearsList();
    await renderImportedData();
    if (window.renderStatistics) renderStatistics();
}

function setupManualDataModalListeners() {
    const addBtn = document.getElementById('add-manual-data-btn');
    const closeBtn = document.getElementById('close-manual-data-modal');
    const cancelBtn = document.getElementById('cancel-manual-data-btn');
    const saveBtn = document.getElementById('save-manual-data-btn');
    const storeSelect = document.getElementById('manual-store-type');

    if (addBtn) addBtn.addEventListener('click', () => openManualDataModal('add'));
    if (closeBtn) closeBtn.addEventListener('click', closeManualDataModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeManualDataModal);
    if (saveBtn) saveBtn.addEventListener('click', saveManualData);

    if (storeSelect) {
        storeSelect.addEventListener('change', (e) => {
            populateManualDataDatalists(e.target.value);
        });
    }
}

// --- IMPORT WIZARD & LOG HISTORY ---
let wizardState = {
    currentStep: 1,
    type: 'performance',
    skill: '',
    month: String(new Date().getMonth() + 1).padStart(2, '0'),
    file: null
};

function resetWizardMonthSelect() {
    const monthContainer = document.getElementById('wizard-month-select');
    if (!monthContainer) return;

    const currentMonthVal = String(new Date().getMonth() + 1).padStart(2, '0');
    const selectedText = monthContainer.querySelector('.selected-text');
    const hiddenInput = monthContainer.querySelector('#wizard-month-date');
    const items = monthContainer.querySelectorAll('.searchable-dropdown-item');

    if (!hiddenInput) return;

    let defaultItem = Array.from(items).find(i => i.getAttribute('data-value') === currentMonthVal);
    if (!defaultItem && items.length > 0) defaultItem = items[0];

    if (defaultItem) {
        items.forEach(i => i.classList.remove('selected'));
        defaultItem.classList.add('selected');
        hiddenInput.value = defaultItem.getAttribute('data-value');
        if (selectedText) selectedText.textContent = defaultItem.textContent;
        wizardState.month = hiddenInput.value;
    }
}

function updateWizardStepHeader() {
    const step2Item = document.querySelector('.wizard-step-item[data-step="2"]');
    const step3Item = document.querySelector('.wizard-step-item[data-step="3"]');
    const step4Item = document.querySelector('.wizard-step-item[data-step="4"]');

    const step3Title = document.getElementById('wizard-step-3-title');
    const step4Title = document.getElementById('wizard-step-4-title');

    if (step2Item) step2Item.style.display = 'flex';
    if (step3Item) {
        const numEl = step3Item.querySelector('.step-num');
        if (numEl) numEl.textContent = '3';
    }
    if (step4Item) {
        const numEl = step4Item.querySelector('.step-num');
        if (numEl) numEl.textContent = '4';
    }
    if (step3Title) step3Title.textContent = 'Passaggio 3: Seleziona il mese di sovrascrittura';
    if (step4Title) step4Title.textContent = 'Passaggio 4: Seleziona ed importa il file CSV';
}

function updateWizardStepUI(step) {
    wizardState.currentStep = step;
    updateWizardStepHeader();

    document.querySelectorAll('.wizard-step-item').forEach(item => {
        const itemStep = parseInt(item.getAttribute('data-step'));
        item.classList.remove('active', 'completed');

        if (itemStep === step) {
            item.classList.add('active');
        } else if (itemStep < step) {
            item.classList.add('completed');
        }
    });

    for (let i = 1; i <= 4; i++) {
        const contentEl = document.getElementById(`wizard-step-${i}`);
        if (contentEl) contentEl.style.display = i === step ? 'block' : 'none';
    }

    if (step === 2) {
        const titleEl = document.getElementById('wizard-step-2-title');
        const descEl = document.getElementById('wizard-step-2-desc');
        const perfSection = document.getElementById('wizard-perf-skill-section');
        const salesSection = document.getElementById('wizard-sales-info-section');

        if (wizardState.type === 'performance') {
            if (titleEl) titleEl.textContent = 'Passaggio 2: Seleziona lo Skill Performance';
            if (descEl) descEl.textContent = 'Scegli a quale Skill associare i dati delle performance da importare.';
            if (perfSection) perfSection.style.display = 'block';
            if (salesSection) salesSection.style.display = 'none';
            populateSkillsUI();
        } else {
            if (titleEl) titleEl.textContent = 'Passaggio 2: Seleziona Tipo Report Sales';
            if (descEl) descEl.textContent = 'Seleziona se intendi importare un report AOIT oppure Nuovi Abo & RET.';
            if (perfSection) perfSection.style.display = 'none';
            if (salesSection) salesSection.style.display = 'block';
        }
    }

    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');
    const submitBtn = document.getElementById('wizard-submit-btn');

    if (prevBtn) prevBtn.style.visibility = step > 1 ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.display = step < 4 ? 'inline-block' : 'none';
    if (submitBtn) submitBtn.style.display = step === 4 ? 'inline-block' : 'none';
}

function setupImportWizard() {
    const openBtn = document.getElementById('open-import-wizard-btn');
    const modal = document.getElementById('import-wizard-modal');
    const closeBtn = document.getElementById('close-import-wizard');
    const cancelBtn = document.getElementById('wizard-cancel-btn');
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');
    const submitBtn = document.getElementById('wizard-submit-btn');
    const overlay = document.getElementById('modal-overlay');

    const optPerf = document.getElementById('type-opt-performance');
    const optSales = document.getElementById('type-opt-sales');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            wizardState = {
                currentStep: 1,
                type: 'performance',
                skill: '',
                salesType: 'aoit',
                month: String(new Date().getMonth() + 1).padStart(2, '0'),
                file: null
            };
            
            if (optPerf && optSales) {
                optPerf.classList.add('active');
                optPerf.style.borderColor = 'var(--primary)';
                optSales.classList.remove('active');
                optSales.style.borderColor = 'var(--border)';
            }

            const fileNameEl = document.getElementById('wizard-file-name');
            const fileInput = document.getElementById('wizard-csv-file');
            const statusBadge = document.getElementById('wizard-status-badge');
            const liveLogs = document.getElementById('wizard-live-logs');

            if (fileNameEl) fileNameEl.textContent = 'Fai clic o trascina qui il tuo file CSV';
            if (fileInput) fileInput.value = '';
            if (statusBadge) {
                statusBadge.textContent = 'In attesa file';
                statusBadge.style.background = 'var(--bg-base)';
                statusBadge.style.color = 'var(--text-muted)';
            }
            if (liveLogs) {
                liveLogs.innerHTML = '<div style="color:var(--text-muted);">Nessuna operazione ancora eseguita.</div>';
            }

            resetWizardMonthSelect();
            updateWizardStepUI(1);

            if (modal) modal.classList.add('open');
            if (overlay) overlay.classList.add('open');
        });
    }

    const wizardMonthInput = document.getElementById('wizard-month-date');
    if (wizardMonthInput) {
        wizardMonthInput.addEventListener('change', (e) => {
            wizardState.month = e.target.value;
        });
    }

    const closeModalFunc = () => {
        if (modal) modal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModalFunc);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalFunc);

    if (optPerf && optSales) {
        optPerf.addEventListener('click', () => {
            wizardState.type = 'performance';
            optPerf.classList.add('active');
            optPerf.style.borderColor = 'var(--primary)';
            optSales.classList.remove('active');
            optSales.style.borderColor = 'var(--border)';
            updateWizardStepUI(wizardState.currentStep);
        });

        optSales.addEventListener('click', () => {
            wizardState.type = 'sales';
            optSales.classList.add('active');
            optSales.style.borderColor = 'var(--primary)';
            optPerf.classList.remove('active');
            optPerf.style.borderColor = 'var(--border)';
            updateWizardStepUI(wizardState.currentStep);
        });
    }

    const optAoit = document.getElementById('sales-opt-aoit');
    const optNuovi = document.getElementById('sales-opt-nuovi');

    if (optAoit && optNuovi) {
        optAoit.addEventListener('click', () => {
            wizardState.salesType = 'aoit';
            optAoit.classList.add('active');
            optAoit.style.borderColor = 'var(--primary)';
            const svgAoit = optAoit.querySelector('svg');
            if (svgAoit) svgAoit.setAttribute('stroke', 'var(--primary)');

            optNuovi.classList.remove('active');
            optNuovi.style.borderColor = 'var(--border)';
            const svgNuovi = optNuovi.querySelector('svg');
            if (svgNuovi) svgNuovi.setAttribute('stroke', 'currentColor');
        });

        optNuovi.addEventListener('click', () => {
            wizardState.salesType = 'nuovi_abo';
            optNuovi.classList.add('active');
            optNuovi.style.borderColor = 'var(--primary)';
            const svgNuovi = optNuovi.querySelector('svg');
            if (svgNuovi) svgNuovi.setAttribute('stroke', 'var(--primary)');

            optAoit.classList.remove('active');
            optAoit.style.borderColor = 'var(--border)';
            const svgAoit = optAoit.querySelector('svg');
            if (svgAoit) svgAoit.setAttribute('stroke', 'currentColor');
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (wizardState.currentStep > 1) {
                updateWizardStepUI(wizardState.currentStep - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (wizardState.currentStep === 2) {
                if (wizardState.type === 'performance') {
                    const skillSelect = document.getElementById('wizard-perf-skill-select');
                    if (skillSelect && skillSelect.value) {
                        wizardState.skill = skillSelect.value;
                    } else {
                        alert("Seleziona uno skill prima di proseguire.");
                        return;
                    }
                }
            }
            if (wizardState.currentStep < 4) {
                updateWizardStepUI(wizardState.currentStep + 1);
            }
        });
    }

    const dropzone = document.getElementById('wizard-dropzone');
    const csvFileInput = document.getElementById('wizard-csv-file');
    const fileNameDisplay = document.getElementById('wizard-file-name');

    if (dropzone && csvFileInput) {
        dropzone.addEventListener('click', () => csvFileInput.click());
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--border)';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                csvFileInput.files = e.dataTransfer.files;
                handleWizardFileSelection(e.dataTransfer.files[0]);
            }
        });
        csvFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleWizardFileSelection(e.target.files[0]);
            }
        });
    }

    function handleWizardFileSelection(file) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert("Seleziona un file valido con estensione .csv");
            return;
        }
        wizardState.file = file;
        if (fileNameDisplay) fileNameDisplay.textContent = `File selezionato: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        const statusBadge = document.getElementById('wizard-status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'Pronto all\'importazione';
            statusBadge.style.background = 'var(--primary)';
            statusBadge.style.color = '#fff';
        }
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!wizardState.file) {
                alert("Seleziona un file CSV prima di avviare l'importazione.");
                return;
            }

            const monthVal = wizardState.month;
            const startDate = monthVal ? `${window.appState.activeYear}-${monthVal}-01` : null;
            const statusBadge = document.getElementById('wizard-status-badge');
            
            if (statusBadge) {
                statusBadge.textContent = 'Elaborazione in corso...';
                statusBadge.style.background = '#f59e0b';
                statusBadge.style.color = '#fff';
            }

            submitBtn.disabled = true;

            try {
                const storeName = wizardState.type === 'performance' ? 'performance' : 'sales';
                
                let selectedSkill = '';
                if (wizardState.type === 'performance') {
                    const skillSelect = document.getElementById('wizard-perf-skill-select');
                    selectedSkill = skillSelect ? skillSelect.value : wizardState.skill;
                    if (!selectedSkill) {
                        alert("Seleziona uno skill.");
                        submitBtn.disabled = false;
                        return;
                    }
                    logImport(`Avvio importazione file ${wizardState.file.name} per lo skill "${selectedSkill}"...`);
                } else {
                    logImport(`Avvio importazione file ${wizardState.file.name} per Sales...`);
                }

                const parsed = await CSVParser.parse(wizardState.file, startDate);
                logImport(`Analisi CSV completata. Record estratti dal file: ${parsed.data.length}.`);

                if (wizardState.type === 'performance') {
                    parsed.data.forEach(d => { d.skill = selectedSkill; });
                }

                // Preserve manual metrics so CSV import does NOT overwrite user's manual additions/edits
                const existingRecords = await appDb.getAll(storeName, 'year', window.appState.activeYear);
                const manualMap = {};
                existingRecords.forEach(r => {
                    if (r.isManual && r.manualMetrics) {
                        const targetSkill = storeName === 'performance' ? (r.skill || '') : (r.data && r.data.Product || '');
                        const key = `${r.date}_${r.employee}_${targetSkill}`;
                        manualMap[key] = r;
                    }
                });

                if (Object.keys(manualMap).length > 0) {
                    let preservedCount = 0;
                    parsed.data.forEach(d => {
                        const targetSkill = storeName === 'performance' ? (d.skill || '') : (d.data && d.data.Product || '');
                        const key = `${d.date}_${d.employee}_${targetSkill}`;
                        const manualRec = manualMap[key];
                        if (manualRec && manualRec.data && manualRec.manualMetrics) {
                            Object.keys(manualRec.manualMetrics).forEach(mKey => {
                                if (manualRec.data[mKey] !== undefined) {
                                    d.data[mKey] = manualRec.data[mKey];
                                    preservedCount++;
                                }
                            });
                        }
                    });
                    if (preservedCount > 0) {
                        logImport(`Preservate ${preservedCount} metriche inserite/modificate manualmente.`);
                    }
                }

                if (startDate) {
                    if (wizardState.type === 'performance') {
                        await appDb.deleteFromDate('performance', startDate, selectedSkill);
                        logImport(`Eliminati vecchi dati automatici performance ("${selectedSkill}") da mese ${monthVal}/${window.appState.activeYear} in poi.`);
                    } else {
                        await appDb.deleteFromDate('sales', startDate);
                        logImport(`Eliminati vecchi dati automatici Sales da mese ${monthVal}/${window.appState.activeYear} in poi.`);
                    }
                }

                await appDb.addMultiple(storeName, parsed.data);
                logImport(`Importazione conclusa con successo! Registrati ${parsed.data.length} record in ${storeName === 'performance' ? `Performance ("${selectedSkill}")` : 'Sales'}.`);
                await autoAssignAnonIds(parsed.data);

                if (statusBadge) {
                    statusBadge.textContent = 'Importazione Completata!';
                    statusBadge.style.background = '#10b981';
                    statusBadge.style.color = '#fff';
                }

                await refreshYearsList();
                await renderImportedData();
                if (window.renderStatistics) renderStatistics();

            } catch (err) {
                logImport(`ERRORE DURANTE L'IMPORTAZIONE: ${err}`, true);
                if (statusBadge) {
                    statusBadge.textContent = 'Errore Importazione';
                    statusBadge.style.background = 'var(--danger, #ef4444)';
                    statusBadge.style.color = '#fff';
                }
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    const wizardEditSkillsBtn = document.getElementById('wizard-edit-skills-btn');
    if (wizardEditSkillsBtn) {
        wizardEditSkillsBtn.addEventListener('click', () => {
            const skillsModal = document.getElementById('skills-modal');
            if (skillsModal) skillsModal.classList.add('open');
        });
    }
}

function setupLogHistoryModal() {
    const openLogsBtn = document.getElementById('open-import-logs-btn');
    const logsModal = document.getElementById('import-logs-modal');
    const closeBtn = document.getElementById('close-import-logs-modal');
    const closeBtn2 = document.getElementById('close-logs-modal-btn');
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('logs-history-container');
    const noticeEl = document.getElementById('logs-cleaned-notice');

    const openModal = async () => {
        if (!logsModal || !overlay) return;

        let cleanedCount = 0;
        if (window.appDb && window.appDb.cleanOldImportLogs) {
            cleanedCount = await window.appDb.cleanOldImportLogs(7);
        }

        if (noticeEl) {
            noticeEl.textContent = cleanedCount > 0 
                ? `Eliminati ${cleanedCount} log più vecchi di 7 giorni.` 
                : '';
        }

        if (container && window.appDb && window.appDb.getImportLogs) {
            container.innerHTML = '<div style="color:var(--text-muted);">Caricamento log in corso...</div>';
            const logs = await window.appDb.getImportLogs();
            logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            container.innerHTML = '';
            if (logs.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:16px;">Nessun log salvato negli ultimi 7 giorni.</div>';
            } else {
                logs.forEach(l => {
                    const div = document.createElement('div');
                    div.style.marginBottom = '6px';
                    div.style.paddingBottom = '4px';
                    div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    div.textContent = `${l.text}`;
                    if (l.isError) div.style.color = 'var(--danger, #ef4444)';
                    container.appendChild(div);
                });
            }
        }

        logsModal.classList.add('open');
        overlay.classList.add('open');
    };

    const closeModal = () => {
        if (logsModal) logsModal.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    if (openLogsBtn) openLogsBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);
}



