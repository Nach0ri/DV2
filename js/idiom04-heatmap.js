// Idiom 04: Which threats peak when?
// Heatmap of rescue reasons (rows) by calendar month (columns), read from data/rescue_reasons_by_month.csv.
// "Unknown" causes are excluded in the source file. "All classes" sums the three animal groups (disjoint, so no double counting).
// Counts are summed across the whole source period; the source has no year column.
(async function () {
    const DATA_URL = "data/rescue_reasons_by_month.csv";
    const chartEl = document.getElementById("heatmap-chart");
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const SHORT = MONTHS.map(m => m.slice(0, 3));
    const ALL = "All classes";

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Heatmap could not be shown</h3><p>${message}</p></div>`;
    }

    // CSV parser that respects quoted fields (cause names can contain commas or slashes).
    function parseCsv(text) {
        return text.trim().split(/\r?\n/).map(line => {
            const cells = []; let cur = ""; let q = false;
            for (const ch of line) {
                if (ch === '"') q = !q;
                else if (ch === "," && !q) { cells.push(cur); cur = ""; }
                else cur += ch;
            }
            cells.push(cur);
            return cells.map(c => c.trim());
        });
    }

    let text;
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) { showUnavailable(`The file <code>${DATA_URL}</code> could not be found. No chart is shown and no values have been filled in.`); return; }
        text = await res.text();
    } catch (err) {
        showUnavailable(`The file <code>${DATA_URL}</code> could not be read. No chart is shown and no values have been filled in.`);
        return;
    }

    // Columns: group, reason, month_number, month, count
    const [header, ...body] = parseCsv(text);
    const col = name => header.indexOf(name);
    const iGrp = col("group"), iReason = col("reason"), iMn = col("month_number"), iMonth = col("month"), iCount = col("count");
    if ([iGrp, iReason, iMn, iMonth, iCount].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Keep only rows with a real count. Blank cells are skipped, never treated as zero.
    const rows = body
        .filter(r => r.length >= 5 && /^\d+$/.test(r[iCount]))
        .map(r => ({ animal_group: r[iGrp], reason: r[iReason], month_number: Number(r[iMn]), month: r[iMonth], month_short: r[iMonth].slice(0, 3), count: Number(r[iCount]) }));
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const groups = [ALL, ...[...new Set(rows.map(r => r.animal_group))].sort()];

    // Row order: reasons by their total for the selected group, largest first (set in the spec with a sum sort).
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: { step: 22 },
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: rows },
        params: [
            { name: "heat_group", value: ALL, bind: { input: "select", options: groups, name: "Animal group ", element: "#heatmap-group" } }
        ],
        transform: [
            { filter: "heat_group === '" + ALL + "' || datum.animal_group === heat_group" },
            { aggregate: [{ op: "sum", field: "count", as: "rescues" }], groupby: ["reason", "month", "month_number", "month_short"] },
            { calculate: "heat_group", as: "group_label" },
            // Colour each cell by its share of that reason’s year, so small reasons show their own seasonal peak
            // instead of being washed out by the three largest reasons.
            { joinaggregate: [{ op: "sum", field: "rescues", as: "reason_total" }], groupby: ["reason"] },
            { calculate: "datum.rescues / datum.reason_total", as: "share" }
        ],
        encoding: {
            x: {
                field: "month_short", type: "ordinal", sort: SHORT, title: null,
                axis: { labelAngle: 0, labelFontSize: 11, orient: "top", domain: false, ticks: false }
            },
            y: {
                field: "reason", type: "nominal", title: null,
                sort: { field: "reason_total", op: "max", order: "descending" },
                axis: { labelLimit: 240, labelFontSize: 11, domain: false, ticks: false }
            },
            color: {
                field: "share", type: "quantitative", title: "Share of reason’s rescues",
                // Capped at 20%: a typical month is about 8%, and only 5 of 227 cells exceed 20% (exact values in the tooltip).
                scale: { range: ["#F3F6F1", "#176B60"], domain: [0, 0.2], clamp: true },
                legend: { orient: "bottom", direction: "horizontal", gradientLength: 260, titleFontSize: 11, labelFontSize: 11, format: ".0%", values: [0, 0.05, 0.1, 0.15, 0.2], labelExpr: "datum.value >= 0.2 ? '20%+' : datum.label" }
            },
            tooltip: [
                { field: "reason", type: "nominal", title: "Reason" },
                { field: "month", type: "nominal", title: "Month" },
                { field: "rescues", type: "quantitative", title: "Rescues", format: ",d" },
                { field: "share", type: "quantitative", title: "Share of this reason’s year", format: ".1%" },
                { field: "reason_total", type: "quantitative", title: "Reason total (all months)", format: ",d" },
                { field: "group_label", type: "nominal", title: "Animal group" }
            ]
        },
        layer: [
            { mark: { type: "rect", stroke: "#ffffff", strokeWidth: 1 } },
            {
                // Annotation: outline each reason’s peak month.
                transform: [
                    { joinaggregate: [{ op: "max", field: "share", as: "row_max" }], groupby: ["reason"] },
                    { filter: "datum.share === datum.row_max" }
                ],
                mark: { type: "rect", fillOpacity: 0, stroke: "#25332F", strokeWidth: 2 }
            },
            {
                // Annotation: print the share in the strongest cells (20% or more of a reason’s year).
                transform: [{ filter: "datum.share >= 0.2" }],
                mark: { type: "text", fontSize: 11, fontWeight: 700 },
                encoding: { text: { field: "share", type: "quantitative", format: ".0%" }, color: { value: "#FFFFFF" } }
            }
        ],
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F" } }
    };

    // Plain-language summary: the largest cell for the selected group (calculated from the same rows).
    function summarise(group) {
        const pool = group === ALL ? rows : rows.filter(r => r.animal_group === group);
        const cells = new Map();
        for (const r of pool) {
            const k = r.reason + "|" + r.month_number;
            cells.set(k, (cells.get(k) || 0) + r.count);
        }
        let best = null;
        for (const [k, v] of cells) if (!best || v > best.v) best = { k, v };
        const [reason, mn] = best.k.split("|");
        const groupTotal = pool.reduce((s, r) => s + r.count, 0);
        document.getElementById("heatmap-summary").innerHTML =
            `Largest cell for <b>${group}</b>: <b>${reason}</b> in <b>${MONTHS[Number(mn) - 1]}</b>, ` +
            `with ${best.v.toLocaleString("en-AU")} rescues (${(100 * best.v / groupTotal).toFixed(1)}% of this group’s known-reason rescues).`;

        // Key findings: computed from the same cells as the chart (shares within each reason).
        const reasons = new Map();
        for (const [k, v] of cells) {
            const [rs, m] = k.split("|");
            if (!reasons.has(rs)) reasons.set(rs, { total: 0, months: new Map() });
            const o = reasons.get(rs); o.total += v; o.months.set(Number(m), v);
        }
        const peaks = [...reasons.entries()].map(([rs, o]) => {
            let pm = 0, pv = -1;
            for (const [m, v] of o.months) if (v > pv) { pv = v; pm = m; }
            return { reason: rs, month: pm, share: pv / o.total };
        });
        const spring = peaks.filter(p => p.month >= 9 && p.month <= 11).length;
        const peaked = [...peaks].sort((a, b) => b.share - a.share);
        const most = peaked[0], least = peaked[peaked.length - 1];
        const monthTotals = new Map();
        for (const [k, v] of cells) { const m = Number(k.split("|")[1]); monthTotals.set(m, (monthTotals.get(m) || 0) + v); }
        const [busyM, busyV] = [...monthTotals.entries()].sort((a, b) => b[1] - a[1])[0];
        const pct = v => `${(100 * v).toFixed(0)}%`;
        const findings = document.getElementById("heatmap-findings");
        if (findings) findings.innerHTML =
            `<p class="dot-ov-title">Key findings · ${group}</p><ul class="insight-list heat-findings">` +
            `<li><b>${spring} of ${peaks.length}</b> reasons peak in spring (September to November).</li>` +
            `<li>Most concentrated: <b>${most.reason}</b>, ${pct(most.share)} of its rescues in ${MONTHS[most.month - 1]}.</li>` +
            `<li>Most even: <b>${least.reason}</b>; its busiest month (${MONTHS[least.month - 1]}) holds only ${pct(least.share)}.</li>` +
            `<li>Busiest month overall: <b>${MONTHS[busyM - 1]}</b>, with ${pct(busyV / groupTotal)} of known-reason rescues.</li></ul>`;
    }

    try {
        chartEl.innerHTML = "";
        document.getElementById("heatmap-controls").hidden = false;
        document.getElementById("heatmap-summary").hidden = false;
        const { view } = await vegaEmbed("#heatmap-chart", spec, { actions: false, renderer: "svg", config: window.CHART_TEXT });
        summarise(view.signal("heat_group"));
        view.addSignalListener("heat_group", (_, g) => summarise(g));
        document.getElementById("heatmap-note").innerHTML =
            `Source: ${SRC.kwok("supplementary file S8")}, 2013–14 to 2018–19. Counts are summed over the source period (no year column). Colour = each month’s share of that reason’s rescues (20% or more in the darkest shade); the outlined cell is each reason’s peak month; rows are ordered by total rescues. A blank cell has no records. Causes marked “Unknown” and rescues with no month are not included.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the heatmap: ${err.message}</p>`;
    }
})();
