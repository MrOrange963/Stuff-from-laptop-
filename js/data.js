'use strict';

const DataStore = (() => {
    const KEY = 'pcData_v1';

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function nextSpendId(store) {
        const n = store._nextSpendId || 1;
        store._nextSpendId = n + 1;
        return 'SP-' + String(n).padStart(5, '0');
    }

    // ── Role definitions (static — extend here to add future roles) ──────────
    const ROLE_DEFS = [
        {
            id: 'role-exec', title: 'Project Executive', abbr: 'PE',
            description: 'Final approver for major budget, forecast, staffing, and client-impact items.',
            permissions: ['read_all','approve_executive','export'],
            color: '#6B7280',
        },
        {
            id: 'role-spm', title: 'Senior Project Manager', abbr: 'SPM',
            description: 'Overall accountable party. Owns cost control, procurement oversight, schedule review, and issue escalation.',
            permissions: ['full_admin','assign_delegate','approve_cost','approve_schedule','approve_bulletin','edit_sov','export'],
            color: '#147BFF',
        },
        {
            id: 'role-apm', title: 'Assistant Project Manager', abbr: 'APM',
            description: 'Day-to-day project controls. Manages procurement, constraints, RFIs, cost forecasts.',
            permissions: ['update_assigned','manage_procurement','manage_constraints','manage_rfi','prepare_forecast'],
            color: '#2D8CFF',
        },
        {
            id: 'role-pe', title: 'Project Engineer', abbr: 'PE',
            description: 'Technical document reviews, schedule/bulletin/RFI tracking, SOV and work package detail.',
            permissions: ['upload_docs','create_findings','review_schedule','update_workpackage','classify_scope'],
            color: '#2EB67D',
        },
        {
            id: 'role-pa', title: 'Project Assistant', abbr: 'PA',
            description: 'Data entry, file uploads, log maintenance, task status updates.',
            permissions: ['upload_docs','enter_data','update_task_status','maintain_logs'],
            color: '#F28C28',
        },
    ];

    // ── Default task routing by record type ──────────────────────────────────
    const TASK_ROUTING = {
        cost_classification: { responsible:'role-apm', accountable:'role-spm', support:'role-pe',  reviewer:'role-spm',  approver:'role-spm'  },
        procurement:         { responsible:'role-apm', accountable:'role-spm', support:'role-pa',  reviewer:'role-spm',  approver:'role-spm'  },
        bulletin_review:     { responsible:'role-pe',  accountable:'role-spm', support:null,        reviewer:'role-apm',  approver:'role-spm'  },
        schedule_review:     { responsible:'role-pe',  accountable:'role-spm', support:null,        reviewer:'role-apm',  approver:'role-spm'  },
        data_import:         { responsible:'role-pa',  accountable:'role-apm', support:null,        reviewer:'role-apm',  approver:'role-spm'  },
        sov_mapping:         { responsible:'role-pe',  accountable:'role-spm', support:null,        reviewer:'role-apm',  approver:'role-spm'  },
        major_cost:          { responsible:'role-apm', accountable:'role-spm', support:null,        reviewer:'role-spm',  approver:'role-exec' },
    };

    function blank() {
        return {
            version: '1.1',
            _nextSpendId: 1,
            projectInfo: { name: '', number: '', client: '', pm: '', startDate: '', endDate: '' },
            // Team
            teamMembers: [],
            // Registers
            sov: [],
            workPackages: [],
            costCodes: [],
            phaseCodes: [],
            // Estimates
            estimates: [],
            quotedMaterials: [],
            quotedTools: [],
            quotedEquipment: [],
            quotedRentals: [],
            quotedLaborHours: [],
            quotedLeadershipHours: [],
            takeoffItems: [],
            // Spend
            spendItems: [],
            auditLog: [],
        };
    }

    // ── RACI helper: build a blank RACI block ─────────────────────────────────
    function blankRaci(routingType) {
        const routing = TASK_ROUTING[routingType] || {};
        return {
            routingType: routingType || null,
            responsible: routing.responsible || null,    // role ID
            accountable: routing.accountable || null,
            assignedTo: null,                            // team member ID
            delegatedTo: null,
            reviewer: routing.reviewer || null,
            approver: routing.approver || null,
            supportTeam: routing.support ? [routing.support] : [],
            escalationManager: 'role-spm',
            dueDate: null,
            priority: 'Normal',
            taskStatus: 'Open',
            completionDate: null,
        };
    }

    let store = blank();

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) store = Object.assign(blank(), JSON.parse(raw));
        } catch (e) {
            console.warn('DataStore load failed', e);
        }
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(store)); }
        catch (e) { console.error('DataStore save failed', e); }
    }

    function addAudit(action, detail, actor) {
        store.auditLog.push({ at: new Date().toISOString(), actor: actor || 'System', action, detail });
        save();
    }

    // ── Generic list helpers ──────────────────────────────────────────────────

    function makeListApi(key) {
        return {
            getAll: () => store[key],
            add: (item) => { item.id = item.id || uid(); store[key].push(item); save(); return item; },
            update: (id, data) => {
                const i = store[key].findIndex(x => x.id === id);
                if (i >= 0) { store[key][i] = { ...store[key][i], ...data, id }; save(); }
            },
            remove: (id) => { store[key] = store[key].filter(x => x.id !== id); save(); },
            clear: () => { store[key] = []; save(); },
            bulkAdd: (items) => {
                items.forEach(item => { item.id = item.id || uid(); store[key].push(item); });
                save();
            },
        };
    }

    // ── Spend Items (special — need spendId + auditHistory) ──────────────────

    const spendApi = {
        getAll: () => store.spendItems,
        add: (item) => {
            item.id = uid();
            item.spendId = nextSpendId(store);
            item.importedAt = new Date().toISOString();
            item.reviewStatus = item.reviewStatus || 'Pending';
            item.auditHistory = [];
            store.spendItems.push(item);
            save();
            return item;
        },
        bulkAdd: (items) => {
            items.forEach(item => {
                item.id = uid();
                item.spendId = nextSpendId(store);
                item.importedAt = new Date().toISOString();
                item.reviewStatus = item.reviewStatus || 'Pending';
                item.auditHistory = [];
                store.spendItems.push(item);
            });
            save();
        },
        update: (id, data, actor) => {
            const i = store.spendItems.findIndex(x => x.id === id);
            if (i < 0) return;
            const before = { ...store.spendItems[i] };
            store.spendItems[i] = { ...before, ...data, id, auditHistory: before.auditHistory || [] };
            store.spendItems[i].auditHistory.push({
                at: new Date().toISOString(),
                by: actor || 'PM',
                changes: data,
            });
            save();
        },
        remove: (id) => { store.spendItems = store.spendItems.filter(x => x.id !== id); save(); },
        clear: () => { store.spendItems = []; store._nextSpendId = 1; save(); },
        getById: (id) => store.spendItems.find(x => x.id === id),
        // Only approved items with high/medium confidence count toward official EAC
        officialItems: () => store.spendItems.filter(x => x.reviewStatus === 'Approved'),
    };

    // ── Team member API ───────────────────────────────────────────────────────
    const teamApi = {
        getAll: () => store.teamMembers,
        add: (member) => {
            member.id = member.id || uid();
            store.teamMembers.push(member);
            save();
            return member;
        },
        update: (id, data) => {
            const i = store.teamMembers.findIndex(x => x.id === id);
            if (i >= 0) { store.teamMembers[i] = { ...store.teamMembers[i], ...data, id }; save(); }
        },
        remove: (id) => { store.teamMembers = store.teamMembers.filter(x => x.id !== id); save(); },
        bulkAdd: (members) => {
            members.forEach(m => { m.id = m.id || uid(); store.teamMembers.push(m); });
            save();
        },
        getById: (id) => store.teamMembers.find(x => x.id === id),
        getByRole: (roleId) => store.teamMembers.filter(x => x.roleId === roleId),
    };

    return {
        load, save, addAudit,
        getStore: () => store,
        resetAll: () => { store = blank(); save(); },

        // Roles & routing (read-only config)
        getRoles: () => ROLE_DEFS,
        getRoleById: (id) => ROLE_DEFS.find(r => r.id === id),
        getTaskRouting: () => TASK_ROUTING,
        buildRaci: (routingType) => blankRaci(routingType),

        // Team
        team: teamApi,

        // Project info
        getProjectInfo: () => store.projectInfo,
        updateProjectInfo: (info) => { store.projectInfo = { ...store.projectInfo, ...info }; save(); },

        // Reference registers
        sov: makeListApi('sov'),
        workPackages: makeListApi('workPackages'),
        costCodes: makeListApi('costCodes'),
        phaseCodes: makeListApi('phaseCodes'),

        // Estimate/quote data
        estimates: makeListApi('estimates'),
        quotedMaterials: makeListApi('quotedMaterials'),
        quotedTools: makeListApi('quotedTools'),
        quotedEquipment: makeListApi('quotedEquipment'),
        quotedRentals: makeListApi('quotedRentals'),
        quotedLaborHours: makeListApi('quotedLaborHours'),
        quotedLeadershipHours: makeListApi('quotedLeadershipHours'),
        takeoffItems: makeListApi('takeoffItems'),

        // Spend items
        spend: spendApi,

        // Audit log
        getAuditLog: () => store.auditLog,

        // ── Rollup calculations ───────────────────────────────────────────────

        calcDashboard() {
            const approved = spendApi.officialItems();
            const all = store.spendItems;

            const sum = (arr, field) => arr.reduce((t, x) => t + (parseFloat(x[field]) || 0), 0);
            const quotedBudget =
                sum(store.quotedMaterials, 'totalCost') +
                sum(store.quotedTools, 'totalCost') +
                sum(store.quotedEquipment, 'totalCost') +
                sum(store.quotedRentals, 'totalCost') +
                sum(store.quotedLaborHours, 'totalCost') +
                sum(store.quotedLeadershipHours, 'totalCost') +
                sum(store.estimates, 'totalCost');

            const committed = sum(approved.filter(x => x.sourceType === 'PO' || x.committed), 'amount');
            const actual = sum(approved.filter(x => x.sourceType === 'Invoice' || x.invoiced), 'amount');
            const forecastRemaining = sum(approved, 'forecastRemaining');
            const eac = actual + forecastRemaining;
            const variance = quotedBudget - eac;

            const unclassified = all.filter(x => !x.approvedCategory && (!x.suggestedCategory || x.suggestedCategory === 'Other / Unclassified')).length;
            const lowConf = all.filter(x => x.confidence === 'Low' && x.reviewStatus === 'Pending').length;

            const matQuoted = sum(store.quotedMaterials, 'totalCost') + sum(store.estimates.filter(e => e.category === 'Material'), 'totalCost');
            const matActual = sum(approved.filter(x => (x.approvedCategory || x.suggestedCategory) === 'Material'), 'amount');
            const matVariance = matQuoted - matActual;

            const laborQuotedHrs = sum(store.quotedLaborHours, 'quotedHours');
            const laborActualHrs = sum(approved.filter(x => (x.approvedCategory || x.suggestedCategory) === 'Field Labor'), 'qty');
            const laborHrVariance = laborQuotedHrs - laborActualHrs;

            const eqRentQuoted = sum(store.quotedEquipment, 'totalCost') + sum(store.quotedRentals, 'totalCost');
            const eqRentActual = sum(approved.filter(x => ['Equipment', 'Rentals'].includes(x.approvedCategory || x.suggestedCategory)), 'amount');
            const eqRentVariance = eqRentQuoted - eqRentActual;

            const ldQuoted = sum(store.quotedLeadershipHours, 'totalCost');
            const ldActual = sum(approved.filter(x => (x.approvedCategory || x.suggestedCategory) === 'Field Leadership'), 'amount');
            const ldVariance = ldQuoted - ldActual;

            return { quotedBudget, committed, actual, forecastRemaining, eac, variance, unclassified, lowConf, matVariance, laborHrVariance, eqRentVariance, ldVariance };
        },

        calcSOVSummary() {
            const approved = spendApi.officialItems();
            return store.sov.map(line => {
                const items = approved.filter(x => (x.approvedSOVLine || x.suggestedSOVLine) === line.id);
                const actual = items.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
                const forecast = items.reduce((t, x) => t + (parseFloat(x.forecastRemaining) || 0), 0);
                const eac = actual + forecast;
                const budget = parseFloat(line.totalValue) || 0;
                const variance = budget - eac;
                const variancePct = budget ? (variance / budget * 100) : 0;
                return { ...line, actual, forecast, eac, budget, variance, variancePct, riskLevel: riskLevel(variancePct) };
            });
        },

        calcWPSummary() {
            const approved = spendApi.officialItems();
            return store.workPackages.map(wp => {
                const items = approved.filter(x => (x.approvedWorkPackage || x.suggestedWorkPackage) === wp.id);
                const actual = items.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
                const forecast = items.reduce((t, x) => t + (parseFloat(x.forecastRemaining) || 0), 0);
                const eac = actual + forecast;
                const budget = parseFloat(wp.budgetAmount) || 0;
                const variance = budget - eac;
                const variancePct = budget ? (variance / budget * 100) : 0;
                return { ...wp, actual, forecast, eac, budget, variance, variancePct, riskLevel: riskLevel(variancePct) };
            });
        },

        calcLaborSummary() {
            const approved = spendApi.officialItems();
            return store.workPackages.map(wp => {
                const quoted = store.quotedLaborHours.filter(x => x.workPackageId === wp.id);
                const quotedHrs = quoted.reduce((t, x) => t + (parseFloat(x.quotedHours) || 0), 0);
                const quotedCost = quoted.reduce((t, x) => t + (parseFloat(x.totalCost) || 0), 0);
                const actual = approved.filter(x => (x.approvedWorkPackage || x.suggestedWorkPackage) === wp.id && (x.approvedCategory || x.suggestedCategory) === 'Field Labor');
                const actualHrs = actual.reduce((t, x) => t + (parseFloat(x.qty) || 0), 0);
                const actualCost = actual.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
                const forecastHrs = actual.reduce((t, x) => t + (parseFloat(x.forecastRemainingHours) || 0), 0);
                const forecastCost = actual.reduce((t, x) => t + (parseFloat(x.forecastRemaining) || 0), 0);
                const eacHrs = actualHrs + forecastHrs;
                const eacCost = actualCost + forecastCost;
                return { wp, quotedHrs, quotedCost, actualHrs, actualCost, forecastHrs, forecastCost, eacHrs, eacCost, hrVariance: quotedHrs - eacHrs, costVariance: quotedCost - eacCost };
            }).filter(r => r.quotedHrs > 0 || r.actualHrs > 0);
        },

        calcLeadershipSummary() {
            const approved = spendApi.officialItems();
            return store.workPackages.map(wp => {
                const quoted = store.quotedLeadershipHours.filter(x => x.workPackageId === wp.id);
                const quotedHrs = quoted.reduce((t, x) => t + (parseFloat(x.quotedHours) || 0), 0);
                const quotedCost = quoted.reduce((t, x) => t + (parseFloat(x.totalCost) || 0), 0);
                const actual = approved.filter(x => (x.approvedWorkPackage || x.suggestedWorkPackage) === wp.id && (x.approvedCategory || x.suggestedCategory) === 'Field Leadership');
                const actualHrs = actual.reduce((t, x) => t + (parseFloat(x.qty) || 0), 0);
                const actualCost = actual.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
                const forecastHrs = actual.reduce((t, x) => t + (parseFloat(x.forecastRemainingHours) || 0), 0);
                const forecastCost = actual.reduce((t, x) => t + (parseFloat(x.forecastRemaining) || 0), 0);
                const eacHrs = actualHrs + forecastHrs;
                const eacCost = actualCost + forecastCost;
                return { wp, quotedHrs, quotedCost, actualHrs, actualCost, forecastHrs, forecastCost, eacHrs, eacCost, hrVariance: quotedHrs - eacHrs, costVariance: quotedCost - eacCost };
            }).filter(r => r.quotedHrs > 0 || r.actualHrs > 0);
        },

        calcMaterialComparison() {
            const approved = spendApi.officialItems().filter(x => (x.approvedCategory || x.suggestedCategory) === 'Material');
            return store.quotedMaterials.map(qm => {
                const procured = approved.filter(x => x.matchedEstimateItem === qm.id && x.sourceType === 'PO');
                const invoiced = approved.filter(x => x.matchedEstimateItem === qm.id && x.sourceType === 'Invoice');
                return {
                    ...qm,
                    procuredQty: procured.reduce((t, x) => t + (parseFloat(x.qty) || 0), 0),
                    procuredCost: procured.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0),
                    invoicedCost: invoiced.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0),
                };
            });
        },

        calcToolEquipComparison(category) {
            const approved = spendApi.officialItems().filter(x => (x.approvedCategory || x.suggestedCategory) === category);
            const quoted = category === 'Tools' ? store.quotedTools : store.quotedEquipment;
            return quoted.map(qt => {
                const rental = approved.filter(x => x.matchedEstimateItem === qt.id && x.sourceType === 'Tool/Rental');
                const purchase = approved.filter(x => x.matchedEstimateItem === qt.id && x.sourceType !== 'Tool/Rental');
                const forecast = approved.filter(x => x.matchedEstimateItem === qt.id).reduce((t, x) => t + (parseFloat(x.forecastRemaining) || 0), 0);
                const rentalCost = rental.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
                const purchaseCost = purchase.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
                const eac = rentalCost + purchaseCost + forecast;
                const quoted_cost = parseFloat(qt.totalCost) || 0;
                return { ...qt, rentalCost, purchaseCost, forecast, eac, variance: quoted_cost - eac };
            });
        },
    };

    function riskLevel(variancePct) {
        if (variancePct > -5) return 'Low';
        if (variancePct > -15) return 'Medium';
        return 'High';
    }
})();
