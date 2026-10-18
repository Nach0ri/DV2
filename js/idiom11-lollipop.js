// Idiom 11: Which species have the lowest rescue counts?
// Lollipop chart of the 15 least frequently recorded animal sub-groups, 2013–14 to 2018–19.
// Data: data/rescue_monthly_by_group.csv = Kwok et al. (2021), supplementary file S7.
// Sub-groups are not all single species (e.g. "Emu" and "Platypus" are species; "Geckoes" and "Rodents" are broader).
// Sub-groups named "Unknown" or "Unidentified" are not categories and are excluded before ranking.
// Counts are summed over all 72 months of the period. Nothing is interpolated; no absent sub-group is set to zero.
(async function () {
    const DATA_URL = "data/rescue_monthly_by_group.csv";
    const chartEl = document.getElementById("lollipop-chart");
    const insightEl = document.getElementById("lp-insight");
    const noteEl = document.getElementById("lp-note");
    const TOP_N = 15;          // lowest-count sub-groups shown
    const HIGHLIGHT_N = 3;     // restrained highlight for the lowest few
    const COL = { highlight: "#C66B4E", other: "#397DA5", stem: "#B9C2BC", text: "#25332F" }; // Terracotta, River Blue, stem, Deep Charcoal
    const EXCLUDE = /unknown|unidentified/i;

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Lowest-count chart could not be shown</h3><p>${message}</p></div>`;
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

    // Columns: financial_year, month_number, month, animal_group, sub_group, rescue_count
    const [header, ...body] = parseCsv(text);
    const col = n => header.indexOf(n);
    const iY = col("financial_year"), iM = col("month_number"), iG = col("animal_group"), iS = col("sub_group"), iC = col("rescue_count");
    if ([iY, iM, iG, iS, iC].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Sum each group and sub-group over the whole period. Blank counts are skipped, never treated as zero.
    const totals = new Map();
    const periods = new Set();
    let skipped = 0;
    for (const r of body) {
        if (!/^\d+$/.test(r[iC])) continue;
        periods.add(r[iY]);
        const key = `${r[iG]}|${r[iS]}`;
        totals.set(key, (totals.get(key) || 0) + Number(r[iC]));
    }
    const all = [...totals.entries()].map(([k, count]) => {
        const [group, sub] = k.split("|");
        return { group, sub, count };
    });
    const valid = all.filter(d => { if (EXCLUDE.test(d.sub)) { skipped++; return false; } return true; });
    if (valid.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const sorted = valid.sort((a, b) => a.count - b.count || a.sub.localeCompare(b.sub));
    const shown = sorted.slice(0, TOP_N).map((d, i) => ({
        ...d,
        label: `${d.sub} (${d.group})`,
        zero: 0,
        status: i < HIGHLIGHT_N ? "Lowest three" : "Other sub-groups",
        rank: i + 1
    }));
    const labels = shown.map(d => d.label);
    const yearsList = [...periods].sort();
    const periodText = `${yearsList[0].replace("-", "–")} to ${yearsList[yearsList.length - 1].replace("-", "–")}`;
    const fmt = n => Number(n).toLocaleString("en-AU");
    const maxCount = Math.max(...shown.map(d => d.count));

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: { step: 24 },
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: shown },
        layer: [
            {
                mark: { type: "rule", strokeWidth: 1.5, color: COL.stem },
                encoding: {
                    y: { field: "label", type: "nominal", sort: labels, title: null, axis: { labelLimit: 170, labelFontSize: 11.5, labelColor: COL.text, ticks: false, domain: false } },
                    x: { field: "zero", type: "quantitative" },
                    x2: { field: "count", type: "quantitative" }
                }
            },
            {
                mark: { type: "circle", size: 130, opacity: 1 },
                encoding: {
                    y: { field: "label", type: "nominal", sort: labels },
                    x: { field: "count", type: "quantitative", title: "Rescues (full period)", scale: { domain: [0, Math.ceil(maxCount * 1.25 / 500) * 500] }, axis: { format: ",d", grid: false, labelFontSize: 11, titleFontSize: 12, domain: false, ticks: false } },
                    color: {
                        field: "status", type: "nominal",
                        scale: { domain: ["Lowest three", "Other sub-groups"], range: [COL.highlight, COL.other] },
                        legend: null
                    },
                    tooltip: [
                        { field: "rank", type: "quantitative", title: "Rank (lowest = 1)" },
                        { field: "sub", type: "nominal", title: "Sub-group" },
                        { field: "group", type: "nominal", title: "Animal group" },
                        { field: "count", type: "quantitative", title: "Rescues, full period", format: ",d" }
                    ]
                }
            },
            {
                mark: { type: "text", align: "left", dx: 10, fontSize: 11.5, fontWeight: 600, color: COL.text },
                encoding: {
                    y: { field: "label", type: "nominal", sort: labels },
                    x: { field: "count", type: "quantitative" },
                    text: { field: "count", type: "quantitative", format: ",d" }
                }
            }
        ],
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: COL.text, titleColor: COL.text } }
    };

    const [first, second, third] = shown;
    insightEl.innerHTML =
        `The lowest recorded sub-groups are <b>${first.sub}</b> (${fmt(first.count)} rescues), <b>${second.sub}</b> (${fmt(second.count)}) ` +
        `and <b>${third.sub}</b> (${fmt(third.count)}). Low recorded counts do not necessarily mean a sub-group is rare or at greater conservation risk: ` +
        `they can also reflect rescue activity, reporting coverage, species identification and data availability.`;
    insightEl.hidden = false;

    try {
        chartEl.innerHTML = "";
        await vegaEmbed(chartEl, spec, { actions: false, renderer: "svg" });
        if (noteEl) noteEl.innerHTML =
            `Source: Kwok, A. B. C., Haering, R., Travers, S. K., &amp; Stathis, P. (2021). <i>PLOS ONE</i>, supplementary file S7 ` +
            `(<a href="https://doi.org/10.1371/journal.pone.0257209">doi:10.1371/journal.pone.0257209</a>), rescues ${periodText}. ` +
            `Transformation for this chart: sub-groups summed across all months and years; the ${TOP_N} lowest counts shown (terracotta = the lowest ${HIGHLIGHT_N}), after excluding ` +
            `${skipped} “Unknown” or “Unidentified” sub-group${skipped === 1 ? "" : "s"}. Sub-groups are not all single species. Not combined with Table 10 or S9.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
