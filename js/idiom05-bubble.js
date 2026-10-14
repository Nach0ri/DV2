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
    const COLOUR = { Birds: "#397DA5", Mammals: "#D49A38", Reptiles: "#176B60" }; // River Blue, Golden Ochre, Forest Teal
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
    // The x-axis starts at zero (counts cannot be negative) and leaves room for the labels on the right.
    const maxCases = Math.max(...rows.map(r => r.cases));
    const data = rows.map(r => ({
        ...r,
        label: labelled.has(r) ? r.reason : "",
        definition: DEF
    }));

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
                    x: { field: "cases", type: "quantitative", title: "Total rescues for this reason and group (denominator)", scale: { zero: true, domainMin: 0, domainMax: maxCases * 1.12 }, axis: { format: ",d", grid: false, labelFontSize: 11, titleFontSize: 12 } },
                    y: { field: "died", type: "quantitative", title: "Died (% of rescues)", scale: { domain: [0, 100] }, axis: { format: "d", grid: true, tickCount: 6, labelFontSize: 11, titleFontSize: 12 } },
                    size: { field: "cases", type: "quantitative", title: "Rescues (bubble area)", scale: { type: "sqrt", range: [30, 1500], zero: true }, legend: { orient: "bottom", direction: "horizontal", titleFontSize: 11, labelFontSize: 10, format: ",d", values: [100, 1000, 10000] } },
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
                        { field: "definition", type: "nominal", title: "Outcome definitions" }
                    ]
                }
            },
            {
                transform: [{ filter: "datum.label !== ''" }],
                mark: { type: "text", align: "left", dx: 9, dy: -6, fontSize: 11, fontWeight: 600, stroke: "#F5F7F2", strokeWidth: 3, color: "#25332F", clip: false },
                encoding: { x: { field: "cases", type: "quantitative" }, y: { field: "died", type: "quantitative" }, text: { field: "label", type: "nominal" } }
            },
            {
                transform: [{ filter: "datum.label !== ''" }],
                mark: { type: "text", align: "left", dx: 9, dy: -6, fontSize: 11, fontWeight: 600, color: "#25332F", clip: false },
                encoding: { x: { field: "cases", type: "quantitative" }, y: { field: "died", type: "quantitative" }, text: { field: "label", type: "nominal" } }
            }
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
    document.getElementById("bubble-note").textContent =
        `Source: Kwok et al. (2021), Table 10 (${DATA_URL}), combined reporting period 2013–14 to 2018–19. ${DEF} ` +
        `Denominator for each percentage: the total rescues shown for that reason and group. Unknown cause is not shown.`;

    try {
        chartEl.innerHTML = "";
        await vegaEmbed(chartEl, spec, { actions: false, renderer: "svg" });
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
