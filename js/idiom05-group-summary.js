// Idiom 05 (supporting chart): full-period outcome summary by animal group.
// Data: data/outcomes_by_group_full_period_table8.csv = Kwok et al. (2021), Table 8 (2013–14 to 2018–19 combined).
// Not combined with Table 10 or S9. Segment widths are the source counts divided by each group's total rescues.
// Labels show the published percentages. "Released" is the source's own category.
(async function () {
    const DATA_URL = "data/outcomes_by_group_full_period_table8.csv";
    const chartEl = document.getElementById("group-summary");
    const noteEl = document.getElementById("group-summary-note");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    // Stack order (left to right) and colours, using the project palette.
    const OUTCOMES = [
        { name: "Died", colour: "#C66B4E" },
        { name: "Left and observed", colour: "#D49A38" },
        { name: "Released", colour: "#397DA5" },
        { name: "Permanent/long term care", colour: "#176B60" },
        { name: "Escaped rescuer or from care", colour: "#8A968F" }
    ];
    const LABEL_MIN_SHARE = 0.05; // only segments of 5% or more get a label

    function parseCsv(text) {
        return text.trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#")).map(line => {
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

    function showUnavailable(message) {
        chartEl.innerHTML = `<div class="placeholder" role="note"><span class="tag">Data unavailable</span><p>${message}</p></div>`;
    }

    let text;
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) { showUnavailable(`The file <code>${DATA_URL}</code> could not be found. No chart is shown.`); return; }
        text = await res.text();
    } catch (err) {
        showUnavailable(`The file <code>${DATA_URL}</code> could not be read. No chart is shown.`);
        return;
    }

    const [header, ...body] = parseCsv(text);
    const col = n => header.indexOf(n);
    const iG = col("animal_group"), iO = col("outcome_category"), iN = col("number_of_rescues"), iP = col("published_percent"), iT = col("group_total_rescues");
    if ([iG, iO, iN, iP, iT].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    const rows = body
        .filter(r => r.length >= 5 && GROUPS.includes(r[iG]) && /^\d+$/.test(r[iN]) && /^\d+$/.test(r[iT]))
        .map(r => ({ animal_group: r[iG], outcome: r[iO], n: Number(r[iN]), total: Number(r[iT]), published: r[iP] }));
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown.`); return; }

    // Segment centres for the labels: cumulative share in stack order.
    const outcomeIndex = new Map(OUTCOMES.map((o, i) => [o.name, i]));
    rows.forEach(r => { r.share = r.n / r.total; r.order = outcomeIndex.has(r.outcome) ? outcomeIndex.get(r.outcome) : 99; });
    for (const g of GROUPS) {
        let start = 0;
        rows.filter(r => r.animal_group === g).sort((a, b) => a.order - b.order).forEach(r => {
            r.center = +(start + r.share / 2).toFixed(4);
            start += r.share;
        });
    }
    rows.forEach(r => { r.label = r.share >= LABEL_MIN_SHARE ? `${r.published}%` : ""; });

    const fmt = n => Number(n).toLocaleString("en-AU");
    const present = OUTCOMES.filter(o => rows.some(r => r.outcome === o.name));

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: 170,
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: rows },
        layer: [
            {
                mark: { type: "bar", stroke: "#F5F7F2", strokeWidth: 1, height: { band: 0.7 } },
                encoding: {
                    y: { field: "animal_group", type: "nominal", sort: GROUPS, title: null, axis: { labelFontSize: 12, labelFontWeight: 600, ticks: false, domain: false } },
                    x: { aggregate: "sum", field: "n", type: "quantitative", stack: "normalize", title: "Share of each group's rescues (%)", axis: { format: "%", values: [0, 0.25, 0.5, 0.75, 1], grid: false, labelFontSize: 11, titleFontSize: 11.5, domain: false } },
                    color: {
                        field: "outcome", type: "nominal", title: "Outcome category (Table 8)",
                        scale: { domain: present.map(o => o.name), range: present.map(o => o.colour) },
                        legend: { orient: "bottom", direction: "horizontal", columns: 3, titleFontSize: 11.5, labelFontSize: 11, symbolType: "square", symbolSize: 110 }
                    },
                    order: { field: "order", type: "quantitative" },
                    tooltip: [
                        { field: "animal_group", type: "nominal", title: "Animal group" },
                        { field: "outcome", type: "nominal", title: "Outcome category" },
                        { field: "n", type: "quantitative", title: "Rescues", format: ",d" },
                        { field: "published", type: "nominal", title: "Published % of group total" },
                        { field: "total", type: "quantitative", title: "Group total rescues (denominator)", format: ",d" }
                    ]
                }
            },
            {
                transform: [{ filter: "datum.label !== ''" }],
                mark: { type: "text", fontSize: 11, fontWeight: 600, color: "#FFFFFF" },
                encoding: {
                    y: { field: "animal_group", type: "nominal", sort: GROUPS },
                    x: { field: "center", type: "quantitative" },
                    text: { field: "label", type: "nominal" }
                }
            }
        ],
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F" } }
    };

    try {
        chartEl.innerHTML = "";
        await vegaEmbed(chartEl, spec, { actions: false, renderer: "svg" });
        if (noteEl) noteEl.textContent =
            `Full-period summary (2013–14 to 2018–19) from Kwok et al. (2021), Table 8. ` +
            `Totals: Birds ${fmt(rows.find(r => r.animal_group === "Birds").total)}, Mammals ${fmt(rows.find(r => r.animal_group === "Mammals").total)}, ` +
            `Reptiles ${fmt(rows.find(r => r.animal_group === "Reptiles").total)} rescues. Table 8 gives no breakdown by year or rescue reason and is not combined with Table 10 or S9. ` +
            `Categories are as labelled in the source; “Released” is the source's category and is not a measure of recovery.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
