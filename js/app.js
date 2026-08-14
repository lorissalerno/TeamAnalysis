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
        anonymousMap: {}, // { "Loris Salerno": 1, ... }
        dbCategoryFilters: null,
        dbSort: { column: 'date', direction: 'desc' }
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
        // Chiudi eventuali modal o popup aperti prima di cambiare sezione
        document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('open');

        // Trigger specific section render if needed
        if (sectionId === 'statistics' && window.renderStatistics) window.renderStatistics();
        if (sectionId === 'dashboard' && window.renderDashboard) window.renderDashboard();
        if (sectionId === 'database') renderImportedData();
        if (sectionId === 'goals' && window.renderGoals) renderGoals();
        if (sectionId === 'settings') {
            updateCollabCountBadge();
        }
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
        btn.addEventListener('click', async (e) => {
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

            if (targetId === 'stat-team') {
                if (window.appDb) await appDb.setSetting('stat_sub_tab', 'stat-team');
                const tc = document.getElementById('team-header-controls');
                const ic = document.getElementById('individual-header-controls');
                const cc = document.getElementById('stats-center-controls');
                if (tc) tc.style.display = 'flex';
                if (ic) ic.style.display = 'none';
                if (cc) cc.style.display = 'flex';
                if (window.renderTeamStats) {
                    window.renderTeamStats();
                }
            } else if (targetId === 'stat-individual') {
                if (window.appDb) await appDb.setSetting('stat_sub_tab', 'stat-individual');
                const tc = document.getElementById('team-header-controls');
                const ic = document.getElementById('individual-header-controls');
                const cc = document.getElementById('stats-center-controls');
                if (tc) tc.style.display = 'none';
                if (ic) ic.style.display = 'flex';
                if (cc) cc.style.display = 'none';
                if (window.handleCollaboratorTemplateSwitch) {
                    const select = document.getElementById('individual-select');
                    const savedEmployee = await appDb.getSetting('stat_selected_employee', '');
                    const emp = select ? (select.value || savedEmployee) : savedEmployee;
                    if (emp) await window.handleCollaboratorTemplateSwitch(emp);
                }
                if (window.renderIndividualStats) {
                    window.renderIndividualStats();
                }
            }
        });
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', async () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        await appDb.setSetting('theme', next);
        if (window.renderStatistics) {
            window.renderStatistics();
        }
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

    // Anon Toggle — aggiorna solo la sezione attiva per evitare reload visivo mantenendo lo scroll
    document.getElementById('anon-toggle').addEventListener('change', async (e) => {
        window.appState.isAnonymous = e.target.checked;
        await appDb.setSetting('isAnonymous', e.target.checked);

        const contentEl = document.querySelector('.content');
        const savedScroll = contentEl ? contentEl.scrollTop : 0;
        const savedWinScroll = window.scrollY;

        const activeSection = document.querySelector('.page-section.active');
        const sectionId = activeSection ? activeSection.id : 'dashboard';
        const targetSection = activeSection || document.getElementById(sectionId);

        if (targetSection && targetSection.offsetHeight > 0) {
            targetSection.style.minHeight = targetSection.offsetHeight + 'px';
        }

        if (sectionId === 'dashboard' && window.renderDashboard) await window.renderDashboard();
        else if (sectionId === 'statistics' && window.renderStatistics) await window.renderStatistics();
        else if (sectionId === 'goals' && window.renderGoals) await window.renderGoals();
        else if (sectionId === 'database') renderImportedData();
        else if (sectionId === 'settings' && typeof renderManagementTable === 'function') renderManagementTable();

        if (targetSection) {
            targetSection.style.minHeight = '';
        }

        if (contentEl) contentEl.scrollTop = savedScroll;
        window.scrollTo(0, savedWinScroll);
    });

    // Year Change
    document.getElementById('active-year').addEventListener('change', async (e) => {
        window.appState.activeYear = e.target.value;
        await appDb.setSetting('activeYear', e.target.value);
        await loadAnonymousMap();
        if (window.renderDashboard) window.renderDashboard();
        if (window.renderStatistics) window.renderStatistics();
        if (window.renderGoals) window.renderGoals();
        renderImportedData();
        if (typeof renderManagementTable === 'function') renderManagementTable();
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

    // Notify other modules that appState and initial data are ready
    window.dispatchEvent(new Event('app-initialized'));
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
    const perfSelects = [
        document.getElementById('perf-skill-select'),
        document.getElementById('wizard-perf-skill-select')
    ].filter(Boolean);
    const filterSelect = document.getElementById('db-filter-skill');
    
    perfSelects.forEach(perfSelect => {
        const currentPerf = perfSelect.value;
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
    });

    if (filterSelect) {
        const currentFilter = filterSelect.value;
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
    window.appState.collaboratorSkills = {};
    window.appState.collaboratorTemplates = {};
    mappings.forEach(m => {
        window.appState.anonymousMap[m.realName] = m.anonId;
        window.appState.collaboratorSkills[m.realName] = m.skills || [];
        if (m.templateId) {
            window.appState.collaboratorTemplates[m.realName] = m.templateId;
        }
    });
}

async function updateCollabCountBadge() {
    const badge = document.getElementById('collab-count-badge');
    if (!badge) return;
    const mappings = await appDb.getAll('anonymous_map', 'year', window.appState.activeYear);
    badge.textContent = mappings.length;
}




window.getDisplayName = function(realName) {
    if (!window.appState.isAnonymous) return realName;
    const id = window.appState.anonymousMap[realName];
    if (id !== undefined && id !== null && id !== '') {
        const idStr = String(id);
        return idStr.startsWith('Collab.') ? idStr : `Collab. ${idStr}`;
    }
    return realName;
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
    const searchInput = document.getElementById('db-search-input');
    const searchClearBtn = document.getElementById('db-search-clear');
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

    if (searchInput) {
        searchInput.addEventListener('input', () => renderImportedData());
    }

    if (searchClearBtn && searchInput) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            renderImportedData();
        });
    }

    // Gestione clic sulle intestazioni di colonna per ordinamento
    document.querySelectorAll('.db-sortable-th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (!col) return;
            if (window.appState.dbSort && window.appState.dbSort.column === col) {
                window.appState.dbSort.direction = (window.appState.dbSort.direction === 'asc' ? 'desc' : 'asc');
            } else {
                window.appState.dbSort = {
                    column: col,
                    direction: (col === 'date' || col === 'value') ? 'desc' : 'asc'
                };
            }
            renderImportedData();
        });
    });

    if (clearFilteredBtn) {
        clearFilteredBtn.addEventListener('click', async () => {
            const activeYear = window.appState.activeYear;
            const activeFilters = window.appState.dbCategoryFilters;

            if (!activeFilters || activeFilters.size === 0) {
                alert("Nessuna fonte attualmente selezionata.");
                return;
            }

            const perfRecords = await appDb.getAll('performance', 'year', activeYear);
            const salesRecords = await appDb.getAll('sales', 'year', activeYear);

            const allCategories = [];
            perfRecords.forEach(r => {
                const sk = r.skill || 'Performance (Generale)';
                if (!allCategories.includes(sk)) allCategories.push(sk);
            });
            if (salesRecords.length > 0) allCategories.push('Sales');

            const isAll = allCategories.length > 0 && allCategories.every(cat => activeFilters.has(cat));
            let confirmMsg = "";
            if (isAll) {
                confirmMsg = `Sei sicuro di voler eliminare TUTTI i dati (Performance e Sales) per l'anno ${activeYear}?`;
            } else {
                const activeList = Array.from(activeFilters).join(', ');
                confirmMsg = `Sei sicuro di voler eliminare tutti i dati delle fonti attive (${activeList}) per l'anno ${activeYear}?`;
            }

            if (!confirm(confirmMsg)) return;

            if (isAll) {
                for (const r of perfRecords) await appDb.deleteRecord('performance', r.id);
                for (const r of salesRecords) await appDb.deleteRecord('sales', r.id);
                logImport(`Eliminati tutti i dati per l'anno ${activeYear}.`);
            } else {
                if (activeFilters.has('Sales')) {
                    for (const r of salesRecords) await appDb.deleteRecord('sales', r.id);
                    logImport(`Eliminati tutti i dati Sales per l'anno ${activeYear}.`);
                }
                for (const cat of activeFilters) {
                    if (cat !== 'Sales') {
                        await appDb.deleteBySkill('performance', cat, activeYear);
                        logImport(`Eliminati tutti i dati della Skill "${cat}" per l'anno ${activeYear}.`);
                    }
                }
            }

            await refreshYearsList();
            await renderImportedData();
            if (window.renderStatistics) window.renderStatistics();
            if (window.renderGoals) renderGoals();
            if (window.renderDashboard) renderDashboard();
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
                const conflictDecision = await checkManualDataConflict('performance', window.appState.activeYear, startDate, selectedSkill);
                if (conflictDecision === 'cancel') {
                    logImport(`Importazione annullata dall'utente.`);
                    perfInput.value = '';
                    return;
                }

                logImport(`Lettura ${file.name} per lo skill "${selectedSkill}"...`);
                const parsed = await CSVParser.parse(file, startDate);
                parsed.data.forEach(d => { d.skill = selectedSkill; });

                if (conflictDecision === 'preserve') {
                    const preserved = await preserveManualDataInList(parsed.data, 'performance', window.appState.activeYear, startDate, selectedSkill);
                    if (preserved > 0) {
                        logImport(`Preservati ${preserved} dati inseriti/modificati manualmente.`);
                    }
                }

                if (startDate) {
                    await appDb.deleteFromDate('performance', startDate, selectedSkill);
                    logImport(`Eliminati vecchi dati performance ("${selectedSkill}") da ${monthVal}/${window.appState.activeYear} in poi.`);
                }
                
                await appDb.addMultiple('performance', parsed.data);
                logImport(`Importati ${parsed.data.length} record in Performance ("${selectedSkill}").`);
                await autoAssignAnonIds(parsed.data);
                await refreshYearsList();
                await renderImportedData();
                if (window.renderStatistics) window.renderStatistics();
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
                const conflictDecision = await checkManualDataConflict('sales', window.appState.activeYear, startDate, null);
                if (conflictDecision === 'cancel') {
                    logImport(`Importazione annullata dall'utente.`);
                    salesInput.value = '';
                    return;
                }

                logImport(`Lettura ${file.name}...`);
                const parsed = await CSVParser.parse(file, startDate);
                
                if (conflictDecision === 'preserve') {
                    const preserved = await preserveManualDataInList(parsed.data, 'sales', window.appState.activeYear, startDate, null);
                    if (preserved > 0) {
                        logImport(`Preservati ${preserved} dati inseriti/modificati manualmente.`);
                    }
                }

                if (startDate) {
                    await appDb.deleteFromDate('sales', startDate);
                    logImport(`Eliminati vecchi dati sales da ${monthVal}/${window.appState.activeYear} in poi.`);
                }
                
                await appDb.addMultiple('sales', parsed.data);
                logImport(`Importati ${parsed.data.length} record in Sales.`);
                await autoAssignAnonIds(parsed.data);
                await refreshYearsList();
                await renderImportedData();
                if (window.renderStatistics) window.renderStatistics();
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
            if (window.renderStatistics) window.renderStatistics();
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
    const recordsCounter = document.getElementById('db-records-counter');
    const tbody = document.getElementById('db-imported-tbody');
    const badgesContainer = document.getElementById('db-summary-badges');
    
    if (!tbody || !activeYearLabel) return;

    const activeYear = window.appState.activeYear;
    activeYearLabel.textContent = `Anno attivo: ${activeYear}`;

    const perfRecords = await appDb.getAll('performance', 'year', activeYear);
    const salesRecords = await appDb.getAll('sales', 'year', activeYear);
    
    const searchInput = document.getElementById('db-search-input');
    const searchClearBtn = document.getElementById('db-search-clear');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
    if (searchClearBtn) {
        searchClearBtn.style.display = searchTerm ? 'flex' : 'none';
    }

    // Calcolo conteggi per ciascuna fonte
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

    const totalImportazioni = totalPerf + totalSales;

    // Categorie disponibili per l'anno corrente
    const availableCategories = Object.keys(skillCounts);
    if (totalSales > 0) {
        availableCategories.push('Sales');
    }

    // Inizializzazione o sincronizzazione del set di filtri categoria
    if (!window.appState.dbCategoryFilters || window.appState._dbCategoryYear !== activeYear) {
        window.appState.dbCategoryFilters = new Set(availableCategories);
        window.appState._dbCategoryYear = activeYear;
    }

    // Render delle chip / pulsanti interattivi di attivazione/disattivazione
    if (badgesContainer) {
        badgesContainer.innerHTML = '';

        // Tasto "Totale Anno" / Reset filtri
        const isAllActive = availableCategories.length > 0 && availableCategories.every(cat => window.appState.dbCategoryFilters.has(cat));
        const allChip = document.createElement('button');
        allChip.type = 'button';
        allChip.className = `db-filter-chip chip-all ${isAllActive ? 'active' : 'inactive'}`;
        allChip.title = isAllActive ? 'Tutte le fonti sono visualizzate' : 'Clicca per mostrare tutte le fonti';
        allChip.innerHTML = `
            <span class="chip-state-icon">
                ${isAllActive 
                    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
                    : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'
                }
            </span>
            <span>Totale Anno</span>
            <span class="chip-count">${totalImportazioni}</span>
        `;
        allChip.addEventListener('click', () => {
            window.appState.dbCategoryFilters = new Set(availableCategories);
            renderImportedData();
        });
        badgesContainer.appendChild(allChip);

        // Chip per ciascun Skill di Performance
        for (const [sk, count] of Object.entries(skillCounts)) {
            const isActive = window.appState.dbCategoryFilters.has(sk);
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `db-filter-chip chip-skill ${isActive ? 'active' : 'inactive'}`;
            chip.title = isActive ? `Disattiva visualizzazione "${sk}"` : `Attiva visualizzazione "${sk}"`;
            chip.innerHTML = `
                <span class="chip-state-icon">
                    ${isActive 
                        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' 
                        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                    }
                </span>
                <span>${sk}</span>
                <span class="chip-count">${count}</span>
            `;
            chip.addEventListener('click', () => {
                if (window.appState.dbCategoryFilters.has(sk)) {
                    window.appState.dbCategoryFilters.delete(sk);
                } else {
                    window.appState.dbCategoryFilters.add(sk);
                }
                renderImportedData();
            });
            badgesContainer.appendChild(chip);
        }

        // Chip per Sales
        if (totalSales > 0) {
            const isSalesActive = window.appState.dbCategoryFilters.has('Sales');
            const salesChip = document.createElement('button');
            salesChip.type = 'button';
            salesChip.className = `db-filter-chip chip-sales ${isSalesActive ? 'active' : 'inactive'}`;
            salesChip.title = isSalesActive ? 'Disattiva visualizzazione Sales' : 'Attiva visualizzazione Sales';
            salesChip.innerHTML = `
                <span class="chip-state-icon">
                    ${isSalesActive 
                        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' 
                        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                    }
                </span>
                <span>Sales</span>
                <span class="chip-count">${totalSales}</span>
            `;
            salesChip.addEventListener('click', () => {
                if (window.appState.dbCategoryFilters.has('Sales')) {
                    window.appState.dbCategoryFilters.delete('Sales');
                } else {
                    window.appState.dbCategoryFilters.add('Sales');
                }
                renderImportedData();
            });
            badgesContainer.appendChild(salesChip);
        }
    }

    // Aggiornamento etichetta intestazione Collaboratore (rispetta anonimo)
    const empHeaderLabel = document.getElementById('db-th-employee-label');
    if (empHeaderLabel) {
        empHeaderLabel.textContent = window.appState.isAnonymous ? 'Collab' : 'Collaboratore';
    }

    // Espansione record in singole righe (1 riga per coppia metrica-valore)
    let singleRows = [];

    perfRecords.forEach(r => {
        const skillName = r.skill || 'Performance (Generale)';
        if (r.data && typeof r.data === 'object') {
            Object.entries(r.data).forEach(([metricName, val]) => {
                const isMan = Boolean(r.isManual && (!r.manualMetrics || r.manualMetrics[metricName] !== false));
                singleRows.push({
                    recordId: r.id,
                    store: 'performance',
                    date: r.date,
                    employee: r.employee,
                    type: 'Performance',
                    skill: skillName,
                    filterCategory: skillName,
                    metric: metricName,
                    qty: '-',
                    value: val,
                    isManual: isMan
                });
            });
        }
    });

    salesRecords.forEach(r => {
        const skillName = r.skill || (r.data && r.data.Product === 'Nuovi Abo' ? 'Nuovi Abo' : 'AOIT');
        let productName = (r.data && r.data.Product) ? r.data.Product : 'AOIT';
        if (typeof productName === 'string' && productName.toLowerCase().includes('aoit')) {
            productName = 'AOIT';
        }
        
        let value = 0;
        let metricKeyForRecord = 'AOIT';
        if (r.data && typeof r.data === 'object') {
            if (r.data['AOIT'] !== undefined) {
                value = r.data['AOIT'];
                metricKeyForRecord = 'AOIT';
            } else if (r.data['AOIT gew'] !== undefined) {
                value = r.data['AOIT gew'];
                metricKeyForRecord = 'AOIT';
            } else if (r.data['Value'] !== undefined) {
                value = r.data['Value'];
                metricKeyForRecord = 'Value';
            } else if (r.data['W- Value ACQ'] !== undefined) {
                value = r.data['W- Value ACQ'];
                metricKeyForRecord = 'W- Value ACQ';
            } else {
                const keys = Object.keys(r.data).filter(k => k !== 'Product' && k !== 'Nb Events');
                if (keys.length > 0) {
                    metricKeyForRecord = keys[0];
                    value = r.data[keys[0]];
                } else if (r.data['Nb Events'] !== undefined) {
                    metricKeyForRecord = 'Nb Events';
                    value = r.data['Nb Events'];
                }
            }
        }

        let qty = 1;
        if (r.data && r.data['Nb Events'] !== undefined) {
            qty = r.data['Nb Events'];
        }

        const isMan = Boolean(r.isManual && (!r.manualMetrics || r.manualMetrics[metricKeyForRecord] !== false || r.manualMetrics[productName] !== false));

        singleRows.push({
            recordId: r.id,
            store: 'sales',
            date: r.date,
            employee: r.employee,
            type: 'Sales',
            skill: skillName,
            filterCategory: 'Sales',
            metric: (metricKeyForRecord && metricKeyForRecord !== 'AOIT' && metricKeyForRecord !== 'Nb Events') ? metricKeyForRecord : productName,
            metricKey: metricKeyForRecord,
            qty: qty,
            value: Math.round(value),
            isManual: isMan
        });
    });

    const totalRawRows = singleRows.length;

    // Filtra per categorie attivate tramite i pulsanti/chip
    singleRows = singleRows.filter(r => window.appState.dbCategoryFilters.has(r.filterCategory));

    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    // Filtra per testo di ricerca
    if (searchTerm) {
        singleRows = singleRows.filter(r => {
            const dispName = window.getDisplayName(r.employee).toLowerCase();
            const realName = (r.employee || '').toLowerCase();
            const metric = (r.metric || '').toLowerCase();
            const skill = (r.skill || '').toLowerCase();
            const date = (r.date || '').toLowerCase();
            let monthName = '';
            if (r.date && r.date.includes('-')) {
                const m = parseInt(r.date.split('-')[1], 10);
                if (m >= 1 && m <= 12) monthName = monthNames[m - 1].toLowerCase();
            }
            const val = String(r.value).toLowerCase();
            return dispName.includes(searchTerm) || realName.includes(searchTerm) || metric.includes(searchTerm) || skill.includes(searchTerm) || date.includes(searchTerm) || monthName.includes(searchTerm) || val.includes(searchTerm);
        });
    }

    // Ordinamento colonne (A-Z, Z-A, Data cronologica, Valore numerico)
    const sort = window.appState.dbSort || { column: 'date', direction: 'desc' };
    singleRows.sort((a, b) => {
        let cmp = 0;
        if (sort.column === 'date') {
            cmp = (a.date || '').localeCompare(b.date || '');
        } else if (sort.column === 'employee') {
            const nameA = window.getDisplayName(a.employee);
            const nameB = window.getDisplayName(b.employee);
            cmp = nameA.localeCompare(nameB, 'it', { sensitivity: 'base', numeric: true });
        } else if (sort.column === 'skill') {
            cmp = (a.skill || '').localeCompare(b.skill || '', 'it', { sensitivity: 'base' });
        } else if (sort.column === 'metric') {
            cmp = (a.metric || '').localeCompare(b.metric || '', 'it', { sensitivity: 'base' });
        } else if (sort.column === 'value') {
            const numA = typeof a.value === 'number' ? a.value : (parseFloat(a.value) || 0);
            const numB = typeof b.value === 'number' ? b.value : (parseFloat(b.value) || 0);
            cmp = numA - numB;
        }

        if (cmp === 0) {
            // Criterio secondario in caso di parità
            if (sort.column !== 'date') {
                cmp = (b.date || '').localeCompare(a.date || '');
            } else {
                const nameA = window.getDisplayName(a.employee);
                const nameB = window.getDisplayName(b.employee);
                cmp = nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
            }
        }

        return sort.direction === 'desc' ? -cmp : cmp;
    });

    // Aggiornamento icone ed evidenziazione intestazioni tabella
    document.querySelectorAll('.db-sortable-th').forEach(th => {
        const col = th.getAttribute('data-sort');
        const iconSlot = th.querySelector('.sort-icon-slot');
        if (col === sort.column) {
            th.classList.add('sorted');
            if (iconSlot) {
                iconSlot.innerHTML = sort.direction === 'asc'
                    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary);"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>'
                    : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary);"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
            }
        } else {
            th.classList.remove('sorted');
            if (iconSlot) {
                iconSlot.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.35;"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>';
            }
        }
    });

    // Aggiornamento contatore record
    if (recordsCounter) {
        if (singleRows.length === totalRawRows) {
            recordsCounter.textContent = `${totalRawRows} record totali`;
        } else {
            recordsCounter.textContent = `${singleRows.length} di ${totalRawRows} record`;
        }
    }

    tbody.innerHTML = '';

    if (singleRows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:48px 16px; color:var(--text-muted);">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span style="font-weight:500;">Nessun dato trovato per i filtri selezionati.</span>
                        <button type="button" class="btn secondary" id="db-reset-filters-btn" style="padding:4px 12px; font-size:0.8rem; margin-top:4px;">Reimposta Filtri</button>
                    </div>
                </td>
            </tr>
        `;
        const resetBtn = document.getElementById('db-reset-filters-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                window.appState.dbCategoryFilters = new Set(availableCategories);
                renderImportedData();
            });
        }
        return;
    }

    const fragment = document.createDocumentFragment();
    singleRows.forEach(r => {
        const tr = document.createElement('tr');
        const dispEmployee = window.getDisplayName(r.employee);

        const skillBadge = r.store === 'performance' 
            ? `<span style="padding:3px 8px; border-radius:4px; background:var(--primary); color:#fff; font-size:0.75rem; font-weight:600;">${r.skill}</span>`
            : `<span style="padding:3px 8px; border-radius:4px; background:#10b981; color:#fff; font-size:0.75rem; font-weight:600;">${r.skill}</span>`;

        const manualBadge = r.isManual 
            ? `<span class="db-manual-tag" title="Dato inserito o modificato manualmente"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Manuale</span>`
            : '';

        let displayDate = r.date || '-';
        if (r.date && r.date.includes('-')) {
            const parts = r.date.split('-');
            const m = parseInt(parts[1], 10);
            if (m >= 1 && m <= 12) displayDate = monthNames[m - 1];
        }

        tr.innerHTML = `
            <td style="white-space:nowrap; font-weight:500;">${displayDate}</td>
            <td><strong>${dispEmployee}</strong></td>
            <td>${skillBadge}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:500;">${r.metric}</span>
                    ${manualBadge}
                </div>
            </td>
            <td style="font-weight:600; text-align:center;">${r.value}</td>
            <td style="text-align:center; white-space:nowrap;">
                <button class="icon-btn edit-metric-row-btn" data-store="${r.store}" data-id="${r.recordId}" data-metric="${r.metricKey || r.metric}" title="Modifica questa riga" style="color:var(--primary); border-radius:4px; padding:4px; margin-right:4px; display:inline-flex; align-items:center; justify-content:center;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="icon-btn delete-metric-row-btn" data-store="${r.store}" data-id="${r.recordId}" data-metric="${r.metric}" title="Elimina questa riga" style="color:var(--danger, #ef4444); border-radius:4px; padding:4px; display:inline-flex; align-items:center; justify-content:center;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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

            if (confirm(`Eliminare questa riga ("${metricKey}")?`)) {
                if (store === 'sales') {
                    await appDb.deleteRecord('sales', id);
                } else {
                    const records = await appDb.getAll(store);
                    const targetRecord = records.find(x => x.id === id);
                    if (targetRecord && targetRecord.data) {
                        delete targetRecord.data[metricKey];
                        const remainingKeys = Object.keys(targetRecord.data);
                        if (remainingKeys.length === 0) {
                            await appDb.deleteRecord(store, id);
                        } else {
                            const transaction = appDb._db.transaction([store], 'readwrite');
                            transaction.objectStore(store).put(targetRecord);
                        }
                    }
                }
                logImport(`Eliminata riga "${metricKey}".`);
                await refreshYearsList();
                await renderImportedData();
                if (window.renderStatistics) window.renderStatistics();
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
    const closeBtn = modal ? modal.querySelector('.close-modal') : null;
    const saveBtn = document.getElementById('save-mapping-btn');
    const addCollabBtn = document.getElementById('modal-add-collaborator-btn');
    const selectAllCb = document.getElementById('collab-select-all');
    const bulkToolbar = document.getElementById('collab-bulk-toolbar');
    const bulkCount = document.getElementById('collab-bulk-count');
    const bulkSkillSelect = document.getElementById('collab-bulk-skill-select');
    const bulkAddSkill = document.getElementById('collab-bulk-add-skill');
    const bulkRemoveSkill = document.getElementById('collab-bulk-remove-skill');
    const bulkTemplateSelect = document.getElementById('collab-bulk-template-select');
    const bulkAssignTemplate = document.getElementById('collab-bulk-assign-template');
    const bulkDelete = document.getElementById('collab-bulk-delete');


    let deletedIds = [];

    // Aggiorna visibilità toolbar e contatore selezione
    const updateBulkToolbar = () => {
        const checked = document.querySelectorAll('#mapping-table tbody .collab-row-cb:checked');
        const count = checked.length;
        if (count > 0) {
            bulkToolbar.style.display = 'flex';
            bulkCount.textContent = count === 1 ? '1 selezionato' : `${count} selezionati`;
        } else {
            bulkToolbar.style.display = 'none';
        }
        // Aggiorna select-all
        const allCbs = document.querySelectorAll('#mapping-table tbody .collab-row-cb');
        if (selectAllCb) {
            selectAllCb.checked = allCbs.length > 0 && checked.length === allCbs.length;
            selectAllCb.indeterminate = checked.length > 0 && checked.length < allCbs.length;
        }
    };

    // Popola il select skill nella toolbar di massa
    const populateBulkSkillSelect = async () => {
        const allSkills = await getSkills();
        bulkSkillSelect.innerHTML = '';
        allSkills.forEach(skill => {
            const opt = document.createElement('option');
            opt.value = skill;
            opt.textContent = skill;
            bulkSkillSelect.appendChild(opt);
        });
    };

    // Popola il select template nella toolbar di massa
    const populateBulkTemplateSelect = async () => {
        if (!bulkTemplateSelect) return;
        const allTemplates = window.getTemplates ? await window.getTemplates() : await appDb.getSetting('stat_templates', [{ id: 'default', name: 'Default' }]);
        bulkTemplateSelect.innerHTML = '<option value="">Nessuno (Default)</option>';
        allTemplates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            bulkTemplateSelect.appendChild(opt);
        });
    };

    // Restituisce le righe selezionate
    const getSelectedRows = () => {
        return Array.from(document.querySelectorAll('#mapping-table tbody tr.mapping-row')).filter(tr => {
            const cb = tr.querySelector('.collab-row-cb');
            return cb && cb.checked;
        });
    };

    const renderMappingRow = (m, allSkills, allTemplates = [], fallbackAnonId = 1) => {
        const tr = document.createElement('tr');
        tr.className = 'mapping-row';
        tr.setAttribute('data-id', m.id || 'new');
        
        const userSkills = m.skills || [];
        const userTemplateId = m.templateId || '';
        
        const skillsHtml = allSkills.length > 0
            ? allSkills.map(skill => {
                const checked = userSkills.includes(skill) ? 'checked' : '';
                return `
                    <label class="collab-skill-tag ${checked ? 'active' : ''}">
                        <input type="checkbox" class="collab-skill-cb" value="${skill}" ${checked}>
                        <span>${skill}</span>
                    </label>
                `;
            }).join('')
            : '<span class="collab-no-skills">Nessuna skill creata</span>';

        let templateOptionsHtml = `<option value="">Nessuno (Default)</option>`;
        allTemplates.forEach(t => {
            templateOptionsHtml += `<option value="${t.id}" ${t.id === userTemplateId ? 'selected' : ''}>${t.name}</option>`;
        });

        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="collab-row-cb">
            </td>
            <td>
                <input type="text" class="collab-name-input collab-input" value="${m.realName || ''}" placeholder="Nome collaboratore...">
            </td>
            <td>
                <input type="number" class="anon-id-input collab-input text-center" value="${m.anonId !== undefined ? m.anonId : fallbackAnonId}">
            </td>
            <td>
                <div class="collab-skills-container">
                    ${skillsHtml}
                </div>
            </td>
            <td>
                <select class="collab-template-select collab-input">
                    ${templateOptionsHtml}
                </select>
            </td>
            <td style="text-align:center;">
                <button type="button" class="collab-delete-btn remove-collab-btn" title="Elimina collaboratore">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </td>
        `;

        tr.querySelector('.collab-row-cb').addEventListener('change', updateBulkToolbar);

        tr.querySelectorAll('.collab-skill-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const tag = cb.closest('.collab-skill-tag');
                if (tag) tag.classList.toggle('active', cb.checked);
            });
        });

        tr.querySelector('.remove-collab-btn').addEventListener('click', () => {
            if (m.id && typeof m.id === 'number' && m.id !== 'new') {
                deletedIds.push(m.id);
            }
            tr.remove();
            updateBulkToolbar();
        });

        return tr;
    };

    // Select all / deselect all
    if (selectAllCb) {
        selectAllCb.addEventListener('change', () => {
            const allCbs = document.querySelectorAll('#mapping-table tbody .collab-row-cb');
            allCbs.forEach(cb => { cb.checked = selectAllCb.checked; });
            updateBulkToolbar();
        });
    }

    // Azione: Assegna skill ai selezionati
    if (bulkAddSkill) {
        bulkAddSkill.addEventListener('click', () => {
            const skill = bulkSkillSelect.value;
            if (!skill) return;
            getSelectedRows().forEach(tr => {
                const cb = tr.querySelector(`.collab-skill-cb[value="${skill}"]`);
                if (cb) {
                    cb.checked = true;
                    const tag = cb.closest('.collab-skill-tag');
                    if (tag) tag.classList.add('active');
                }
            });
        });
    }

    // Azione: Rimuovi skill dai selezionati
    if (bulkRemoveSkill) {
        bulkRemoveSkill.addEventListener('click', () => {
            const skill = bulkSkillSelect.value;
            if (!skill) return;
            getSelectedRows().forEach(tr => {
                const cb = tr.querySelector(`.collab-skill-cb[value="${skill}"]`);
                if (cb) {
                    cb.checked = false;
                    const tag = cb.closest('.collab-skill-tag');
                    if (tag) tag.classList.remove('active');
                }
            });
        });
    }

    // Azione: Assegna template ai selezionati
    if (bulkAssignTemplate && bulkTemplateSelect) {
        bulkAssignTemplate.addEventListener('click', () => {
            const tplId = bulkTemplateSelect.value;
            getSelectedRows().forEach(tr => {
                const sel = tr.querySelector('.collab-template-select');
                if (sel) {
                    sel.value = tplId;
                }
            });
        });
    }

    // Azione: Elimina selezionati
    if (bulkDelete) {
        bulkDelete.addEventListener('click', () => {
            const selected = getSelectedRows();
            if (selected.length === 0) return;
            if (!confirm(`Eliminare ${selected.length} collaborator${selected.length > 1 ? 'i' : 'e'}?`)) return;
            selected.forEach(tr => {
                const dataId = tr.getAttribute('data-id');
                if (dataId && dataId !== 'new') {
                    const parsedId = parseInt(dataId);
                    if (!isNaN(parsedId)) {
                        deletedIds.push(parsedId);
                    }
                }
                tr.remove();
            });
            updateBulkToolbar();
        });
    }

    manageBtn.addEventListener('click', async () => {
        const tbody = document.querySelector('#mapping-table tbody');
        tbody.innerHTML = '';
        deletedIds = [];
        if (selectAllCb) selectAllCb.checked = false;
        bulkToolbar.style.display = 'none';
        
        const allSkills = await getSkills();
        const allTemplates = window.getTemplates ? await window.getTemplates() : await appDb.getSetting('stat_templates', [{ id: 'default', name: 'Default' }]);
        await populateBulkSkillSelect();
        await populateBulkTemplateSelect();
        const mappings = await appDb.getAll('anonymous_map', 'year', window.appState.activeYear);
        mappings.sort((a,b) => (a.realName || '').localeCompare(b.realName || ''));
        
        mappings.forEach(m => {
            tbody.appendChild(renderMappingRow(m, allSkills, allTemplates));
        });
        
        modal.classList.add('open');
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.add('open');
    });

    if (addCollabBtn) {
        addCollabBtn.addEventListener('click', async () => {
            const tbody = document.querySelector('#mapping-table tbody');
            const allSkills = await getSkills();
            const allTemplates = window.getTemplates ? await window.getTemplates() : await appDb.getSetting('stat_templates', [{ id: 'default', name: 'Default' }]);
            const inputs = Array.from(document.querySelectorAll('.anon-id-input'));
            const maxId = inputs.reduce((max, inp) => Math.max(max, parseInt(inp.value) || 0), 0);
            
            const newRow = renderMappingRow({ realName: '', anonId: maxId + 1, skills: [], templateId: '' }, allSkills, allTemplates, maxId + 1);
            tbody.appendChild(newRow);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
            const overlay = document.getElementById('modal-overlay');
            if (overlay) overlay.classList.remove('open');
        });
    }
    
    saveBtn.addEventListener('click', async () => {
        const rows = Array.from(document.querySelectorAll('#mapping-table tbody tr.mapping-row'));
        const transaction = appDb._db.transaction(['anonymous_map'], 'readwrite');
        const store = transaction.objectStore('anonymous_map');

        deletedIds.forEach(id => {
            store.delete(id);
        });

        rows.forEach(tr => {
            const dataId = tr.getAttribute('data-id');
            const realName = tr.querySelector('.collab-name-input').value.trim();
            const anonId = parseInt(tr.querySelector('.anon-id-input').value) || 1;
            const checkedSkills = Array.from(tr.querySelectorAll('.collab-skill-cb:checked')).map(cb => cb.value);
            const templateId = tr.querySelector('.collab-template-select')?.value || '';

            if (!realName) return;

            if (dataId && dataId !== 'new') {
                const req = store.get(parseInt(dataId));
                req.onsuccess = () => {
                    const data = req.result || {};
                    data.realName = realName;
                    data.anonId = anonId;
                    data.skills = checkedSkills;
                    data.templateId = templateId;
                    data.year = data.year || window.appState.activeYear;
                    store.put(data);
                };
            } else {
                store.add({
                    year: window.appState.activeYear,
                    realName: realName,
                    anonId: anonId,
                    skills: checkedSkills,
                    templateId: templateId
                });
            }
        });

        transaction.oncomplete = async () => {
            await loadAnonymousMap();
            modal.classList.remove('open');
            const overlay = document.getElementById('modal-overlay');
            if (overlay) overlay.classList.remove('open');
            if (window.renderDashboard) window.renderDashboard();
            if (window.renderStatistics) window.renderStatistics();
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

// --- RENDERING ---

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
    const subtitleEl = document.getElementById('manual-data-modal-subtitle');
    const iconSlot = document.getElementById('manual-modal-icon-badge');
    const skillLabel = document.getElementById('manual-skill-label');
    
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
        if (titleEl) titleEl.textContent = 'Modifica Dato Manuale';
        if (subtitleEl) subtitleEl.textContent = 'Modifica il dato salvato nel database';
        if (iconSlot) {
            iconSlot.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        }

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
        if (titleEl) titleEl.textContent = 'Aggiungi Dato Manuale';
        if (subtitleEl) subtitleEl.textContent = 'Inserisci un dato personalizzato nel database';
        if (iconSlot) {
            iconSlot.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
        }

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

    if (skillLabel) {
        skillLabel.textContent = storeSelect.value === 'performance' ? 'Skill:' : 'Prodotto:';
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
    if (window.renderStatistics) window.renderStatistics();
}

function setupManualDataModalListeners() {
    const addBtn = document.getElementById('add-manual-data-btn');
    const closeBtn = document.getElementById('close-manual-data-modal');
    const cancelBtn = document.getElementById('cancel-manual-data-btn');
    const saveBtn = document.getElementById('save-manual-data-btn');
    const storeSelect = document.getElementById('manual-store-type');
    const skillLabel = document.getElementById('manual-skill-label');

    if (addBtn) addBtn.addEventListener('click', () => openManualDataModal('add'));
    if (closeBtn) closeBtn.addEventListener('click', closeManualDataModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeManualDataModal);
    if (saveBtn) saveBtn.addEventListener('click', saveManualData);

    if (storeSelect) {
        storeSelect.addEventListener('change', (e) => {
            if (skillLabel) {
                skillLabel.textContent = e.target.value === 'performance' ? 'Skill:' : 'Prodotto:';
            }
            populateManualDataDatalists(e.target.value);
        });
    }
}

// Helper to detect manual records in scope and prompt user if needed
async function checkManualDataConflict(storeName, activeYear, startDate, selectedSkill) {
    const existingRecords = await appDb.getAll(storeName, 'year', activeYear);
    const manualRecords = existingRecords.filter(r => {
        if (!r.isManual && (!r.manualMetrics || Object.keys(r.manualMetrics).length === 0)) return false;
        if (startDate && r.date < startDate) return false;
        if (storeName === 'performance' && selectedSkill) {
            return (r.skill || '') === selectedSkill;
        }
        if (storeName === 'sales' && selectedSkill) {
            return (r.data && r.data.Product === selectedSkill) || (r.skill === selectedSkill);
        }
        return true;
    });

    if (manualRecords.length === 0) return 'none';

    let totalManualCount = 0;
    manualRecords.forEach(r => {
        if (r.manualMetrics && Object.keys(r.manualMetrics).length > 0) {
            totalManualCount += Object.keys(r.manualMetrics).length;
        } else {
            totalManualCount += 1;
        }
    });

    return new Promise((resolve) => {
        const modal = document.getElementById('manual-overwrite-confirm-modal');
        const overlay = document.getElementById('modal-overlay');
        const countBadge = document.getElementById('manual-conflict-count-badge');
        const preserveBtn = document.getElementById('confirm-manual-preserve-btn');
        const overwriteBtn = document.getElementById('confirm-manual-overwrite-btn');
        const cancelBtn = document.getElementById('cancel-manual-conflict-btn');
        const closeBtn = document.getElementById('close-manual-conflict-modal');
        const preserveCard = document.getElementById('manual-opt-preserve-card');
        const overwriteCard = document.getElementById('manual-opt-overwrite-card');

        if (!modal || !overlay) {
            const ans = confirm(`Attenzione: sono presenti ${totalManualCount} dati manuali o modificati nel periodo di importazione.\n\nPremi OK per MANTENERE i dati manuali.\nPremi ANNULLA per SOVRASCRIVERE anche i dati manuali.`);
            resolve(ans ? 'preserve' : 'overwrite');
            return;
        }

        if (countBadge) countBadge.textContent = `${totalManualCount}`;

        if (preserveCard && overwriteCard) {
            preserveCard.style.borderColor = 'var(--primary)';
            preserveCard.style.background = 'var(--accent-muted)';
            overwriteCard.style.borderColor = 'var(--border)';
            overwriteCard.style.background = 'var(--bg-base)';
        }

        const cleanup = () => {
            modal.classList.remove('open');
            overlay.classList.remove('open');
            preserveBtn.removeEventListener('click', onPreserve);
            overwriteBtn.removeEventListener('click', onOverwrite);
            cancelBtn.removeEventListener('click', onCancel);
            if (closeBtn) closeBtn.removeEventListener('click', onCancel);
        };

        const onPreserve = () => { cleanup(); resolve('preserve'); };
        const onOverwrite = () => { cleanup(); resolve('overwrite'); };
        const onCancel = () => { cleanup(); resolve('cancel'); };

        preserveBtn.addEventListener('click', onPreserve);
        overwriteBtn.addEventListener('click', onOverwrite);
        cancelBtn.addEventListener('click', onCancel);
        if (closeBtn) closeBtn.addEventListener('click', onCancel);

        if (preserveCard) {
            preserveCard.onclick = () => {
                preserveCard.style.borderColor = 'var(--primary)';
                preserveCard.style.background = 'var(--accent-muted)';
                overwriteCard.style.borderColor = 'var(--border)';
                overwriteCard.style.background = 'var(--bg-base)';
            };
        }
        if (overwriteCard) {
            overwriteCard.onclick = () => {
                overwriteCard.style.borderColor = 'var(--danger)';
                overwriteCard.style.background = 'rgba(220, 38, 38, 0.08)';
                preserveCard.style.borderColor = 'var(--border)';
                preserveCard.style.background = 'var(--bg-base)';
            };
        }

        modal.classList.add('open');
        overlay.classList.add('open');
    });
}

// Helper to preserve manual metrics and purely manual records into parsed data list
async function preserveManualDataInList(parsedData, storeName, activeYear, startDate, selectedSkill) {
    const existingRecords = await appDb.getAll(storeName, 'year', activeYear);
    const manualRecords = existingRecords.filter(r => {
        if (!r.isManual && (!r.manualMetrics || Object.keys(r.manualMetrics).length === 0)) return false;
        if (startDate && r.date < startDate) return false;
        if (storeName === 'performance' && selectedSkill) {
            return (r.skill || '') === selectedSkill;
        }
        if (storeName === 'sales' && selectedSkill) {
            return (r.data && r.data.Product === selectedSkill) || (r.skill === selectedSkill);
        }
        return true;
    });

    if (manualRecords.length === 0) return 0;

    const manualMap = {};
    manualRecords.forEach(r => {
        const skillKey = storeName === 'performance' ? (r.skill || '') : ((r.data && r.data.Product) || r.skill || '');
        const key = `${r.date}_${r.employee}_${skillKey}`;
        manualMap[key] = r;
    });

    const matchedKeys = new Set();
    let preservedCount = 0;

    parsedData.forEach(d => {
        const skillKey = storeName === 'performance' ? (d.skill || '') : ((d.data && d.data.Product) || d.skill || '');
        const key = `${d.date}_${d.employee}_${skillKey}`;
        const manRec = manualMap[key];
        if (manRec && manRec.data) {
            matchedKeys.add(key);
            d.isManual = true;
            d.manualMetrics = { ...(d.manualMetrics || {}), ...(manRec.manualMetrics || {}) };
            if (manRec.manualMetrics && Object.keys(manRec.manualMetrics).length > 0) {
                Object.keys(manRec.manualMetrics).forEach(mKey => {
                    if (manRec.data[mKey] !== undefined) {
                        d.data[mKey] = manRec.data[mKey];
                        preservedCount++;
                    }
                });
            } else {
                Object.entries(manRec.data).forEach(([mKey, mVal]) => {
                    d.data[mKey] = mVal;
                    preservedCount++;
                });
            }
        }
    });

    // Re-inject manual records not matched in the CSV
    manualRecords.forEach(r => {
        const skillKey = storeName === 'performance' ? (r.skill || '') : ((r.data && r.data.Product) || r.skill || '');
        const key = `${r.date}_${r.employee}_${skillKey}`;
        if (!matchedKeys.has(key)) {
            parsedData.push(r);
            preservedCount += Object.keys(r.data || {}).length;
        }
    });

    return preservedCount;
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
    const hiddenInput = monthContainer.querySelector('#wizard-month-date');
    const cards = monthContainer.querySelectorAll('.wizard-month-card');

    if (!hiddenInput) return;

    let defaultCard = Array.from(cards).find(c => c.getAttribute('data-value') === currentMonthVal);
    if (!defaultCard && cards.length > 0) defaultCard = cards[0];

    cards.forEach(c => c.classList.remove('active'));

    if (defaultCard) {
        defaultCard.classList.add('active');
        hiddenInput.value = defaultCard.getAttribute('data-value');
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

    const wizardMonthContainer = document.getElementById('wizard-month-select');
    if (wizardMonthContainer) {
        wizardMonthContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.wizard-month-card');
            if (!card) return;
            const cards = wizardMonthContainer.querySelectorAll('.wizard-month-card');
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            const val = card.getAttribute('data-value');
            const hiddenInput = document.getElementById('wizard-month-date');
            if (hiddenInput) hiddenInput.value = val;
            wizardState.month = val;
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
                let targetSkillFilter = null;
                if (wizardState.type === 'performance') {
                    const skillSelect = document.getElementById('wizard-perf-skill-select');
                    selectedSkill = skillSelect ? skillSelect.value : wizardState.skill;
                    if (!selectedSkill) {
                        alert("Seleziona uno skill.");
                        submitBtn.disabled = false;
                        return;
                    }
                    targetSkillFilter = selectedSkill;
                    logImport(`Avvio importazione file ${wizardState.file.name} per lo skill "${selectedSkill}"...`);
                } else {
                    targetSkillFilter = wizardState.salesType === 'aoit' ? 'AOIT' : 'Nuovi Abo';
                    logImport(`Avvio importazione file ${wizardState.file.name} per Sales ("${targetSkillFilter}")...`);
                }

                const conflictDecision = await checkManualDataConflict(storeName, window.appState.activeYear, startDate, targetSkillFilter);
                if (conflictDecision === 'cancel') {
                    logImport(`Importazione annullata dall'utente.`);
                    if (statusBadge) {
                        statusBadge.textContent = 'Importazione Annullata';
                        statusBadge.style.background = 'var(--bg-base)';
                        statusBadge.style.color = 'var(--text-muted)';
                    }
                    submitBtn.disabled = false;
                    return;
                }

                const parsed = await CSVParser.parse(wizardState.file, startDate);
                logImport(`Analisi CSV completata. Record estratti dal file: ${parsed.data.length}.`);

                if (wizardState.type === 'performance') {
                    parsed.data.forEach(d => { d.skill = selectedSkill; });
                }

                if (conflictDecision === 'preserve') {
                    const preserved = await preserveManualDataInList(parsed.data, storeName, window.appState.activeYear, startDate, targetSkillFilter);
                    if (preserved > 0) {
                        logImport(`Preservati ${preserved} dati inseriti/modificati manualmente.`);
                    }
                }

                if (startDate) {
                    if (wizardState.type === 'performance') {
                        await appDb.deleteFromDate('performance', startDate, selectedSkill);
                        logImport(`Eliminati vecchi dati performance ("${selectedSkill}") da mese ${monthVal}/${window.appState.activeYear} in poi.`);
                    } else {
                        const salesSkill = wizardState.salesType === 'aoit' ? 'AOIT' : 'Nuovi Abo';
                        await appDb.deleteFromDate('sales', startDate, salesSkill);
                        logImport(`Eliminati vecchi dati Sales ("${salesSkill}") da mese ${monthVal}/${window.appState.activeYear} in poi.`);
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
                if (window.renderStatistics) window.renderStatistics();

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



