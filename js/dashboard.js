// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('dash-tolerance-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (window.renderDashboard) window.renderDashboard();
        });
    }

    const skillFilter = document.getElementById('dash-tolerance-filter-skill');
    if (skillFilter) {
        skillFilter.addEventListener('change', () => {
            if (window.renderDashboard) window.renderDashboard();
        });
    }
});

// Helper function to extract numeric value for employee & metric
function calculateEmployeeMetricValue(employee, metricStr, skillFilter, perfData, salesData) {
    let isSales = metricStr.startsWith('Sales: ');
    let metricName = metricStr.replace('Performance: ', '').replace('Sales: ', '');

    if (isSales) {
        const records = salesData.filter(d => d.employee === employee && d.data && d.data[metricName] !== undefined);
        if (records.length === 0) return 0;
        return records.reduce((sum, r) => sum + (parseFloat(r.data[metricName]) || 0), 0);
    } else {
        let records = perfData.filter(d => d.employee === employee && d.data && d.data[metricName] !== undefined);
        if (skillFilter && skillFilter !== 'ALL') {
            records = records.filter(d => d.skill === skillFilter);
        }
        if (records.length === 0) return 0;
        const sum = records.reduce((acc, r) => acc + (parseFloat(r.data[metricName]) || 0), 0);
        return sum / records.length;
    }
}

// Helper to calculate team aggregate value for a metric
function calculateTeamMetricValue(metricStr, skillFilter, perfData, salesData, activeEmployees) {
    if (activeEmployees.length === 0) return 0;
    const values = activeEmployees.map(emp => calculateEmployeeMetricValue(emp, metricStr, skillFilter, perfData, salesData));
    const isSales = metricStr.startsWith('Sales: ');
    if (isSales) {
        return values.reduce((a, b) => a + b, 0);
    } else {
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / activeEmployees.length;
    }
}

window.renderDashboard = async function() {
    const year = window.appState.activeYear;
    const perfData = await appDb.getAll('performance', 'year', year);
    const salesData = await appDb.getAll('sales', 'year', year);
    const goals = await appDb.getAll('goals', 'year', year);

    // Get all unique active collaborators
    const activeEmployeesSet = new Set();
    perfData.forEach(d => { if (d.employee) activeEmployeesSet.add(d.employee); });
    salesData.forEach(d => { if (d.employee) activeEmployeesSet.add(d.employee); });
    const activeEmployees = Array.from(activeEmployeesSet).sort();

    renderCollaboratorsSummary(activeEmployees, perfData, salesData);
    renderTeamGoalsProgress(goals, perfData, salesData, activeEmployees);
    await renderToleranceViolations(goals, perfData, salesData, activeEmployees);
};

// 1. Collaborators Summary & Breakdown by Skill
async function renderCollaboratorsSummary(activeEmployees, perfData, salesData) {
    const summaryContainer = document.getElementById('dashboard-collab-summary');
    if (!summaryContainer) return;

    // Get skills list
    const configuredSkills = await appDb.getSetting('skills', []);
    const skillCounts = {};
    configuredSkills.forEach(s => skillCounts[s] = new Set());

    perfData.forEach(d => {
        if (d.skill && d.employee) {
            if (!skillCounts[d.skill]) skillCounts[d.skill] = new Set();
            skillCounts[d.skill].add(d.employee);
        }
    });

    let salesEmpCount = new Set();
    salesData.forEach(d => { if (d.employee) salesEmpCount.add(d.employee); });

    let skillBadgesHtml = '';
    for (const [skillName, empSet] of Object.entries(skillCounts)) {
        skillBadgesHtml += `
            <div style="padding:10px 14px; border-radius:8px; background:var(--bg-base); border:1px solid var(--border); min-width:140px;">
                <span style="display:block; font-size:0.75rem; color:var(--text-muted); font-weight:500;">${skillName}</span>
                <strong style="font-size:1.2rem; color:var(--text-main);">${empSet.size}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">collab.</span>
            </div>
        `;
    }

    if (salesEmpCount.size > 0) {
        skillBadgesHtml += `
            <div style="padding:10px 14px; border-radius:8px; background:var(--bg-base); border:1px solid var(--border); min-width:140px;">
                <span style="display:block; font-size:0.75rem; color:var(--text-muted); font-weight:500;">Sales</span>
                <strong style="font-size:1.2rem; color:var(--text-main);">${salesEmpCount.size}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">collab.</span>
            </div>
        `;
    }

    summaryContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px;">
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:48px; height:48px; border-radius:12px; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center;">
                    <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                </div>
                <div>
                    <h3 style="margin:0; font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Collaboratori Totali</h3>
                    <div style="font-size:2rem; font-weight:700; color:var(--text-main); line-height:1.1;">${activeEmployees.length}</div>
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; flex:1; justify-content:flex-end;">
                ${skillBadgesHtml}
            </div>
        </div>
    `;
}

// 2. Team Goals & Progressive Bars
function renderTeamGoalsProgress(goals, perfData, salesData, activeEmployees) {
    const goalsContainer = document.getElementById('dashboard-team-goals-container');
    if (!goalsContainer) return;

    const teamGoals = goals.filter(g => !g.employee || g.employee === '');

    if (teamGoals.length === 0) {
        goalsContainer.innerHTML = '<p style="color:var(--text-muted); padding:12px 0;">Nessun obiettivo di team impostato per l\'anno attivo.</p>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:16px;">';

    teamGoals.forEach(g => {
        const teamVal = calculateTeamMetricValue(g.metric, g.skill, perfData, salesData, activeEmployees);
        const targetVal = parseFloat(g.target) || 1;
        const pct = targetVal !== 0 ? ((teamVal / targetVal) * 100) : 0;
        const formattedPct = pct.toFixed(1);
        const clampedPct = Math.min(Math.max(pct, 0), 100);

        // Tolerance calculation
        let minVal = targetVal;
        let maxVal = targetVal;
        if (g.toleranceType === 'numeric') {
            minVal = targetVal - (parseFloat(g.toleranceMinus) || 0);
            maxVal = targetVal + (parseFloat(g.tolerancePlus) || 0);
        } else if (g.toleranceType === 'percentage') {
            minVal = targetVal * (1 - (parseFloat(g.toleranceMinus) || 0) / 100);
            maxVal = targetVal * (1 + (parseFloat(g.tolerancePlus) || 0) / 100);
        }

        let statusClass = 'success';
        if (teamVal < minVal) {
            statusClass = 'danger';
        } else if (teamVal < targetVal) {
            statusClass = 'warning';
        }

        const skillBadge = g.skill && g.skill !== 'ALL' ? ` | Skill: ${g.skill}` : '';

        html += `
            <div style="background:var(--bg-base); padding:14px 16px; border-radius:8px; border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div>
                        <strong style="font-size:0.95rem; color:var(--text-main);">${g.metric}</strong>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${skillBadge}</span>
                    </div>
                    <div style="font-weight:600; font-size:0.9rem;">
                        <span style="color:var(--text-main);">${teamVal.toFixed(1)}</span> / <span style="color:var(--text-muted);">${targetVal}</span>
                        <span style="margin-left:8px; padding:2px 8px; border-radius:12px; background:var(--bg-surface); border:1px solid var(--border); font-size:0.8rem; font-weight:600;">${formattedPct}%</span>
                    </div>
                </div>
                <div class="dash-progress-track">
                    <div class="dash-progress-fill ${statusClass}" style="width: ${clampedPct}%;"></div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    goalsContainer.innerHTML = html;
}

// 3. Tolerance Violations List ordered by Severity with Search & Filters
async function renderToleranceViolations(goals, perfData, salesData, activeEmployees) {
    const container = document.getElementById('dashboard-tolerance-container');
    const skillSelect = document.getElementById('dash-tolerance-filter-skill');
    if (!container) return;

    // Populate skill select dropdown if empty or needed
    const skillsList = await appDb.getSetting('skills', []);
    if (skillSelect && skillSelect.children.length === 0) {
        let optHtml = '<option value="ALL">Tutti gli Skill</option>';
        skillsList.forEach(s => {
            optHtml += `<option value="${s}">${s}</option>`;
        });
        skillSelect.innerHTML = optHtml;
    }

    const selectedSkill = skillSelect ? skillSelect.value : 'ALL';
    const searchInput = document.getElementById('dash-tolerance-search');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const violations = [];

    goals.forEach(g => {
        if (!g.toleranceType || g.toleranceType === 'none') return;
        const targetVal = parseFloat(g.target) || 0;
        let minVal = targetVal;
        let maxVal = targetVal;

        if (g.toleranceType === 'numeric') {
            minVal = targetVal - (parseFloat(g.toleranceMinus) || 0);
            maxVal = targetVal + (parseFloat(g.tolerancePlus) || 0);
        } else if (g.toleranceType === 'percentage') {
            minVal = targetVal * (1 - (parseFloat(g.toleranceMinus) || 0) / 100);
            maxVal = targetVal * (1 + (parseFloat(g.tolerancePlus) || 0) / 100);
        }

        // Employees to check
        const empList = g.employee ? [g.employee] : activeEmployees;

        empList.forEach(emp => {
            const actualVal = calculateEmployeeMetricValue(emp, g.metric, g.skill, perfData, salesData);
            if (actualVal < minVal || actualVal > maxVal) {
                const isUnder = actualVal < minVal;
                const scostamento = isUnder ? (minVal - actualVal) : (actualVal - maxVal);
                const severityRatio = targetVal !== 0 ? (scostamento / Math.abs(targetVal)) : scostamento;

                let severityClass = 'severity-low';
                let severityLabel = 'Lieve';
                if (severityRatio >= 0.25) {
                    severityClass = 'severity-high';
                    severityLabel = 'Critico';
                } else if (severityRatio >= 0.10) {
                    severityClass = 'severity-medium';
                    severityLabel = 'Alto';
                }

                violations.push({
                    employee: emp,
                    displayName: window.getDisplayName(emp),
                    goalMetric: g.metric,
                    goalSkill: g.skill || 'ALL',
                    target: targetVal,
                    minVal,
                    maxVal,
                    actualVal,
                    scostamento,
                    severityRatio,
                    severityClass,
                    severityLabel,
                    type: isUnder ? 'Sotto la soglia' : 'Sopra la soglia'
                });
            }
        });
    });

    // Filter by skill
    let filtered = violations;
    if (selectedSkill !== 'ALL') {
        filtered = filtered.filter(v => v.goalSkill === selectedSkill || v.goalSkill === 'ALL');
    }

    // Filter by search query (collaborator name)
    if (searchQuery) {
        filtered = filtered.filter(v => v.displayName.toLowerCase().includes(searchQuery) || v.employee.toLowerCase().includes(searchQuery));
    }

    // Sort by Severity Ratio descending (most critical first)
    filtered.sort((a, b) => b.severityRatio - a.severityRatio);

    if (filtered.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); padding:12px 0;">${violations.length === 0 ? 'Nessun collaboratore sfora le tolleranze stabilite.' : 'Nessuno sforamento trovato per i filtri selezionati.'}</p>`;
        return;
    }

    let tableHtml = `
        <div style="overflow-x:auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>${window.appState.isAnonymous ? 'Collab' : 'Collaboratore'}</th>
                        <th>Metrica / Skill</th>
                        <th>Target (Soglie)</th>
                        <th>Valore Reale</th>
                        <th>Scostamento</th>
                        <th style="text-align:center;">Gravità</th>
                    </tr>
                </thead>
                <tbody>
    `;

    filtered.forEach(v => {
        const skillStr = v.goalSkill !== 'ALL' ? ` (${v.goalSkill})` : '';
        tableHtml += `
            <tr>
                <td><strong>${v.displayName}</strong></td>
                <td>${v.goalMetric}${skillStr}</td>
                <td>${v.target} <span style="font-size:0.75rem; color:var(--text-muted);">(${v.minVal.toFixed(1)} - ${v.maxVal.toFixed(1)})</span></td>
                <td style="font-weight:600;">${v.actualVal.toFixed(1)}</td>
                <td style="color:${v.type === 'Sotto la soglia' ? 'var(--danger)' : '#f59e0b'}; font-weight:500;">
                    ${v.type === 'Sotto la soglia' ? '-' : '+'}${v.scostamento.toFixed(1)}
                </td>
                <td style="text-align:center;">
                    <span class="severity-badge ${v.severityClass}">${v.severityLabel}</span>
                </td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHtml;
}
