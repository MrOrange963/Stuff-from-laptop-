'use strict';

const Classifier = (() => {

    // ── Keyword rules per category ────────────────────────────────────────────
    const KEYWORDS = {
        'Material': [
            'wire','cable','conductor','conduit','emt','imc','rigid','pvc','liquidtight','sealtight',
            'fitting','connector','coupling','nipple','elbow','sweep','pull box','junction box',
            'panel','panelboard','switchboard','breaker','circuit breaker','disconnect','fuse',
            'outlet','receptacle','switch','device','cover','plate','wallplate',
            'tray','cable tray','wireway','wireway','unistrut','strut','channel','support',
            'raceway','conduit body','lb','ll','lr','t-body',
            'splice','lug','terminal','wirenut','marette','bushing','locknut',
            'material','supplies','hardware','copper','aluminum'
        ],
        'Tools': [
            'tool','drill','saw','hammer','crimper','tester','multimeter','clamp meter',
            'fish tape','cable puller','wire puller','knockout','punch',
            'level','laser level','torpedo level','tape measure','measuring tape',
            'pliers','lineman','needle nose','wire stripper','stripper',
            'screwdriver','nut driver','wrench','adjustable wrench','socket',
            'bender','pipe bender','conduit bender','hickey',
            'voltage tester','non-contact','solenoid tester'
        ],
        'Equipment': [
            'equipment','crane','lift','boom lift','scissor lift','aerial lift',
            'manift','manlift','genie','jlg','skyjack','telehandler','lull',
            'forklift','fork lift','pallet jack','skid steer','compact loader',
            'excavator','backhoe','compressor','air compressor','generator',
            'concrete saw','core drill','vacuum','vac','suction'
        ],
        'Rentals': [
            'rental','rent','leased','lease','hire','per day','per week','per month',
            'weekly rate','daily rate','monthly rate','rental rate','re-rent',
            'sunbelt','united rentals','sunstate','home depot rental','fabick','ahern'
        ],
        'Subcontract': [
            'subcontract','subcontractor','sub-contract','sub contract','sub ',' sub,',
            'specialty contractor','outside labor'
        ],
        'Field Labor': [
            'labor','labour','electrician','journeyman','journey','jw','apprentice',
            'helper','worker','crew','regular time','overtime','double time',
            'rt hours','ot hours','dt hours','field time','installation labor',
            'install hours','straight time','st hours','work hours','man hours','manhours'
        ],
        'Field Leadership': [
            'foreman','fore man','superintendent','super','supervisor','lead man',
            'leadman','general foreman','gf','project superintendent','field super',
            'project manager pm','leadership','management salary','salaried'
        ],
        'General Conditions': [
            'office','trailer','job trailer','site office','phone','cell phone',
            'communication','radio','safety','ppe','hard hat','gloves','glasses',
            'first aid','fire extinguisher','insurance','builder risk','bond',
            'permit','inspection','temporary power','temp power','temp light',
            'parking','meals','lodging','hotel','motel','travel','per diem',
            'porta-potty','portable toilet','dumpster','trash','waste','clean-up','cleanup',
            'mobilization','demobilization','mob','demob','consumable','small tools'
        ],
    };

    // Source type → default category (keys match Classifier.SOURCE_TYPE_MAP values)
    const SOURCE_DEFAULTS = {
        'Labor Report': 'Field Labor',
        'Field Leadership Labor Report': 'Field Leadership',
        'Equipment': 'Equipment',
        'Tool/Rental': null,          // ambiguous — resolve via keywords
        'PO': null,                   // ambiguous — resolve via keywords
        'Invoice': null,              // ambiguous — resolve via keywords
        'Procurement': 'Material',
    };

    // Cost code prefix → category (editable by having PM load cost codes with category field)
    const COST_CODE_PREFIX = {
        '01': 'General Conditions',
        '02': 'Material',
        '03': 'Material',
        '04': 'Tools',
        '05': 'Equipment',
        '06': 'Rentals',
        '07': 'Subcontract',
        '08': 'Field Labor',
        '09': 'Field Leadership',
        '10': 'General Conditions',
    };

    function scoreKeywords(text) {
        if (!text) return {};
        const lower = text.toLowerCase();
        const scores = {};
        for (const [cat, words] of Object.entries(KEYWORDS)) {
            let hits = 0;
            for (const w of words) {
                if (lower.includes(w)) hits++;
            }
            if (hits > 0) scores[cat] = hits;
        }
        return scores;
    }

    function bestCategory(scores) {
        let best = null, bestScore = 0;
        for (const [cat, score] of Object.entries(scores)) {
            if (score > bestScore) { bestScore = score; best = cat; }
        }
        return best;
    }

    function matchSOV(description, sovLines) {
        if (!description || !sovLines.length) return null;
        const lower = description.toLowerCase();
        let best = null, bestScore = 0;
        for (const line of sovLines) {
            const desc = (line.description || '').toLowerCase();
            const words = desc.split(/\s+/).filter(w => w.length > 3);
            const score = words.filter(w => lower.includes(w)).length;
            if (score > bestScore) { bestScore = score; best = line.id; }
        }
        return bestScore >= 2 ? best : null;
    }

    function matchWorkPackage(description, category, workPackages) {
        if (!workPackages.length) return null;
        const lower = (description || '').toLowerCase();
        let best = null, bestScore = 0;
        for (const wp of workPackages) {
            const desc = ((wp.name || '') + ' ' + (wp.description || '')).toLowerCase();
            const words = desc.split(/\s+/).filter(w => w.length > 3);
            const score = words.filter(w => lower.includes(w)).length;
            if (score > bestScore) { bestScore = score; best = wp.id; }
        }
        return bestScore >= 1 ? best : null;
    }

    function matchCostCode(costCodeStr, costCodes) {
        if (!costCodeStr) return null;
        const code = String(costCodeStr).trim();
        const exact = costCodes.find(c => c.code === code);
        if (exact) return exact.id;
        const prefix = code.slice(0, 2);
        const byPrefix = costCodes.find(c => c.code && c.code.startsWith(prefix));
        return byPrefix ? byPrefix.id : null;
    }

    function matchEstimateItem(description, category, estimates) {
        if (!description || !estimates.length) return null;
        const lower = description.toLowerCase();
        const catItems = category ? estimates.filter(e => e.category === category) : estimates;
        let best = null, bestScore = 0;
        for (const e of catItems) {
            const edesc = (e.description || '').toLowerCase();
            const words = edesc.split(/\s+/).filter(w => w.length > 3);
            const score = words.filter(w => lower.includes(w)).length;
            if (score > bestScore) { bestScore = score; best = e.id; }
        }
        return bestScore >= 2 ? best : null;
    }

    // ── Main classify function ────────────────────────────────────────────────

    function classify(item, store) {
        const signals = [];

        // 1. Source type signal
        const srcDefault = SOURCE_DEFAULTS[item.sourceType];
        if (srcDefault) {
            signals.push({ type: 'sourceType', value: srcDefault, weight: 2 });
        }

        // 2. Keyword signal from description + vendor
        const searchText = [item.description, item.vendorEmployee, item.notes].filter(Boolean).join(' ');
        const kwScores = scoreKeywords(searchText);
        const kwBest = bestCategory(kwScores);
        if (kwBest) {
            const kwWeight = kwScores[kwBest] >= 3 ? 3 : kwScores[kwBest] >= 2 ? 2 : 1;
            signals.push({ type: 'keyword', value: kwBest, weight: kwWeight });
        }

        // 3. Cost code signal
        if (item.costCode) {
            const prefix = String(item.costCode).slice(0, 2);
            const ccCat = COST_CODE_PREFIX[prefix];
            // Also check loaded cost codes
            const loadedCC = (store.costCodes || []).find(c => c.code === String(item.costCode).trim());
            const loadedCat = loadedCC ? loadedCC.category : null;
            if (loadedCat) signals.push({ type: 'costCode', value: loadedCat, weight: 3 });
            else if (ccCat) signals.push({ type: 'costCode', value: ccCat, weight: 2 });
        }

        // 4. Phase code signal
        if (item.phaseCode) {
            const pc = (store.phaseCodes || []).find(p => p.code === String(item.phaseCode).trim());
            if (pc && pc.category) signals.push({ type: 'phaseCode', value: pc.category, weight: 2 });
        }

        // Tally votes weighted
        const tally = {};
        for (const s of signals) {
            tally[s.value] = (tally[s.value] || 0) + s.weight;
        }

        let suggestedCategory = 'Other / Unclassified';
        let maxWeight = 0;
        for (const [cat, weight] of Object.entries(tally)) {
            if (weight > maxWeight) { maxWeight = weight; suggestedCategory = cat; }
        }

        const totalWeight = Object.values(tally).reduce((a, b) => a + b, 0);
        const dominance = totalWeight > 0 ? maxWeight / totalWeight : 0;
        let confidence;
        if (signals.length >= 3 && dominance >= 0.6) confidence = 'High';
        else if (signals.length >= 2 && dominance >= 0.5) confidence = 'Medium';
        else if (signals.length >= 1) confidence = 'Low';
        else confidence = 'Low';

        if (suggestedCategory === 'Other / Unclassified') confidence = 'Low';

        // Match to registers
        const sovLines = store.sov || [];
        const workPackages = store.workPackages || [];
        const costCodes = store.costCodes || [];
        const estimates = store.estimates || [];

        const suggestedSOVLine = matchSOV(item.description, sovLines);
        const suggestedWorkPackage = matchWorkPackage(item.description, suggestedCategory, workPackages);
        const suggestedCostCode = matchCostCode(item.costCode, costCodes);
        const matchedEstimateItem = matchEstimateItem(item.description, suggestedCategory, estimates);

        return { suggestedCategory, confidence, suggestedSOVLine, suggestedWorkPackage, suggestedCostCode, matchedEstimateItem };
    }

    function classifyBatch(items, store) {
        return items.map(item => {
            const result = classify(item, store);
            return { ...item, ...result };
        });
    }

    // ── Column templates for each import type ─────────────────────────────────
    const IMPORT_COLUMNS = {
        'estimate': ['description','category','sovLineRef','workPackageRef','costCode','phaseCode','qty','unit','unitCost','totalCost','laborHours'],
        'takeoff': ['description','workPackageRef','unit','qty','unitCost','totalCost'],
        'quoted-materials': ['description','vendor','partNumber','sovLineRef','workPackageRef','costCode','qty','unit','unitCost','totalCost'],
        'quoted-tools': ['description','type','workPackageRef','qty','unit','unitCost','totalCost'],
        'quoted-equipment': ['description','type','workPackageRef','qty','unit','dailyRate','duration','totalCost'],
        'quoted-rentals': ['description','vendor','workPackageRef','qty','unit','rate','duration','totalCost'],
        'quoted-labor': ['laborType','workPackageRef','sovLineRef','costCode','phaseCode','quotedHours','hourlyRate','totalCost'],
        'quoted-leadership': ['laborType','workPackageRef','sovLineRef','costCode','phaseCode','quotedHours','hourlyRate','totalCost'],
        'sov': ['lineNumber','description','totalValue'],
        'cost-codes': ['code','description','category'],
        'phase-codes': ['code','description'],
        'work-packages': ['code','name','description','sovLineRef','budgetAmount'],
        'procurement-log': ['date','vendorEmployee','description','amount','qty','unitCost','workPackageRef','costCode'],
        'po-log': ['date','poNumber','vendorEmployee','description','amount','qty','unitCost','workPackageRef','costCode'],
        'invoice-log': ['date','poNumber','invoiceNumber','vendorEmployee','description','amount','qty','unitCost','workPackageRef','costCode'],
        'tool-rental-log': ['date','vendorEmployee','description','amount','qty','unitCost','poNumber','invoiceNumber','workPackageRef'],
        'equipment-log': ['date','vendorEmployee','description','amount','qty','unitCost','poNumber','invoiceNumber','workPackageRef'],
        'labor-report': ['date','vendorEmployee','description','qty','unitCost','amount','workPackageRef','costCode','phaseCode'],
        'leadership-report': ['date','vendorEmployee','description','qty','unitCost','amount','workPackageRef','costCode','phaseCode'],
    };

    const SOURCE_TYPE_MAP = {
        'estimate': 'Estimate',
        'takeoff': 'Takeoff',
        'quoted-materials': 'Quoted Material',
        'quoted-tools': 'Quoted Tool',
        'quoted-equipment': 'Quoted Equipment',
        'quoted-rentals': 'Quoted Rental',
        'quoted-labor': 'Quoted Labor',
        'quoted-leadership': 'Quoted Leadership',
        'sov': 'SOV',
        'cost-codes': 'Cost Code',
        'phase-codes': 'Phase Code',
        'work-packages': 'Work Package',
        'procurement-log': 'Procurement',
        'po-log': 'PO',
        'invoice-log': 'Invoice',
        'tool-rental-log': 'Tool/Rental',
        'equipment-log': 'Equipment',
        'labor-report': 'Labor Report',
        'leadership-report': 'Field Leadership Labor Report',
    };

    return { classify, classifyBatch, IMPORT_COLUMNS, SOURCE_TYPE_MAP, KEYWORDS };
})();
