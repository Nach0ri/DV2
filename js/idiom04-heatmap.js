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
            { calculate: "heat_group", as: "group_label" }
        ],
        mark: { type: "rect", stroke: "#ffffff", strokeWidth: 1 },
        encoding: {
            x: {
                field: "month_short", type: "ordinal", sort: SHORT, title: null,
                axis: { labelAngle: 0, labelFontSize: 11, orient: "top", domain: false, ticks: false }
            },
            y: {
                field: "reason", type: "nominal", title: null,
                sort: { op: "sum", field: "rescues", order: "descending" },
                axis: { labelLimit: 240, labelFontSize: 11, domain: false, ticks: false }
            },
            color: {
                field: "rescues", type: "quantitative", title: "Rescues",
                scale: { scheme: "blues" },
                legend: { orient: "bottom", direction: "horizontal", gradientLength: 260, titleFontSize: 11, labelFontSize: 10, format: ",d" }
            },
            tooltip: [
                { field: "reason", type: "nominal", title: "Reason" },
                { field: "month", type: "nominal", title: "Month" },
                { field: "rescues", type: "quantitative", title: "Rescues", format: ",d" },
                { field: "group_label", type: "nominal", title: "Animal group" }
            ]
        },
        config: { view: { stroke: null }, font: "Avenir, Segoe UI, Verdana, sans-serif", axis: { labelColor: "#3e4a55", titleColor: "#3e4a55" } }
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
        const monthTotal = pool.filter(r => r.month_number === Number(mn)).reduce((s, r) => s + r.count, 0);
        const groupTotal = pool.reduce((s, r) => s + r.count, 0);
        document.getElementById("heatmap-summary").innerHTML =
            `Largest cell for <b>${group}</b>: <b>${reason}</b> in <b>${MONTHS[Number(mn) - 1]}</b>, ` +
            `with ${best.v.toLocaleString("en-AU")} rescues (${(100 * best.v / groupTotal).toFixed(1)}% of this group’s known-reason rescues).`;
    }

    try {
        chartEl.innerHTML = "";
        document.getElementById("heatmap-controls").hidden = false;
        document.getElementById("heatmap-summary").hidden = false;
        const { view } = await vegaEmbed("#heatmap-chart", spec, { actions: false, renderer: "svg" });
        summarise(view.signal("heat_group"));
        view.addSignalListener("heat_group", (_, g) => summarise(g));
        document.getElementById("heatmap-note").textContent =
            `Source: ${DATA_URL}. Counts are summed over the source period (no year column). Causes marked “Unknown” and rescues with no month are not included.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the heatmap: ${err.message}</p>`;
    }
})();
