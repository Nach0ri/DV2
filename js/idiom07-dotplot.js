// Idiom 07: Which regions record the most rescues?
// Connected dot plot of recorded rescues by LGA, 2018–19 vs 2024–25.
// Data: data/rescue_counts_by_lga.csv (NSW dashboard, Number of rescues by LGA and financial year).
// Only LGAs with a count in both years are compared (131 of 131). Shows the top 15 by 2024–25 count.
// Counts are not population-adjusted and reflect where animals were found and reported.
(async function () {
    const DATA_URL = "data/rescue_counts_by_lga.csv";
    const chartEl = document.getElementById("vis-07-connected-dot");
    const Y1 = "2018/19", Y2 = "2024/25";
    const L1 = "2018–19", L2 = "2024–25";
    const TOP_N = 15;
    const COLOUR = { [L1]: "#D49A38", [L2]: "#176B60" }; // Golden Ochre (earlier), Forest Teal (later)
    const RULE = "#B9B2A3";

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Connected dot plot could not be shown</h3><p>${message}</p></div>`;
    }

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

    const [header, ...body] = parseCsv(text);
    const col = n => header.indexOf(n);
    const iL = col("lga_name"), iY = col("financial_year"), iN = col("rescue_count");
    if ([iL, iY, iN].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Keep only numeric counts for the two years. Blank values are skipped, never treated as zero.
    const byLga = new Map();
    for (const r of body) {
        if (r.length < 3 || r[iL] === "LGA not recorded" || !/^\d+$/.test(r[iN])) continue;
        if (r[iY] !== Y1 && r[iY] !== Y2) continue;
        if (!byLga.has(r[iL])) byLga.set(r[iL], {});
        byLga.get(r[iL])[r[iY]] = Number(r[iN]);
    }
    const both = [...byLga.entries()].filter(([, v]) => v[Y1] !== undefined && v[Y2] !== undefined);
    if (both.length === 0) { showUnavailable(`No LGA has counts in both ${L1} and ${L2}. No chart is shown.`); return; }

    // Top N by the later year. Order: largest 2024–25 count first.
    const top = both.sort((a, b) => b[1][Y2] - a[1][Y2]).slice(0, TOP_N).map(([name, v]) => ({ name, a: v[Y1], b: v[Y2] }));
    const order = top.map(d => d.name);
    const fmt = n => n.toLocaleString("en-AU");

    const pairs = top.map(d => ({ lga: d.name, lo: Math.min(d.a, d.b), hi: Math.max(d.a, d.b) }));
    const points = [];
    for (const d of top) {
        points.push({ lga: d.name, period: L1, count: d.a, change: d.b - d.a });
        points.push({ lga: d.name, period: L2, count: d.b, change: d.b - d.a });
    }

    const rose = both.filter(([, v]) => v[Y2] > v[Y1]).length;
    const fell = both.filter(([, v]) => v[Y2] < v[Y1]).length;
    const same = both.length - rose - fell;
    const biggestRise = [...top].sort((x, y) => (y.b - y.a) - (x.b - x.a))[0];
    const fallers = top.filter(d => d.b < d.a).sort((x, y) => (x.b - x.a) - (y.b - y.a));

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: TOP_N * 26 + 60,
        autosize: { type: "fit-x", contains: "padding" },
        config: { view: { stroke: null }, font: "IBM Plex Sans, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F", domain: false, ticks: false, grid: false } },
        layer: [
            {
                data: { values: pairs },
                mark: { type: "rule", strokeWidth: 2.5, color: RULE },
                encoding: {
                    y: { field: "lga", type: "nominal", sort: order, title: null, axis: { labelLimit: 190, labelFontSize: 12 } },
                    x: { field: "lo", type: "quantitative", title: "Recorded rescues (count)", axis: { format: ",d", labelFontSize: 11, titleFontSize: 12, tickCount: 6 }, scale: { zero: true } },
                    x2: { field: "hi" }
                }
            },
            {
                data: { values: points },
                mark: { type: "point", filled: true, size: 85, stroke: "#FFFFFF", strokeWidth: 1 },
                encoding: {
                    y: { field: "lga", type: "nominal", sort: order },
                    x: { field: "count", type: "quantitative" },
                    color: { field: "period", type: "nominal", sort: [L1, L2], scale: { domain: [L1, L2], range: [COLOUR[L1], COLOUR[L2]] }, legend: { title: "Financial year", orient: "top", direction: "horizontal", labelFontSize: 12, titleFontSize: 12, symbolType: "circle", symbolSize: 120 } },
                    tooltip: [
                        { field: "lga", type: "nominal", title: "LGA" },
                        { field: "period", type: "nominal", title: "Financial year" },
                        { field: "count", type: "quantitative", title: "Recorded rescues", format: ",d" },
                        { field: "change", type: "quantitative", title: `Change, ${L1} to ${L2}`, format: "+,d" }
                    ]
                }
            }
        ]
    };

    try {
        chartEl.innerHTML = "";
        await vegaEmbed("#vis-07-connected-dot", spec, { actions: false, renderer: "svg" });
        const note = document.getElementById("dot-note");
        if (note) note.innerHTML =
            `<b>${rose}</b> of ${both.length} LGAs recorded more rescues in ${L2} than in ${L1}, ${fell} recorded fewer, and ${same} the same. ` +
            `Largest rise among the ${TOP_N} shown: <b>${biggestRise.name}</b> (${fmt(biggestRise.a)} to ${fmt(biggestRise.b)}). ` +
            (fallers.length ? `Largest fall among the ${TOP_N} shown: <b>${fallers[0].name}</b> (${fmt(fallers[0].a)} to ${fmt(fallers[0].b)}). ` : `None of the ${TOP_N} LGAs shown recorded a fall. `) +
            `Counts are not population-adjusted and reflect where animals were found and reported.`;
        const source = document.getElementById("dot-source");
        if (source) source.textContent = `Source: ${DATA_URL}, NSW wildlife rehabilitation data dashboard. The ${TOP_N} LGAs were chosen by their ${L2} count.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
