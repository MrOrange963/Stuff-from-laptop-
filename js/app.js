'use strict';

// ── Utilities ─────────────────────────────────────────────────────────────────

const fmt = {
    currency: (n) => '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    number: (n, dec = 0) => (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }),
    pct: (n) => (parseFloat(n) || 0).toFixed(1) + '%',
    date: (d) => d ? new Date(d).toLocaleDateString('en-US') : '—',
    varClass: (n) => parseFloat(n) >= 0 ? 'pos' : 'neg',
};

function toast(msg, type = 'info') {
    const tc = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    tc.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500);
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function downloadCSV(filename, rows, headers) {
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
        csvRows.push(headers.map(h => {
            const val = String(r[h] || '').replace(/"/g, '""');
            return `"${val}"`;
        }).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

// ── Router ────────────────────────────────────────────────────────────────────

const Router = (() => {
    let currentView = 'dashboard';
    let currentComparison = 'sov';

    function show(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const view = document.getElementById('view-' + viewId);
        if (view) view.classList.add('active');
        const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
        if (btn) btn.classList.add('active');
        currentView = viewId;
        Views.render(viewId);
    }

    function showComparison(name) {
        currentComparison = name;
        document.querySelectorAll('.comp-tab').forEach(t => t.classList.remove('active'));
        const tab = document.querySelector(`.comp-tab[data-comp="${name}"]`);
        if (tab) tab.classList.add('active');
        Views.renderComparison(name);
    }

    return { show, showComparison, getCurrent: () => currentView, getCurrentComp: () => currentComparison };
})();

// ── Import Types Config ───────────────────────────────────────────────────────

const IMPORT_GROUPS = [
    {
        label: 'Estimate Inputs',
        types: [
            { key: 'estimate', label: 'Quote / Estimate Handoff' },
            { key: 'takeoff', label: 'Takeoff Quantities' },
            { key: 'quoted-materials', label: 'Quoted Material List' },
            { key: 'quoted-tools', label: 'Quoted Tools List' },
            { key: 'quoted-equipment', label: 'Quoted Equipment List' },
            { key: 'quoted-rentals', label: 'Quoted Rental Assumptions' },
            { key: 'quoted-labor', label: 'Quoted Labor Hours' },
            { key: 'quoted-leadership', label: 'Quoted Field Leadership Hours' },
        ]
    },
    {
        label: 'Registers',
        types: [
            { key: 'sov', label: 'SOV Breakdown' },
            { key: 'cost-codes', label: 'Cost Code Register' },
            { key: 'phase-codes', label: 'Phase Code Register' },
            { key: 'work-packages', label: 'Work Package Register' },
        ]
    },
    {
        label: 'Current Spend',
        types: [
            { key: 'procurement-log', label: 'Procurement Log' },
            { key: 'po-log', label: 'PO Log' },
            { key: 'invoice-log', label: 'Invoice Log' },
            { key: 'tool-rental-log', label: 'Tool / Rental Log' },
            { key: 'equipment-log', label: 'Equipment Log' },
            { key: 'labor-report', label: 'Labor Report' },
            { key: 'leadership-report', label: 'Field Leadership Labor Report' },
        ]
    },
];

const SPEND_TYPES = new Set(['procurement-log','po-log','invoice-log','tool-rental-log','equipment-log','labor-report','leadership-report']);
const REGISTER_TYPES = new Set(['sov','cost-codes','phase-codes','work-packages']);
const ESTIMATE_TYPES = new Set(['estimate','takeoff','quoted-materials','quoted-tools','quoted-equipment','quoted-rentals','quoted-labor','quoted-leadership']);

const CATEGORIES = ['Material','Tools','Equipment','Rentals','Subcontract','Field Labor','Field Leadership','General Conditions','Other / Unclassified'];

// ── Import Module ─────────────────────────────────────────────────────────────

const ImportModule = (() => {
    let activeType = null;
    let previewRows = [];

    function init() {
        const sidebar = document.getElementById('import-sidebar');
        sidebar.innerHTML = IMPORT_GROUPS.map(g => `
            <div class="import-group">
                <div class="import-group-label">${esc(g.label)}</div>
                ${g.types.map(t => `<div class="import-type-item" data-type="${t.key}">${esc(t.label)}</div>`).join('')}
            </div>
        `).join('');
        sidebar.querySelectorAll('.import-type-item').forEach(el => {
            el.addEventListener('click', () => selectType(el.dataset.type));
        });
    }

    function selectType(type) {
        activeType = type;
        document.querySelectorAll('.import-type-item').forEach(el => el.classList.remove('active'));
        const active = document.querySelector(`.import-type-item[data-type="${type}"]`);
        if (active) active.classList.add('active');
        previewRows = [];
        renderImportContent(type);
    }

    function renderImportContent(type) {
        const cols = Classifier.IMPORT_COLUMNS[type] || [];
        const label = IMPORT_GROUPS.flatMap(g => g.types).find(t => t.key === type)?.label || type;
        const content = document.getElementById('import-content');
        const isSpend = SPEND_TYPES.has(type);
        const isRegister = REGISTER_TYPES.has(type);

        content.innerHTML = `
            <div class="import-header">
                <h2>${esc(label)}</h2>
                <p class="import-subtitle">Expected columns: <code>${cols.join(', ')}</code></p>
            </div>
            <div class="import-actions">
                <label class="btn btn-secondary">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"/></svg>
                    Upload CSV
                    <input type="file" id="file-input-csv" accept=".csv" style="display:none">
                </label>
                <label class="btn btn-secondary">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"/></svg>
                    Upload Excel
                    <input type="file" id="file-input-excel" accept=".xlsx,.xls" style="display:none">
                </label>
                <button class="btn btn-outline" id="btn-manual-entry">+ Manual Entry</button>
                <button class="btn btn-outline" id="btn-download-template">Download Template</button>
            </div>
            <div id="manual-entry-panel" class="manual-entry-panel" style="display:none">
                ${buildManualForm(type, cols)}
            </div>
            <div id="import-preview" class="import-preview" style="display:none">
                <div class="preview-header">
                    <h3>Preview (<span id="preview-count">0</span> rows)</h3>
                    <div>
                        <button class="btn btn-outline btn-sm" id="btn-clear-preview">Clear</button>
                        <button class="btn btn-primary" id="btn-confirm-import">Import All</button>
                    </div>
                </div>
                <div class="table-scroll">
                    <table id="preview-table" class="data-table"><thead></thead><tbody></tbody></table>
                </div>
            </div>
        `;

        document.getElementById('file-input-csv').addEventListener('change', handleCSV);
        document.getElementById('file-input-excel').addEventListener('change', handleExcel);
        document.getElementById('btn-manual-entry').addEventListener('click', toggleManual);
        document.getElementById('btn-download-template').addEventListener('click', () => downloadTemplate(type, cols));
        document.getElementById('btn-clear-preview')?.addEventListener('click', clearPreview);
        document.getElementById('btn-confirm-import')?.addEventListener('click', confirmImport);

        const manualForm = document.getElementById('manual-form');
        if (manualForm) manualForm.addEventListener('submit', handleManualSubmit);
    }

    function buildManualForm(type, cols) {
        const sovOpts = DataStore.sov.getAll().map(s => `<option value="${s.id}">${esc(s.lineNumber + ' - ' + s.description)}</option>`).join('');
        const wpOpts = DataStore.workPackages.getAll().map(w => `<option value="${w.id}">${esc(w.code + ' - ' + w.name)}</option>`).join('');
        const ccOpts = DataStore.costCodes.getAll().map(c => `<option value="${c.id}">${esc(c.code + ' - ' + c.description)}</option>`).join('');

        const fieldHtml = cols.map(col => {
            const label = col.replace(/([A-Z])/g, ' $1').replace(/ref$/i, '').trim();
            const labelCap = label.charAt(0).toUpperCase() + label.slice(1);

            if (col === 'sovLineRef') return `<div class="form-group"><label>${labelCap}</label><select name="${col}"><option value="">-- Select SOV Line --</option>${sovOpts}</select></div>`;
            if (col === 'workPackageRef') return `<div class="form-group"><label>${labelCap}</label><select name="${col}"><option value="">-- Select Work Package --</option>${wpOpts}</select></div>`;
            if (col === 'category') return `<div class="form-group"><label>${labelCap}</label><select name="${col}"><option value="">-- Select --</option>${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></div>`;
            if (col === 'date') return `<div class="form-group"><label>${labelCap}</label><input type="date" name="${col}"></div>`;
            if (['amount','totalCost','unitCost','qty','dailyRate','duration','rate','quotedHours','hourlyRate','budgetAmount','laborHours'].includes(col))
                return `<div class="form-group"><label>${labelCap}</label><input type="number" step="any" name="${col}" placeholder="0.00"></div>`;
            return `<div class="form-group"><label>${labelCap}</label><input type="text" name="${col}"></div>`;
        }).join('');

        return `<form id="manual-form" class="manual-form"><div class="form-grid">${fieldHtml}</div><button type="submit" class="btn btn-primary">Add Row</button></form>`;
    }

    function toggleManual() {
        const panel = document.getElementById('manual-entry-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    function handleManualSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const data = {};
        new FormData(form).forEach((val, key) => { data[key] = val; });
        previewRows.push(data);
        form.reset();
        renderPreview();
        toast('Row added to preview', 'success');
    }

    function handleCSV(e) {
        const file = e.target.files[0];
        if (!file) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                previewRows = results.data;
                renderPreview();
                toast(`Loaded ${previewRows.length} rows from CSV`, 'success');
            },
            error: (err) => toast('CSV parse error: ' + err.message, 'error'),
        });
        e.target.value = '';
    }

    function handleExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                previewRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                renderPreview();
                toast(`Loaded ${previewRows.length} rows from Excel`, 'success');
            } catch (err) {
                toast('Excel parse error: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    }

    function renderPreview() {
        const preview = document.getElementById('import-preview');
        const countEl = document.getElementById('preview-count');
        if (!preview) return;
        preview.style.display = 'block';
        countEl.textContent = previewRows.length;
        if (!previewRows.length) { preview.style.display = 'none'; return; }
        const keys = Object.keys(previewRows[0]);
        const thead = document.querySelector('#preview-table thead');
        const tbody = document.querySelector('#preview-table tbody');
        thead.innerHTML = '<tr>' + keys.map(k => `<th>${esc(k)}</th>`).join('') + '</tr>';
        tbody.innerHTML = previewRows.slice(0, 50).map(r =>
            '<tr>' + keys.map(k => `<td>${esc(r[k])}</td>`).join('') + '</tr>'
        ).join('');
        if (previewRows.length > 50) {
            tbody.innerHTML += `<tr><td colspan="${keys.length}" class="muted">… ${previewRows.length - 50} more rows</td></tr>`;
        }
    }

    function clearPreview() {
        previewRows = [];
        const preview = document.getElementById('import-preview');
        if (preview) preview.style.display = 'none';
    }

    function confirmImport() {
        if (!previewRows.length) { toast('No rows to import', 'warning'); return; }
        const store = DataStore.getStore();
        const type = activeType;

        if (REGISTER_TYPES.has(type)) {
            importRegisters(type, previewRows, store);
        } else if (ESTIMATE_TYPES.has(type)) {
            importEstimateData(type, previewRows, store);
        } else if (SPEND_TYPES.has(type)) {
            importSpend(type, previewRows, store);
        }

        clearPreview();
        Views.render('dashboard');
    }

    function importRegisters(type, rows, store) {
        const keyMap = {
            'sov': ['lineNumber','description','totalValue'],
            'cost-codes': ['code','description','category'],
            'phase-codes': ['code','description'],
            'work-packages': ['code','name','description','sovLineRef','budgetAmount'],
        };
        const mapping = {
            'sov': DataStore.sov,
            'cost-codes': DataStore.costCodes,
            'phase-codes': DataStore.phaseCodes,
            'work-packages': DataStore.workPackages,
        };
        const api = mapping[type];
        const fields = keyMap[type];
        api.clear();
        rows.forEach(r => {
            const item = {};
            fields.forEach(f => { item[f] = r[f] || r[f.toLowerCase()] || r[toCamel(f)] || ''; });
            if (type === 'work-packages') {
                // Resolve SOV line ref
                const sovRef = item.sovLineRef;
                const sovLine = store.sov.find(s => s.lineNumber === sovRef || s.description === sovRef);
                if (sovLine) item.sovLineId = sovLine.id;
            }
            api.add(item);
        });
        toast(`Imported ${rows.length} ${type} entries`, 'success');
    }

    function importEstimateData(type, rows, store) {
        const apiMap = {
            'estimate': DataStore.estimates,
            'takeoff': DataStore.takeoffItems,
            'quoted-materials': DataStore.quotedMaterials,
            'quoted-tools': DataStore.quotedTools,
            'quoted-equipment': DataStore.quotedEquipment,
            'quoted-rentals': DataStore.quotedRentals,
            'quoted-labor': DataStore.quotedLaborHours,
            'quoted-leadership': DataStore.quotedLeadershipHours,
        };
        const api = apiMap[type];
        api.clear();
        rows.forEach(r => {
            const item = normalizeRow(r);
            // Resolve work package
            resolveRefs(item, store);
            api.add(item);
        });
        toast(`Imported ${rows.length} ${type} entries`, 'success');
    }

    function importSpend(type, rows, store) {
        const sourceType = Classifier.SOURCE_TYPE_MAP[type] || type;
        const items = rows.map(r => {
            const item = normalizeRow(r);
            item.sourceType = sourceType;
            resolveRefs(item, store);
            return item;
        });
        const classified = Classifier.classifyBatch(items, store);
        DataStore.spend.bulkAdd(classified);
        toast(`Imported & classified ${classified.length} spend items`, 'success');
        DataStore.addAudit('import', `Imported ${classified.length} items from ${type}`, 'PM');
    }

    function normalizeRow(r) {
        const out = {};
        Object.entries(r).forEach(([k, v]) => { out[k.trim()] = v; });
        // Normalize amount fields
        ['amount','totalCost','unitCost','qty','quotedHours','hourlyRate','budgetAmount','laborHours','dailyRate','duration','rate'].forEach(f => {
            if (out[f] !== undefined) out[f] = parseFloat(String(out[f]).replace(/[$,]/g, '')) || 0;
        });
        return out;
    }

    function resolveRefs(item, store) {
        if (item.workPackageRef || item.workPackage) {
            const ref = item.workPackageRef || item.workPackage;
            const wp = store.workPackages.find(w => w.code === ref || w.name === ref || w.id === ref);
            if (wp) item.workPackageId = wp.id;
        }
        if (item.sovLineRef || item.sovLine) {
            const ref = item.sovLineRef || item.sovLine;
            const sov = store.sov.find(s => s.lineNumber === ref || s.id === ref);
            if (sov) item.sovLineId = sov.id;
        }
    }

    function downloadTemplate(type, cols) {
        downloadCSV(`template_${type}.csv`, [], cols);
        toast('Template downloaded', 'info');
    }

    function toCamel(str) {
        return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    }

    return { init, selectType };
})();

// ── Views ─────────────────────────────────────────────────────────────────────

const Views = {
    render(viewId) {
        switch (viewId) {
            case 'dashboard': this.renderDashboard(); break;
            case 'review': this.renderReview(); break;
            case 'comparisons': this.renderComparison(Router.getCurrentComp()); break;
            case 'settings': this.renderSettings(); break;
        }
    },

    // ── Dashboard ─────────────────────────────────────────────────────────────

    renderDashboard() {
        const d = DataStore.calcDashboard();
        const info = DataStore.getProjectInfo();

        document.getElementById('dash-project-name').textContent = info.name || 'No Project Loaded';
        document.getElementById('dash-project-meta').textContent =
            [info.number, info.client, info.pm].filter(Boolean).join(' · ') || 'Go to Settings to configure project info';
        const badge = document.getElementById('sidebar-project-badge');
        if (badge) badge.textContent = info.name ? `${info.number || ''} ${info.name}`.trim() : 'No Project';

        const cards = [
            { id: 'card-quoted',    label: 'Total Quoted Budget',            value: fmt.currency(d.quotedBudget),    cls: '', drill: null },
            { id: 'card-committed', label: 'Current Committed Cost',         value: fmt.currency(d.committed),       cls: '', drill: {special:'committed'} },
            { id: 'card-actual',    label: 'Current Actual Cost',            value: fmt.currency(d.actual),          cls: '', drill: {special:'invoiced'} },
            { id: 'card-forecast',  label: 'Forecast Remaining Cost',        value: fmt.currency(d.forecastRemaining), cls: '', drill: null },
            { id: 'card-eac',       label: 'Estimate at Completion (EAC)',   value: fmt.currency(d.eac),             cls: '', drill: null },
            { id: 'card-variance',  label: 'Variance (Budget − EAC)',        value: fmt.currency(d.variance),        cls: fmt.varClass(d.variance), drill: null },
            { id: 'card-unclass',   label: 'Unclassified Spend Items',       value: fmt.number(d.unclassified),      cls: d.unclassified > 0 ? 'warn' : '', drill: {special:'unclassified'} },
            { id: 'card-lowconf',   label: 'Low-Confidence (Pending Review)',value: fmt.number(d.lowConf),           cls: d.lowConf > 0 ? 'warn' : '', drill: {confidence:'Low', status:'Pending'} },
            { id: 'card-pending',   label: 'Pending Review Items',           value: fmt.number(d.pendingCount || DataStore.spend.getAll().filter(x=>x.reviewStatus==='Pending').length), cls: '', drill: {status:'Pending'} },
            { id: 'card-matvar',    label: 'Material Variance',              value: fmt.currency(d.matVariance),     cls: fmt.varClass(d.matVariance), drill: {category:'Material'} },
            { id: 'card-laborvar',  label: 'Labor Hour Variance',            value: fmt.number(d.laborHrVariance) + ' hrs', cls: fmt.varClass(d.laborHrVariance), drill: {category:'Field Labor'} },
            { id: 'card-ldvar',     label: 'Field Leadership Variance',      value: fmt.currency(d.ldVariance),      cls: fmt.varClass(d.ldVariance), drill: {category:'Field Leadership'} },
        ];

        const grid = document.getElementById('dash-cards');
        grid.innerHTML = cards.map(c => `
            <div class="stat-card ${c.cls}${c.drill ? ' clickable' : ''}" data-drill='${c.drill ? JSON.stringify(c.drill) : ''}'>
                <div class="stat-label">${esc(c.label)}</div>
                <div class="stat-value">${esc(c.value)}</div>
                ${c.drill ? '<div class="stat-drill-hint">Click to view items →</div>' : ''}
            </div>
        `).join('');

        grid.querySelectorAll('.stat-card.clickable').forEach(card => {
            card.addEventListener('click', () => {
                const spec = JSON.parse(card.dataset.drill || '{}');
                drillToReview(spec);
            });
        });

        // Alerts
        const alerts = [];
        if (d.unclassified > 0) alerts.push({ type: 'warn', msg: `${d.unclassified} spend item(s) are unclassified and require PM review.` });
        if (d.lowConf > 0) alerts.push({ type: 'warn', msg: `${d.lowConf} item(s) have low-confidence classifications pending review. These do NOT affect EAC until approved.` });
        if (d.variance < 0) alerts.push({ type: 'error', msg: `Project is over budget by ${fmt.currency(Math.abs(d.variance))}.` });

        const alertBox = document.getElementById('dash-alerts');
        alertBox.innerHTML = alerts.length ? alerts.map(a => `<div class="alert alert-${a.type}">${esc(a.msg)}</div>`).join('') : '<div class="alert alert-ok">No alerts. Project data looks good.</div>';

        // Spend count info
        const spend = DataStore.spend.getAll();
        const approved = spend.filter(x => x.reviewStatus === 'Approved').length;
        const pending = spend.filter(x => x.reviewStatus === 'Pending').length;
        const rejected = spend.filter(x => x.reviewStatus === 'Rejected').length;
        document.getElementById('dash-spend-summary').innerHTML = `
            <span class="badge badge-success">Approved: ${approved}</span>
            <span class="badge badge-warn">Pending: ${pending}</span>
            <span class="badge badge-error">Rejected: ${rejected}</span>
            <span class="badge">Total: ${spend.length}</span>
        `;
    },

    // ── Review & Classify ─────────────────────────────────────────────────────

    renderReview(filters = {}) {
        const items = DataStore.spend.getAll();
        const store = DataStore.getStore();

        // Apply special drill-down filters first
        let filtered = items;
        if (filters.special === 'unclassified') {
            filtered = filtered.filter(x => !x.approvedCategory && !x.suggestedCategory);
        } else if (filters.special === 'committed') {
            filtered = filtered.filter(x => x.committed === true);
        } else if (filters.special === 'invoiced') {
            filtered = filtered.filter(x => x.invoiced === true);
        }

        // Apply standard filters
        if (filters.status && filters.status !== 'all') filtered = filtered.filter(x => x.reviewStatus === filters.status);
        if (filters.confidence && filters.confidence !== 'all') filtered = filtered.filter(x => x.confidence === filters.confidence);
        if (filters.category && filters.category !== 'all') filtered = filtered.filter(x => (x.approvedCategory || x.suggestedCategory) === filters.category);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(x => (x.description || '').toLowerCase().includes(q) || (x.vendorEmployee || '').toLowerCase().includes(q) || (x.spendId || '').toLowerCase().includes(q));
        }

        const tbody = document.querySelector('#review-table tbody');
        const countEl = document.getElementById('review-count');
        countEl.textContent = `${filtered.length} of ${items.length} items`;

        const sovById = Object.fromEntries(store.sov.map(s => [s.id, s.description]));
        const wpById = Object.fromEntries(store.workPackages.map(w => [w.id, w.name]));

        tbody.innerHTML = filtered.length ? filtered.map(item => {
            const cat = item.approvedCategory || item.suggestedCategory || '—';
            const sov = sovById[item.approvedSOVLine || item.suggestedSOVLine] || '—';
            const wp = wpById[item.approvedWorkPackage || item.suggestedWorkPackage] || '—';
            const confBadge = item.confidence === 'High' ? 'badge-success' : item.confidence === 'Medium' ? 'badge-warn' : 'badge-error';
            const statusBadge = item.reviewStatus === 'Approved' ? 'badge-success' : item.reviewStatus === 'Rejected' ? 'badge-error' : 'badge-warn';
            return `<tr data-id="${item.id}">
                <td class="mono">${esc(item.spendId)}</td>
                <td>${fmt.date(item.date)}</td>
                <td>${esc(item.sourceType)}</td>
                <td>${esc(item.vendorEmployee)}</td>
                <td class="desc-cell" title="${esc(item.description)}">${esc(item.description)}</td>
                <td class="text-right">${fmt.currency(item.amount)}</td>
                <td>${esc(cat)}</td>
                <td class="text-right text-sm">${esc(sov)}</td>
                <td class="text-sm">${esc(wp)}</td>
                <td><span class="badge ${confBadge}">${esc(item.confidence || '—')}</span></td>
                <td><span class="badge ${statusBadge}">${esc(item.reviewStatus)}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-success" onclick="ReviewActions.approve('${item.id}')">✓</button>
                    <button class="btn btn-sm btn-outline" onclick="ReviewActions.edit('${item.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="ReviewActions.reject('${item.id}')">✗</button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="12" class="empty-state">No items match the current filters.</td></tr>';
    },

    // ── Comparisons ───────────────────────────────────────────────────────────

    renderComparison(name) {
        const el = document.getElementById('comparison-content');
        switch (name) {
            case 'sov':          el.innerHTML = this.buildSOVTable(); break;
            case 'workpackage':  el.innerHTML = this.buildWPTable(); break;
            case 'labor':        el.innerHTML = this.buildLaborTable(); break;
            case 'leadership':   el.innerHTML = this.buildLeadershipTable(); break;
            case 'material':     el.innerHTML = this.buildMaterialTable(); break;
            case 'tools':        el.innerHTML = this.buildToolEquipTable('Tools'); break;
            case 'equipment':    el.innerHTML = this.buildToolEquipTable('Equipment'); break;
            default:             el.innerHTML = '<p class="empty-state">Select a comparison view.</p>';
        }
    },

    buildSOVTable() {
        const rows = DataStore.calcSOVSummary();
        if (!rows.length) return '<p class="empty-state">No SOV data loaded. Import your SOV Breakdown first.</p>';
        const html = rows.map(r => `<tr>
            <td>${esc(r.lineNumber)}</td>
            <td>${esc(r.description)}</td>
            <td class="text-right">${fmt.currency(r.budget)}</td>
            <td class="text-right">${fmt.currency(r.actual)}</td>
            <td class="text-right">${fmt.currency(r.forecast)}</td>
            <td class="text-right">${fmt.currency(r.eac)}</td>
            <td class="text-right ${fmt.varClass(r.variance)}">${fmt.currency(r.variance)}</td>
            <td class="text-right ${fmt.varClass(r.variance)}">${fmt.pct(r.variancePct)}</td>
            <td><span class="risk-badge risk-${r.riskLevel.toLowerCase()}">${r.riskLevel}</span></td>
        </tr>`).join('');
        return this.wrapTable('SOV Cost Summary', ['SOV Line','Description','Quoted Budget','Current Actual','Forecast Remaining','EAC','Variance','Variance %','Risk'], html, 'sov');
    },

    buildWPTable() {
        const rows = DataStore.calcWPSummary();
        if (!rows.length) return '<p class="empty-state">No Work Package data loaded.</p>';
        const html = rows.map(r => `<tr>
            <td class="mono">${esc(r.code)}</td>
            <td>${esc(r.name)}</td>
            <td class="text-right">${fmt.currency(r.budget)}</td>
            <td class="text-right">${fmt.currency(r.actual)}</td>
            <td class="text-right">${fmt.currency(r.forecast)}</td>
            <td class="text-right">${fmt.currency(r.eac)}</td>
            <td class="text-right ${fmt.varClass(r.variance)}">${fmt.currency(r.variance)}</td>
            <td class="text-right ${fmt.varClass(r.variance)}">${fmt.pct(r.variancePct)}</td>
            <td><span class="risk-badge risk-${r.riskLevel.toLowerCase()}">${r.riskLevel}</span></td>
        </tr>`).join('');
        return this.wrapTable('Work Package Cost Summary', ['Code','Work Package','Quoted Budget','Current Actual','Forecast Remaining','EAC','Variance','Variance %','Risk'], html, 'workpackage');
    },

    buildLaborTable() {
        const rows = DataStore.calcLaborSummary();
        if (!rows.length) return '<p class="empty-state">No labor data. Import Quoted Labor Hours and a Labor Report.</p>';
        const html = rows.map(r => `<tr>
            <td>${esc(r.wp.name)}</td>
            <td>Field Labor</td>
            <td class="text-right">${fmt.number(r.quotedHrs, 1)}</td>
            <td class="text-right">${fmt.number(r.actualHrs, 1)}</td>
            <td class="text-right">${fmt.number(r.forecastHrs, 1)}</td>
            <td class="text-right">${fmt.number(r.eacHrs, 1)}</td>
            <td class="text-right ${fmt.varClass(r.hrVariance)}">${fmt.number(r.hrVariance, 1)}</td>
            <td class="text-right">${fmt.currency(r.quotedCost)}</td>
            <td class="text-right">${fmt.currency(r.actualCost)}</td>
            <td class="text-right">${fmt.currency(r.forecastCost)}</td>
            <td class="text-right">${fmt.currency(r.eacCost)}</td>
            <td class="text-right ${fmt.varClass(r.costVariance)}">${fmt.currency(r.costVariance)}</td>
        </tr>`).join('');
        return this.wrapTable('Labor Comparison', ['Work Package','Labor Type','Quoted Hrs','Actual Hrs','Forecast Hrs','EAC Hrs','Hr Variance','Quoted Cost','Actual Cost','Forecast Cost','EAC Cost','Cost Variance'], html, 'labor');
    },

    buildLeadershipTable() {
        const rows = DataStore.calcLeadershipSummary();
        if (!rows.length) return '<p class="empty-state">No field leadership data. Import Quoted Field Leadership Hours and a Leadership Report.</p>';
        const html = rows.map(r => `<tr>
            <td>${esc(r.wp.name)}</td>
            <td>Field Leadership</td>
            <td class="text-right">${fmt.number(r.quotedHrs, 1)}</td>
            <td class="text-right">${fmt.number(r.actualHrs, 1)}</td>
            <td class="text-right">${fmt.number(r.forecastHrs, 1)}</td>
            <td class="text-right">${fmt.number(r.eacHrs, 1)}</td>
            <td class="text-right ${fmt.varClass(r.hrVariance)}">${fmt.number(r.hrVariance, 1)}</td>
            <td class="text-right">${fmt.currency(r.quotedCost)}</td>
            <td class="text-right">${fmt.currency(r.actualCost)}</td>
            <td class="text-right">${fmt.currency(r.forecastCost)}</td>
            <td class="text-right">${fmt.currency(r.eacCost)}</td>
            <td class="text-right ${fmt.varClass(r.costVariance)}">${fmt.currency(r.costVariance)}</td>
        </tr>`).join('');
        return this.wrapTable('Field Leadership Comparison', ['Work Package','Labor Type','Quoted Hrs','Actual Hrs','Forecast Hrs','EAC Hrs','Hr Variance','Quoted Cost','Actual Cost','Forecast Cost','EAC Cost','Cost Variance'], html, 'leadership');
    },

    buildMaterialTable() {
        const rows = DataStore.calcMaterialComparison();
        if (!rows.length) return '<p class="empty-state">No material data. Import Quoted Material List first.</p>';
        const html = rows.map(r => {
            const variance = (parseFloat(r.totalCost) || 0) - (parseFloat(r.invoicedCost) || 0);
            return `<tr>
                <td>${esc(r.description)}</td>
                <td>${esc(r.vendor || '—')}</td>
                <td class="text-right">${fmt.number(r.qty, 2)}</td>
                <td>${esc(r.unit || '—')}</td>
                <td class="text-right">${fmt.currency(r.totalCost)}</td>
                <td class="text-right">${fmt.number(r.procuredQty, 2)}</td>
                <td class="text-right">${fmt.currency(r.procuredCost)}</td>
                <td class="text-right">${fmt.currency(r.invoicedCost)}</td>
                <td class="text-right ${fmt.varClass(variance)}">${fmt.currency(variance)}</td>
            </tr>`;
        }).join('');
        return this.wrapTable('Material Comparison', ['Description','Vendor','Quoted Qty','Unit','Quoted Cost','Procured Qty','Procured Cost','Invoiced Cost','Variance'], html, 'material');
    },

    buildToolEquipTable(category) {
        const rows = DataStore.calcToolEquipComparison(category);
        if (!rows.length) return `<p class="empty-state">No ${category.toLowerCase()} data. Import Quoted ${category} List first.</p>`;
        const html = rows.map(r => {
            const roiRec = r.variance >= 0 ? 'On Budget' : r.variance >= -(parseFloat(r.totalCost) || 0) * 0.1 ? 'Monitor' : 'Review — Over Budget';
            return `<tr>
                <td>${esc(r.description)}</td>
                <td class="text-right">${fmt.currency(r.totalCost)}</td>
                <td class="text-right">${fmt.currency(r.rentalCost)}</td>
                <td class="text-right">${fmt.currency(r.purchaseCost)}</td>
                <td class="text-right">${fmt.currency(r.forecast)}</td>
                <td class="text-right">${fmt.currency(r.eac)}</td>
                <td class="text-right ${fmt.varClass(r.variance)}">${fmt.currency(r.variance)}</td>
                <td class="${r.variance < 0 ? 'neg' : ''}">${esc(roiRec)}</td>
                <td><span class="badge ${r.variance >= 0 ? 'badge-success' : 'badge-error'}">${r.variance >= 0 ? 'OK' : 'Over'}</span></td>
            </tr>`;
        }).join('');
        return this.wrapTable(`${category} Comparison`, ['Description','Quoted Need','Rental Cost','Purchase Cost','Forecast','EAC Cost','Variance','ROI Recommendation','Status'], html, category.toLowerCase());
    },

    wrapTable(title, headers, bodyHtml, exportKey) {
        return `
            <div class="comparison-header">
                <h2>${esc(title)}</h2>
                <button class="btn btn-outline btn-sm" onclick="ExportModule.exportComparison('${exportKey}')">Export CSV</button>
            </div>
            <div class="table-scroll">
                <table class="data-table comparison-table">
                    <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
                    <tbody>${bodyHtml}</tbody>
                </table>
            </div>`;
    },

    // ── Settings ──────────────────────────────────────────────────────────────

    renderSettings() {
        const info = DataStore.getProjectInfo();
        document.getElementById('settings-name').value = info.name || '';
        document.getElementById('settings-number').value = info.number || '';
        document.getElementById('settings-client').value = info.client || '';
        document.getElementById('settings-pm').value = info.pm || '';
        document.getElementById('settings-start').value = info.startDate || '';
        document.getElementById('settings-end').value = info.endDate || '';

        const store = DataStore.getStore();
        document.getElementById('settings-data-summary').innerHTML = `
            <div class="data-summary-grid">
                <div><strong>${store.sov.length}</strong> SOV Lines</div>
                <div><strong>${store.workPackages.length}</strong> Work Packages</div>
                <div><strong>${store.costCodes.length}</strong> Cost Codes</div>
                <div><strong>${store.phaseCodes.length}</strong> Phase Codes</div>
                <div><strong>${store.estimates.length}</strong> Estimate Items</div>
                <div><strong>${store.quotedMaterials.length}</strong> Quoted Materials</div>
                <div><strong>${store.quotedTools.length}</strong> Quoted Tools</div>
                <div><strong>${store.quotedEquipment.length}</strong> Quoted Equipment</div>
                <div><strong>${store.quotedRentals.length}</strong> Quoted Rentals</div>
                <div><strong>${store.quotedLaborHours.length}</strong> Labor Hour Records</div>
                <div><strong>${store.quotedLeadershipHours.length}</strong> Leadership Hour Records</div>
                <div><strong>${store.spendItems.length}</strong> Total Spend Items</div>
                <div><strong>${store.teamMembers?.length || 0}</strong> Team Members</div>
            </div>
        `;

        // Team & Roles sections
        RoleManager.renderRoleCards();
        RoleManager.renderTeamTable();
        RoleManager.renderRoutingTable();
    },
};

// ── Review Actions ────────────────────────────────────────────────────────────

const ReviewActions = {
    approve(id) {
        const item = DataStore.spend.getById(id);
        if (!item) return;
        DataStore.spend.update(id, {
            reviewStatus: 'Approved',
            approvedCategory: item.approvedCategory || item.suggestedCategory,
            approvedSOVLine: item.approvedSOVLine || item.suggestedSOVLine,
            approvedWorkPackage: item.approvedWorkPackage || item.suggestedWorkPackage,
            approvedCostCode: item.approvedCostCode || item.suggestedCostCode,
        }, 'PM');
        toast('Item approved', 'success');
        Views.renderReview(getCurrentFilters());
        Views.renderDashboard();
    },

    reject(id) {
        const note = prompt('Rejection reason (optional):') ?? '';
        DataStore.spend.update(id, { reviewStatus: 'Rejected', pmNotes: note }, 'PM');
        toast('Item rejected', 'info');
        Views.renderReview(getCurrentFilters());
        Views.renderDashboard();
    },

    edit(id) {
        const item = DataStore.spend.getById(id);
        if (!item) return;
        const store = DataStore.getStore();
        Modal.open(item, store);
    },

    bulkApprove(ids) {
        ids.forEach(id => this.approve(id));
        toast(`Approved ${ids.length} items`, 'success');
    },
};

function getCurrentFilters() {
    return {
        status: document.getElementById('filter-status')?.value,
        confidence: document.getElementById('filter-confidence')?.value,
        category: document.getElementById('filter-category')?.value,
        search: document.getElementById('filter-search')?.value,
    };
}

function drillToReview(spec) {
    // Reset standard filter UI
    const statusEl = document.getElementById('filter-status');
    const confEl = document.getElementById('filter-confidence');
    const catEl = document.getElementById('filter-category');
    const searchEl = document.getElementById('filter-search');
    if (statusEl) statusEl.value = spec.status || 'all';
    if (confEl) confEl.value = spec.confidence || 'all';
    if (catEl) catEl.value = spec.category || 'all';
    if (searchEl) searchEl.value = spec.search || '';

    // Navigate to review (triggers render via Router.show)
    Router.show('review');

    // Re-render with the spec (which may include special filter)
    Views.renderReview(spec);

    // Show a subtle indicator of the active drill-down context
    const countEl = document.getElementById('review-count');
    if (countEl && spec.special) {
        const labels = { unclassified: 'Unclassified', committed: 'Committed', invoiced: 'Invoiced (Actual)' };
        const tag = labels[spec.special] || spec.special;
        countEl.insertAdjacentHTML('afterend', `<span class="drill-badge" id="drill-context-badge">Filtered: ${esc(tag)} <button onclick="clearDrill()" style="background:none;border:none;cursor:pointer;font-weight:bold;margin-left:4px;">×</button></span>`);
    }
}

function clearDrill() {
    document.getElementById('drill-context-badge')?.remove();
    const statusEl = document.getElementById('filter-status');
    const confEl = document.getElementById('filter-confidence');
    const catEl = document.getElementById('filter-category');
    const searchEl = document.getElementById('filter-search');
    if (statusEl) statusEl.value = 'all';
    if (confEl) confEl.value = 'all';
    if (catEl) catEl.value = 'all';
    if (searchEl) searchEl.value = '';
    Views.renderReview({});
}

// ── Classification Editor Modal ───────────────────────────────────────────────

const Modal = {
    open(item, store) {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        overlay.classList.remove('hidden');

        const sovOpts = store.sov.map(s => `<option value="${s.id}" ${(item.approvedSOVLine || item.suggestedSOVLine) === s.id ? 'selected' : ''}>${esc(s.lineNumber + ' - ' + s.description)}</option>`).join('');
        const wpOpts = store.workPackages.map(w => `<option value="${w.id}" ${(item.approvedWorkPackage || item.suggestedWorkPackage) === w.id ? 'selected' : ''}>${esc(w.code + ' - ' + w.name)}</option>`).join('');
        const ccOpts = store.costCodes.map(c => `<option value="${c.id}" ${(item.approvedCostCode || item.suggestedCostCode) === c.id ? 'selected' : ''}>${esc(c.code + ' - ' + c.description)}</option>`).join('');

        const currentCat = item.approvedCategory || item.suggestedCategory || '';
        content.innerHTML = `
            <div class="modal-header">
                <h3>Edit Classification — ${esc(item.spendId)}</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <div class="modal-detail-row">
                    <span class="label">Description</span><span>${esc(item.description)}</span>
                </div>
                <div class="modal-detail-row">
                    <span class="label">Vendor / Employee</span><span>${esc(item.vendorEmployee)}</span>
                </div>
                <div class="modal-detail-row">
                    <span class="label">Amount</span><span>${fmt.currency(item.amount)}</span>
                </div>
                <div class="modal-detail-row">
                    <span class="label">Current Confidence</span>
                    <span class="badge ${item.confidence === 'High' ? 'badge-success' : item.confidence === 'Medium' ? 'badge-warn' : 'badge-error'}">${esc(item.confidence)}</span>
                </div>
                <hr>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Category</label>
                        <select id="edit-category">
                            ${CATEGORIES.map(c => `<option ${c === currentCat ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>SOV Line</label>
                        <select id="edit-sov"><option value="">-- None --</option>${sovOpts}</select>
                    </div>
                    <div class="form-group">
                        <label>Work Package</label>
                        <select id="edit-wp"><option value="">-- None --</option>${wpOpts}</select>
                    </div>
                    <div class="form-group">
                        <label>Cost Code</label>
                        <select id="edit-cc"><option value="">-- None --</option>${ccOpts}</select>
                    </div>
                    <div class="form-group">
                        <label>Forecast Remaining ($)</label>
                        <input type="number" step="any" id="edit-forecast" value="${item.forecastRemaining || 0}">
                    </div>
                    <div class="form-group">
                        <label>Forecast Remaining Hours</label>
                        <input type="number" step="any" id="edit-forecast-hrs" value="${item.forecastRemainingHours || 0}">
                    </div>
                </div>
                <div class="form-group">
                    <label>PM Notes</label>
                    <textarea id="edit-notes" rows="2">${esc(item.pmNotes || '')}</textarea>
                </div>
                <div class="modal-detail-row">
                    <span class="label text-sm muted">Audit History</span>
                    <span class="text-sm muted">${(item.auditHistory || []).length} changes recorded</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-danger" onclick="ReviewActions.reject('${item.id}'); Modal.close()">Reject</button>
                <button class="btn btn-primary" onclick="Modal.save('${item.id}')">Save & Approve</button>
            </div>
        `;
    },

    save(id) {
        const cat = document.getElementById('edit-category').value;
        const sov = document.getElementById('edit-sov').value;
        const wp = document.getElementById('edit-wp').value;
        const cc = document.getElementById('edit-cc').value;
        const forecast = parseFloat(document.getElementById('edit-forecast').value) || 0;
        const forecastHrs = parseFloat(document.getElementById('edit-forecast-hrs').value) || 0;
        const notes = document.getElementById('edit-notes').value;

        DataStore.spend.update(id, {
            approvedCategory: cat,
            approvedSOVLine: sov || null,
            approvedWorkPackage: wp || null,
            approvedCostCode: cc || null,
            forecastRemaining: forecast,
            forecastRemainingHours: forecastHrs,
            pmNotes: notes,
            reviewStatus: 'Approved',
            confidence: 'High',
        }, 'PM');

        toast('Classification saved and approved', 'success');
        this.close();
        Views.renderReview(getCurrentFilters());
        Views.renderDashboard();
    },

    close() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },
};

// ── Export Module ─────────────────────────────────────────────────────────────

const ExportModule = {
    exportSpend() {
        const rows = DataStore.spend.getAll();
        const headers = ['spendId','date','sourceType','vendorEmployee','description','amount','qty','unitCost','approvedCategory','suggestedCategory','confidence','reviewStatus','approvedSOVLine','approvedWorkPackage','approvedCostCode','poNumber','invoiceNumber','pmNotes','forecastRemaining','importedAt'];
        downloadCSV('spend_classification.csv', rows, headers);
        toast('Spend classification exported', 'success');
    },

    exportComparison(type) {
        switch (type) {
            case 'sov': {
                const rows = DataStore.calcSOVSummary();
                downloadCSV('sov_summary.csv', rows, ['lineNumber','description','budget','actual','forecast','eac','variance','variancePct','riskLevel']);
                break;
            }
            case 'workpackage': {
                const rows = DataStore.calcWPSummary();
                downloadCSV('wp_summary.csv', rows, ['code','name','budget','actual','forecast','eac','variance','variancePct','riskLevel']);
                break;
            }
            case 'labor': {
                const rows = DataStore.calcLaborSummary();
                const flat = rows.map(r => ({ workPackage: r.wp.name, ...r }));
                downloadCSV('labor_comparison.csv', flat, ['workPackage','quotedHrs','actualHrs','forecastHrs','eacHrs','hrVariance','quotedCost','actualCost','forecastCost','eacCost','costVariance']);
                break;
            }
            case 'leadership': {
                const rows = DataStore.calcLeadershipSummary();
                const flat = rows.map(r => ({ workPackage: r.wp.name, ...r }));
                downloadCSV('leadership_comparison.csv', flat, ['workPackage','quotedHrs','actualHrs','forecastHrs','eacHrs','hrVariance','quotedCost','actualCost','forecastCost','eacCost','costVariance']);
                break;
            }
            case 'material': {
                const rows = DataStore.calcMaterialComparison();
                downloadCSV('material_comparison.csv', rows, ['description','vendor','qty','unit','totalCost','procuredQty','procuredCost','invoicedCost']);
                break;
            }
            case 'tools':
            case 'equipment': {
                const rows = DataStore.calcToolEquipComparison(type === 'tools' ? 'Tools' : 'Equipment');
                downloadCSV(`${type}_comparison.csv`, rows, ['description','totalCost','rentalCost','purchaseCost','forecast','eac','variance']);
                break;
            }
        }
        toast('Export complete', 'success');
    },
};

// ── Role Manager ─────────────────────────────────────────────────────────────

const RoleManager = (() => {
    const SESSION_KEY = 'ppSession_v1';
    let session = { roleId: '', memberId: '' };

    function loadSession() {
        try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'); } catch(e) {}
    }

    function saveSession() {
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch(e) {}
    }

    function getRoleDef(roleId) { return DataStore.getRoleById(roleId) || null; }

    function getSessionRole() { return getRoleDef(session.roleId); }

    function getSessionMember() { return DataStore.team.getById(session.memberId) || null; }

    function hasPermission(perm) {
        const role = getSessionRole();
        if (!role) return false;
        return role.permissions.includes('full_admin') || role.permissions.includes(perm);
    }

    function renderRoleBar() {
        const roleSelect = document.getElementById('session-role-select');
        const memberSelect = document.getElementById('session-member-select');
        const pill = document.getElementById('role-bar-pill');
        if (!roleSelect) return;

        // Populate role dropdown
        roleSelect.innerHTML = '<option value="">Select your role…</option>';
        DataStore.getRoles().forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.title;
            if (r.id === session.roleId) opt.selected = true;
            roleSelect.appendChild(opt);
        });

        // Populate member dropdown filtered by role
        renderMemberSelect(memberSelect, session.roleId, session.memberId);

        // Pill
        const role = getSessionRole();
        if (role) {
            pill.textContent = role.abbr === 'PE' && role.id !== 'role-exec' ? role.abbr : role.abbr;
            pill.style.background = role.color;
            pill.style.display = 'inline-block';
        } else {
            pill.style.display = 'none';
        }

        roleSelect.onchange = () => {
            session.roleId = roleSelect.value;
            session.memberId = '';
            saveSession();
            renderMemberSelect(memberSelect, session.roleId, '');
            renderRoleBar();
        };

        memberSelect.onchange = () => {
            session.memberId = memberSelect.value;
            saveSession();
            const member = getSessionMember();
            const bar = document.getElementById('role-bar');
            if (bar && member) bar.title = `Viewing as ${member.name} — ${getSessionRole()?.title || ''}`;
        };
    }

    function renderMemberSelect(select, roleId, selectedId) {
        if (!select) return;
        const members = roleId ? DataStore.team.getByRole(roleId) : DataStore.team.getAll();
        select.innerHTML = '<option value="">Select team member…</option>';
        members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            if (m.id === selectedId) opt.selected = true;
            select.appendChild(opt);
        });
    }

    function renderRoleCards() {
        const container = document.getElementById('role-cards-list');
        if (!container) return;
        container.innerHTML = DataStore.getRoles().map(r => `
            <div class="role-card">
                <div class="role-card-header">
                    <span class="role-badge" style="background:${r.color}">${r.abbr}</span>
                    <strong>${esc(r.title)}</strong>
                </div>
                <p class="role-card-desc">${esc(r.description)}</p>
                <div class="role-perms">
                    ${r.permissions.map(p => `<span class="perm-tag">${esc(p.replace(/_/g,' '))}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    function renderTeamTable() {
        const tbody = document.getElementById('team-table-body');
        if (!tbody) return;
        const members = DataStore.team.getAll();
        if (!members.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No team members added. Click "+ Add Member" to start.</td></tr>';
            return;
        }
        tbody.innerHTML = members.map(m => {
            const role = DataStore.getRoleById(m.roleId);
            return `<tr>
                <td><strong>${esc(m.name)}</strong></td>
                <td>${role ? `<span class="role-badge-sm" style="background:${role.color}">${esc(role.title)}</span>` : '—'}</td>
                <td class="muted">${esc(m.email || '—')}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline btn-sm" onclick="RoleManager.editMember('${m.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="RoleManager.removeMember('${m.id}')">Remove</button>
                </td>
            </tr>`;
        }).join('');
    }

    function renderRoutingTable() {
        const tbody = document.getElementById('routing-table-body');
        if (!tbody) return;
        const routing = DataStore.getTaskRouting();
        const labels = {
            cost_classification: 'Cost Classification',
            procurement: 'Procurement Tracking',
            bulletin_review: 'Bulletin / Supplement Review',
            schedule_review: 'Schedule Update Review',
            data_import: 'Data Import / Log Maintenance',
            sov_mapping: 'SOV / Work Package Mapping',
            major_cost: 'Major Cost Impact',
        };
        tbody.innerHTML = Object.entries(routing).map(([key, r]) => {
            const roleTitle = (id) => id ? (DataStore.getRoleById(id)?.abbr || id) : '—';
            return `<tr>
                <td><strong>${esc(labels[key] || key)}</strong></td>
                <td>${roleTitle(r.responsible)}</td>
                <td>${roleTitle(r.accountable)}</td>
                <td>${roleTitle(r.reviewer)}</td>
                <td>${roleTitle(r.approver)}</td>
                <td>${r.support ? roleTitle(r.support) : '—'}</td>
            </tr>`;
        }).join('');
    }

    function showAddMemberModal() {
        const roles = DataStore.getRoles();
        Modal.open(`
            <div class="modal-header">
                <h3>Add Team Member</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-grid" style="grid-template-columns:1fr 1fr;">
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" id="new-member-name" placeholder="Full name">
                    </div>
                    <div class="form-group">
                        <label>Role *</label>
                        <select id="new-member-role">
                            <option value="">Select role…</option>
                            ${roles.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="new-member-email" placeholder="email@company.com">
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="text" id="new-member-phone" placeholder="(xxx) xxx-xxxx">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-primary" onclick="RoleManager.saveMember()">Add Member</button>
            </div>
        `);
    }

    function saveMember(editId) {
        const name = document.getElementById('new-member-name')?.value.trim();
        const roleId = document.getElementById('new-member-role')?.value;
        const email = document.getElementById('new-member-email')?.value.trim();
        const phone = document.getElementById('new-member-phone')?.value.trim();
        if (!name || !roleId) { toast('Name and role are required', 'error'); return; }
        const initials = name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
        if (editId) {
            DataStore.team.update(editId, { name, roleId, email, phone, initials });
            toast('Member updated', 'success');
        } else {
            DataStore.team.add({ name, roleId, email, phone, initials });
            toast('Member added', 'success');
        }
        Modal.close();
        renderTeamTable();
        renderRoleBar();
    }

    function editMember(id) {
        const m = DataStore.team.getById(id);
        if (!m) return;
        const roles = DataStore.getRoles();
        Modal.open(`
            <div class="modal-header">
                <h3>Edit Team Member</h3>
                <button class="modal-close" onclick="Modal.close()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-grid" style="grid-template-columns:1fr 1fr;">
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" id="new-member-name" value="${esc(m.name)}">
                    </div>
                    <div class="form-group">
                        <label>Role *</label>
                        <select id="new-member-role">
                            ${roles.map(r => `<option value="${r.id}"${r.id===m.roleId?' selected':''}>${esc(r.title)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="new-member-email" value="${esc(m.email||'')}">
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="text" id="new-member-phone" value="${esc(m.phone||'')}">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-primary" onclick="RoleManager.saveMember('${id}')">Save Changes</button>
            </div>
        `);
    }

    function removeMember(id) {
        if (!confirm('Remove this team member?')) return;
        DataStore.team.remove(id);
        renderTeamTable();
        renderRoleBar();
        toast('Member removed', 'info');
    }

    function renderRaciBlock(raci) {
        if (!raci) return '';
        const roles = DataStore.getRoles();
        const members = DataStore.team.getAll();
        const roleTitle = (id) => {
            if (!id) return '<span class="muted">—</span>';
            const r = DataStore.getRoleById(id);
            return r ? `<span class="role-badge-sm" style="background:${r.color}">${esc(r.title)}</span>` : esc(id);
        };
        const memberName = (id) => {
            if (!id) return '<span class="muted">—</span>';
            const m = DataStore.team.getById(id);
            return m ? esc(m.name) : '<span class="muted">Unassigned</span>';
        };
        return `
            <div class="raci-block">
                <div class="raci-header">Task Ownership &amp; Routing</div>
                <div class="raci-grid">
                    <div class="raci-row"><span class="raci-label">Responsible</span>${roleTitle(raci.responsible)}</div>
                    <div class="raci-row"><span class="raci-label">Accountable</span>${roleTitle(raci.accountable)}</div>
                    <div class="raci-row"><span class="raci-label">Reviewer</span>${roleTitle(raci.reviewer)}</div>
                    <div class="raci-row"><span class="raci-label">Approver</span>${roleTitle(raci.approver)}</div>
                    <div class="raci-row"><span class="raci-label">Assigned To</span>${memberName(raci.assignedTo)}</div>
                    <div class="raci-row"><span class="raci-label">Priority</span><span class="priority-pill priority-${(raci.priority||'Normal').toLowerCase()}">${esc(raci.priority||'Normal')}</span></div>
                    <div class="raci-row"><span class="raci-label">Task Status</span><span class="task-status-pill">${esc(raci.taskStatus||'Open')}</span></div>
                    <div class="raci-row"><span class="raci-label">Due Date</span>${raci.dueDate ? esc(raci.dueDate) : '<span class="muted">—</span>'}</div>
                </div>
            </div>
        `;
    }

    return {
        loadSession, renderRoleBar, renderRoleCards, renderTeamTable, renderRoutingTable,
        showAddMemberModal, saveMember, editMember, removeMember, renderRaciBlock,
        getSessionRole, getSessionMember, hasPermission,
    };
})();

// ── App Init ──────────────────────────────────────────────────────────────────

function initApp() {
    DataStore.load();

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => Router.show(btn.dataset.view));
    });

    // Comparison tabs
    document.querySelectorAll('.comp-tab').forEach(tab => {
        tab.addEventListener('click', () => Router.showComparison(tab.dataset.comp));
    });

    // Review filters
    document.getElementById('filter-status').addEventListener('change', () => Views.renderReview(getCurrentFilters()));
    document.getElementById('filter-confidence').addEventListener('change', () => Views.renderReview(getCurrentFilters()));
    document.getElementById('filter-category').addEventListener('change', () => Views.renderReview(getCurrentFilters()));
    document.getElementById('filter-search').addEventListener('input', () => Views.renderReview(getCurrentFilters()));

    document.getElementById('btn-export-spend').addEventListener('click', ExportModule.exportSpend.bind(ExportModule));

    document.getElementById('btn-approve-all-low').addEventListener('click', () => {
        const items = DataStore.spend.getAll().filter(x => x.reviewStatus === 'Pending' && x.confidence === 'High');
        items.forEach(item => ReviewActions.approve(item.id));
        toast(`Auto-approved ${items.length} high-confidence items`, 'success');
    });

    // Settings form
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        DataStore.updateProjectInfo({
            name: document.getElementById('settings-name').value,
            number: document.getElementById('settings-number').value,
            client: document.getElementById('settings-client').value,
            pm: document.getElementById('settings-pm').value,
            startDate: document.getElementById('settings-start').value,
            endDate: document.getElementById('settings-end').value,
        });
        toast('Project settings saved', 'success');
        Views.renderDashboard();
    });

    // Reset data
    document.getElementById('btn-reset-data').addEventListener('click', () => {
        if (confirm('This will permanently delete ALL project data. Are you sure?')) {
            DataStore.resetAll();
            toast('All data cleared', 'info');
            Views.renderDashboard();
            Views.renderSettings();
        }
    });

    // Add team member
    document.getElementById('btn-add-member')?.addEventListener('click', () => RoleManager.showAddMemberModal());

    // Modal close on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) Modal.close();
    });

    // Init import module
    ImportModule.init();

    // Populate filter category dropdown
    const catFilter = document.getElementById('filter-category');
    CATEGORIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        catFilter.appendChild(opt);
    });

    // Role manager
    RoleManager.loadSession();
    RoleManager.renderRoleBar();

    // Initial render
    Router.show('dashboard');
}

document.addEventListener('DOMContentLoaded', initApp);
