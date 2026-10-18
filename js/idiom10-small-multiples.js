// Idiom 10: Do rescue patterns differ by species group?
// Small multiples: one panel per animal group, showing each month's share of that group's annual rescues.
// Data: data/rescue_monthly_by_group.csv = Kwok et al. (2021), supplementary file S7 (2013–14 to 2018–19).
// Shares are used (not raw counts) so the seasonal shape can be compared across groups of very different size.
// Line = mean of the six years; band = lowest to highest year. No values are interpolated or invented.
(async function () {
    const DATA_URL = "data/rescue_monthly_by_group.csv";
    const chartEl = document.getElementById("small-multiples-chart");
    const insightEl = document.getElementById("sm-insight");
    const noteEl = document.getElementById("sm-note");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const COLOUR = { Birds: "#397DA5", Mammals: "#D49A38", Reptiles: "#176B60" }; // project palette, same as Idiom 05
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const LETTERS = "JFMAMJJASOND";

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Monthly patterns could not be shown</h3><p>${message}</p></div>`;
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
    const iY = col("financial_year"), iM = col("month_number"), iG = col("animal_group"), iC = col("rescue_count");
    if ([iY, iM, iG, iC].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Sum sub-groups into one count per group, year and month. Blank counts are skipped, never treated as zero.
    const monthly = new Map();
    for (const r of body) {
        if (!GROUPS.includes(r[iG]) || !/^\d+$/.test(r[iC])) continue;
        const key = `${r[iG]}|${r[iY]}|${Number(r[iM])}`;
        monthly.set(key, (monthly.get(key) || 0) + Number(r[iC]));
    }
    const years = [...new Set(body.map(r => r[iY]))].sort();
    if (monthly.size === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    // Coverage check: every group, year and month must have a value. If not, show an error rather than guess.
    const expected = GROUPS.length * years.length * 12;
    if (monthly.size !== expected) {
        showUnavailable(`The file <code>${DATA_URL}</code> has ${monthly.size} of ${expected} group-year-month values. The chart is not drawn to avoid showing incomplete months as zero.`);
        return;
    }

    // For each group and month: each year's share of that group's annual rescues, then the mean, min and max across years.
    const data = [];
    for (const g of GROUPS) {
        const yearTotal = Object.fromEntries(years.map(y => [y, 0]));
        for (const y of years) for (let m = 1; m <= 12; m++) yearTotal[y] += monthly.get(`${g}|${y}|${m}`);
        for (let m = 1; m <= 12; m++) {
            const shares = years.map(y => 100 * monthly.get(`${g}|${y}|${m}`) / yearTotal[y]);
            const counts = years.map(y => monthly.get(`${g}|${y}|${m}`));
            const mean = shares.reduce((s, v) => s + v, 0) / shares.length;
            data.push({
                animal_group: g,
                month_number: m,
                month: MONTHS[m - 1],
                mean_pct: +mean.toFixed(2),
                min_pct: +Math.min(...shares).toFixed(2),
                max_pct: +Math.max(...shares).toFixed(2),
                avg_count: Math.round(counts.reduce((s, v) => s + v, 0) / counts.length),
                years_n: years.length
            });
        }
    }

    // Plain-language annotation, computed from the same shares as the chart.
    const stats = GROUPS.map(g => {
        const rows = data.filter(d => d.animal_group === g);
        const peak = rows.reduce((a, b) => (b.mean_pct > a.mean_pct ? b : a));
        const low = rows.reduce((a, b) => (b.mean_pct < a.mean_pct ? b : a));
        return { g, peak, low, ratio: peak.mean_pct / low.mean_pct };
    });
    const rep = stats.find(s => s.g === "Reptiles"), bird = stats.find(s => s.g === "Birds"), mam = stats.find(s => s.g === "Mammals");
    const pct = v => `${v.toFixed(0)}%`;
    insightEl.innerHTML =
        `<b>Reptiles</b> are the most seasonal: ${pct(rep.peak.mean_pct)} of their rescues fall in ${rep.peak.month}, ` +
        `but only ${pct(rep.low.mean_pct)} in ${rep.low.month} (${rep.ratio.toFixed(1)}× difference). ` +
        `<b>Birds</b> peak in ${bird.peak.month} (${bird.ratio.toFixed(1)}× from their lowest month), ` +
        `and <b>Mammals</b> vary least (${mam.ratio.toFixed(1)}×).`;
    insightEl.hidden = false;

    // Shared y-axis: the same 0 to rounded maximum in every panel, so heights can be compared directly.
    const yMax = Math.ceil(Math.max(...data.map(d => d.max_pct)) / 5) * 5;

    // One panel per group, stacked vertically with a horizontal title. Each panel is its own chart so the
    // group label sits above it rather than to the side.
    function panel(g, width) {
        return {
            title: { text: g, anchor: "start", fontSize: 13, fontWeight: 600, color: "#25332F", offset: 6 },
            width,
            height: 96,
            data: { values: data.filter(d => d.animal_group === g) },
            layer: [
                {
                    mark: { type: "area", opacity: 0.2, color: COLOUR[g] },
                    encoding: {
                        x: { field: "month_number", type: "quantitative", scale: { domain: [1, 12] }, axis: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], labelExpr: `substring('${LETTERS}', datum.value - 1, datum.value)`, title: null, grid: false, ticks: false, domain: false, labelFontSize: 11, labelOverlap: false } },
                        y: { field: "min_pct", type: "quantitative", scale: { domain: [0, yMax] }, title: "% of year", axis: { values: [0, 5, 10, 15].filter(v => v <= yMax), grid: true, gridColor: "#edf0f2", domain: false, ticks: false, labelFontSize: 10.5, titleFontSize: 10.5 } },
                        y2: { field: "max_pct" }
                    }
                },
                {
                    mark: { type: "line", strokeWidth: 2, color: COLOUR[g] },
                    encoding: { x: { field: "month_number", type: "quantitative" }, y: { field: "mean_pct", type: "quantitative" } }
                },
                {
                    mark: { type: "point", filled: true, size: 26, color: COLOUR[g] },
                    encoding: {
                        x: { field: "month_number", type: "quantitative" },
                        y: { field: "mean_pct", type: "quantitative" },
                        tooltip: [
                            { field: "animal_group", type: "nominal", title: "Animal group" },
                            { field: "month", type: "nominal", title: "Month" },
                            { field: "mean_pct", type: "quantitative", title: "Mean share of year (%)", format: ".1f" },
                            { field: "min_pct", type: "quantitative", title: "Lowest year (%)", format: ".1f" },
                            { field: "max_pct", type: "quantitative", title: "Highest year (%)", format: ".1f" },
                            { field: "avg_count", type: "quantitative", title: "Average rescues in this month", format: ",d" },
                            { field: "years_n", type: "quantitative", title: "Years averaged" }
                        ]
                    }
                }
            ]
        };
    }

    // Vega-Lite does not size this chart to its container, so the width is read from the page and the chart is redrawn on resize.
    // The y-axis labels sit outside the plot area, so leave room for them.
    const drawWidth = () => Math.max(220, Math.floor(chartEl.getBoundingClientRect().width) - 48);
    const buildSpec = width => ({
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        vconcat: GROUPS.map(g => panel(g, width)),
        spacing: 12,
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F" } }
    });

    async function draw() {
        chartEl.innerHTML = "";
        await vegaEmbed(chartEl, buildSpec(drawWidth()), { actions: false, renderer: "svg" });
    }

    try {
        await draw();
        let timer;
        window.addEventListener("resize", () => {
            clearTimeout(timer);
            timer = setTimeout(() => draw().catch(err => console.error(err)), 200);
        });
        if (noteEl) noteEl.innerHTML =
            `Source: Kwok, A. B. C., Haering, R., Travers, S. K., &amp; Stathis, P. (2021). <i>PLOS ONE</i>, supplementary file S7 ` +
            `(<a href="https://doi.org/10.1371/journal.pone.0257209">doi:10.1371/journal.pone.0257209</a>), rescues 2013–14 to 2018–19. ` +
            `Transformation for this chart: sub-groups summed to each animal group, month and year; each month’s share = that month’s rescues ÷ the group’s rescues in that year. ` +
            `Line = mean of six years; band = lowest to highest year. Only Birds, Mammals and Reptiles appear in S7; not combined with Table 10 or S9.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
