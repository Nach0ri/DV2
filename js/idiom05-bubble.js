// Idiom 05: Which reasons have different outcomes?
// Bubble chart of rescue reasons by animal group, for the full period 2013–14 to 2018–19.
// Data: data/rescue_outcomes_by_group.csv = Kwok et al. (2021), Table 10 (combined period, no year breakdown).
// x = total rescues for that reason and group (the denominator); y = died (% of those rescues);
// bubble area = total rescues. "Unknown" cause is not shown.
// Died = dead, died or euthanased. Survived = released, left and observed, relocated, or permanent care.
(async function () {
    const DATA_URL = "data/rescue_outcomes_by_group.csv";
    const chartEl = document.getElementById("bubble-chart");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const COLOUR = PALETTE.group;   // shared animal-group colours
    const ADEQUATE = 100;  // minimum rescues for a cause to be used in highlights and labels
    const DEF = "Died = dead, died or euthanased. Survived = released, left and observed, relocated, or permanent care.";

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Outcome bubble chart could not be shown</h3><p>${message}</p></div>`;
    }

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

    let text;
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) { showUnavailable(`The file <code>${DATA_URL}</code> could not be found. No chart is shown and no values have been filled in.`); return; }
        text = await res.text();
    } catch (err) {
        showUnavailable(`The file <code>${DATA_URL}</code> could not be read. No chart is shown and no values have been filled in.`);
        return;
    }

    const [header, ...body] = parseCsv(text);
    const col = n => header.indexOf(n);
    const iG = col("animal_group"), iR = col("rescue_reason"), iD = col("died_pct"), iS = col("survived_pct"), iN = col("total_rescues");
    if ([iG, iR, iD, iS, iN].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Blank or non-numeric values are skipped, never treated as zero. "Unknown" is not a rescue reason and is excluded.
    const rows = body
        .filter(r => r.length >= 5 && GROUPS.includes(r[iG]) && r[iR] !== "Unknown" && /^\d+(\.\d+)?$/.test(r[iD]) && /^\d+(\.\d+)?$/.test(r[iS]) && /^\d+$/.test(r[iN]))
        .map(r => ({ animal_group: r[iG], reason: r[iR], died: Number(r[iD]), survived: Number(r[iS]), cases: Number(r[iN]) }));
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const fmt = n => Number(n).toLocaleString("en-AU");
    const groupsShown = GROUPS.filter(g => rows.some(r => r.animal_group === g));

    // Label the largest bubble, plus the highest and lowest died share among causes with adequate rescues.
    const labelled = new Set();
    labelled.add(rows.reduce((a, b) => (b.cases > a.cases ? b : a)));
    const adequate = rows.filter(r => r.cases >= ADEQUATE);
    labelled.add(adequate.reduce((a, b) => (b.died > a.died ? b : a)));
    labelled.add(adequate.reduce((a, b) => (b.died < a.died ? b : a)));
    // Also label the reason with the most estimated deaths in each animal group.
    const est = r => r.cases * r.died / 100;
    for (const g of GROUPS) {
        const inGroup = rows.filter(r => r.animal_group === g);
        if (inGroup.length) labelled.add(inGroup.reduce((a, b) => (est(b) > est(a) ? b : a)));
    }
    // The x-axis uses a log scale (set in the spec) and extends past the largest count to leave room for its label.
    const maxCases = Math.max(...rows.map(r => r.cases));
    const data = rows.map(r => ({
        ...r,
        label: labelled.has(r) ? `${r.reason} · ${r.animal_group}` : "",
        // Labels near the right edge go on the left of their bubble so they are not clipped.
        // right of the bubble (above), or left of it: below, unless the bubble is near the x-axis.
        label_pos: r.cases <= maxCases * 0.35 ? "right" : (r.died < 10 ? "left_above" : "left_below"),
        // Bubble area shows estimated deaths, so size adds a third variable instead of repeating the x-axis.
        deaths: Math.round(r.cases * r.died / 100),
        definition: DEF
    }));

    // Overall died share of the bubbles shown (estimated deaths ÷ rescues), used for the reference line.
    const sumCases = rows.reduce((t, r) => t + r.cases, 0);
    const avgDied = 100 * rows.reduce((t, r) => t + est(r), 0) / sumCases;

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: 420,
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: data },
        layer: [
            {
                mark: { type: "circle", stroke: "#25332F", strokeWidth: 0.6, opacity: 0.8 },
                encoding: {
                    // Log scale: counts run from 2 to about 25,000, so a linear axis packs most bubbles against the left edge.
                    x: { field: "cases", type: "quantitative", title: "Total rescues for this reason and group (log scale)", scale: { type: "log", domain: [1, maxCases * 2.5] }, axis: { format: ",d", values: [1, 10, 100, 1000, 10000], grid: true, gridColor: "#edf0f2", labelFontSize: 11, titleFontSize: 12 } },
                    y: { field: "died", type: "quantitative", title: "Died (% of rescues)", scale: { domain: [0, 100] }, axis: { format: "d", grid: true, tickCount: 6, labelFontSize: 11, titleFontSize: 12 } },
                    size: { field: "deaths", type: "quantitative", title: "Estimated deaths (bubble area)", scale: { type: "sqrt", range: [30, 1500], zero: true }, legend: { orient: "top", direction: "horizontal", titleFontSize: 11, labelFontSize: 11, format: ",d", values: [100, 1000, 10000] } },
                    color: {
                        field: "animal_group", type: "nominal", title: "Animal group",
                        scale: { domain: groupsShown, range: groupsShown.map(g => COLOUR[g]) },
                        legend: { orient: "top", direction: "horizontal", titleFontSize: 11, labelFontSize: 11, symbolType: "circle", symbolSize: 120 }
                    },
                    tooltip: [
                        { field: "animal_group", type: "nominal", title: "Animal group" },
                        { field: "reason", type: "nominal", title: "Rescue reason" },
                        { field: "cases", type: "quantitative", title: "Rescues (denominator)", format: ",d" },
                        { field: "died", type: "quantitative", title: "Died (%)", format: ".1f" },
                        { field: "survived", type: "quantitative", title: "Survived (%)", format: ".1f" },
                        { field: "deaths", type: "quantitative", title: "Estimated deaths", format: ",d" },
                        { field: "definition", type: "nominal", title: "Outcome definitions" }
                    ]
                }
            },
            // Annotation: dashed line at the overall died share of all bubbles shown.
            {
                data: { values: [{ avg: avgDied }] },
                mark: { type: "rule", strokeDash: [6, 4], strokeWidth: 1.2, color: "#5E6B63" },
                encoding: { y: { field: "avg", type: "quantitative" } }
            },
            {
                data: { values: [{ avg: avgDied, text: `All reasons shown: ${avgDied.toFixed(1)}% died` }] },
                mark: { type: "text", align: "left", dx: 4, dy: -7, fontSize: 11, fontStyle: "italic", color: "#5E6B63" },
                encoding: { x: { datum: 1.1, type: "quantitative" }, y: { field: "avg", type: "quantitative" }, text: { field: "text" } }
            },
            // Labels: a white halo first, then the text; labels near the right edge sit to the left of their bubble.
            ...[["right", "left", 9, -8], ["left_below", "right", -13, 17], ["left_above", "right", -13, -10]].flatMap(([pos, align, dx, dy]) => [true, false].map(halo => ({
                transform: [{ filter: `datum.label !== '' && datum.label_pos === '${pos}'` }],
                mark: { type: "text", align, dx, dy,   // offsets keep neighbouring labels and the axis clear
                        fontSize: 11, fontWeight: 600, color: "#25332F", clip: false,
                        ...(halo ? { stroke: "#FFFFFF", strokeWidth: 3.5, strokeJoin: "round" } : {}) },
                encoding: { x: { field: "cases", type: "quantitative" }, y: { field: "died", type: "quantitative" }, text: { field: "label", type: "nominal" } }
            })))
        ],
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F", domain: false, ticks: false } }
    };

    const hi = adequate.reduce((a, b) => (b.died > a.died ? b : a));
    const lo = adequate.reduce((a, b) => (b.died < a.died ? b : a));
    const total = rows.reduce((s, r) => s + r.cases, 0);
    document.getElementById("bubble-summary").innerHTML =
        `Birds, Mammals and Reptiles, 2013–14 to 2018–19 combined (${fmt(total)} rescues across ${rows.length} reason-group pairs). ` +
        `Among causes with at least ${ADEQUATE} rescues, the highest died share is <b>${hi.reason}</b> (${hi.animal_group}, ${hi.died.toFixed(1)}%) ` +
        `and the lowest is <b>${lo.reason}</b> (${lo.animal_group}, ${lo.died.toFixed(1)}%). These are associated differences, not causes.`;
    document.getElementById("bubble-summary").hidden = false;
    // Key findings, from the same rows as the chart.
    const fmt0 = n => Math.round(n).toLocaleString("en-AU");
    const deadliest = rows.reduce((a, b) => (est(b) > est(a) ? b : a));
    const byGroup = groupsShown.map(g => {
        const gr = rows.filter(r => r.animal_group === g);
        const c = gr.reduce((t, r) => t + r.cases, 0);
        return { g, died: 100 * gr.reduce((t, r) => t + est(r), 0) / c };
    }).sort((a, b) => b.died - a.died);
    const findingsEl = document.getElementById("bubble-findings");
    if (findingsEl) findingsEl.innerHTML =
        `<p class="dot-ov-title">Key findings</p><ul class="insight-list heat-findings bubble-findings-list">` +
        `<li>Most estimated deaths: <b>${deadliest.reason}</b> (${deadliest.animal_group}), about ${fmt0(est(deadliest))}.</li>` +
        `<li>Across all bubbles, <b>${avgDied.toFixed(1)}%</b> of rescues died (dashed line).</li>` +
        `<li>Died share by group: ` + byGroup.map(b => `<b>${b.g}</b> ${b.died.toFixed(1)}%`).join(", ") + `.</li></ul>`;
    document.getElementById("bubble-note").innerHTML =
        `Source: ${SRC.kwok("Table 10")}, combined reporting period 2013–14 to 2018–19. ${DEF} ` +
        `Denominator for each percentage: the total rescues shown for that reason and group. Bubble area = estimated deaths (rescues × published died %, rounded). Unknown cause is not shown.`;

    try {
        chartEl.innerHTML = "";
        await vegaEmbed(chartEl, spec, { actions: false, renderer: "svg", config: window.CHART_TEXT });
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
