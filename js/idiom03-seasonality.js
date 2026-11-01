// Idiom 03: When do wildlife rescues peak, and how does seasonality differ by animal group?
// Multi-series line chart (Vega-Lite) of monthly rescues by animal group, read from data/rescue_monthly_by_group.csv.
// The CSV is at sub-group level; this script sums sub-groups into animal groups (disjoint, so no double counting).
// "All years (average)" = mean of each year's monthly total for the group. A single year shows that year's counts.
(async function () {
    const DATA_URL = "data/rescue_monthly_by_group.csv";
    const chartEl = document.getElementById("seasonality-chart");
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const SHORT = MONTHS.map(m => m.slice(0, 3));
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const COLOURS = ["#397DA5", "#D49A38", "#176B60"];
    const ALL = "All years (average)";

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Seasonality chart could not be shown</h3><p>${message}</p></div>`;
    }

    // Minimal CSV parser that respects quoted fields (sub-group names can contain commas).
    function parseCsv(text) {
        const rows = [];
        for (const line of text.trim().split(/\r?\n/)) {
            const cells = []; let cur = ""; let q = false;
            for (const ch of line) {
                if (ch === '"') q = !q;
                else if (ch === "," && !q) { cells.push(cur); cur = ""; }
                else cur += ch;
            }
            cells.push(cur);
            rows.push(cells.map(c => c.trim()));
        }
        return rows;
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
    const col = name => header.indexOf(name);
    const iFy = col("financial_year"), iMn = col("month_number"), iMonth = col("month"), iGrp = col("animal_group"), iCount = col("rescue_count");
    if ([iFy, iMn, iMonth, iGrp, iCount].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Sum sub-groups into animal groups for each financial year and month.
    const sums = new Map();
    for (const r of body) {
        if (r.length < 6) continue;
        const count = /^\d+$/.test(r[iCount]) ? Number(r[iCount]) : null;
        if (count === null) continue; // blank counts are skipped, never treated as zero
        const key = [r[iFy], Number(r[iMn]), r[iMonth], r[iGrp]].join("|");
        sums.set(key, (sums.get(key) || 0) + count);
    }
    const rows = [...sums.entries()].map(([key, count]) => {
        const [financial_year, month_number, month, animal_group] = key.split("|");
        return { financial_year, month_number: Number(month_number), month, month_short: month.slice(0, 3), animal_group, count };
    });
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const years = [...new Set(rows.map(r => r.financial_year))].sort();
    const showYear = y => y.replace(/[-\/]/, "–");
    const yearOptions = [ALL, ...years.map(showYear)];

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: 320,
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: rows },
        params: [
            { name: "season_year", value: ALL, bind: { input: "select", options: yearOptions, name: "Year ", element: "#season-year" } }
        ],
        transform: [
            // The dropdown shows en-dash years; compare against the file's hyphen form.
            { calculate: "season_year === '" + ALL + "' || replace(datum.financial_year, '-', '–') === season_year ? 1 : 0", as: "keep" },
            { filter: "datum.keep === 1" },
            // Mean across the selected year(s): one row per month and group.
            { aggregate: [{ op: "mean", field: "count", as: "count" }], groupby: ["month_number", "month", "month_short", "animal_group"] },
            { calculate: "season_year === '" + ALL + "' ? 'Average of " + showYear(years[0]) + " to " + showYear(years[years.length - 1]) + "' : season_year", as: "period" }
        ],
        layer: [
            {
                mark: { type: "line", strokeWidth: 2.5 },
                encoding: {
                    x: { field: "month_short", type: "ordinal", sort: SHORT, title: "Month (calendar order)", axis: { labelAngle: 0, labelFontSize: 11, titleFontSize: 11, domain: false, ticks: false } },
                    y: { field: "count", type: "quantitative", title: "Rescues per month", axis: { format: ",d", grid: true, tickCount: 5, labelFontSize: 11, titleFontSize: 11, domain: false } },
                    color: { field: "animal_group", type: "nominal", scale: { domain: GROUPS, range: COLOURS }, legend: { title: "Animal group", orient: "top", labelFontSize: 11, titleFontSize: 11.5, symbolSize: 120 } },
                    tooltip: [
                        { field: "month", type: "nominal", title: "Month" },
                        { field: "animal_group", type: "nominal", title: "Group" },
                        { field: "count", type: "quantitative", title: "Rescues", format: ",.0f" },
                        { field: "period", type: "nominal", title: "Financial year" }
                    ]
                }
            },
            {
                mark: { type: "point", filled: true, size: 45 },
                encoding: {
                    x: { field: "month_short", type: "ordinal", sort: SHORT },
                    y: { field: "count", type: "quantitative" },
                    color: { field: "animal_group", type: "nominal", scale: { domain: GROUPS, range: COLOURS }, legend: null },
                    tooltip: [
                        { field: "month", type: "nominal", title: "Month" },
                        { field: "animal_group", type: "nominal", title: "Group" },
                        { field: "count", type: "quantitative", title: "Rescues", format: ",.0f" },
                        { field: "period", type: "nominal", title: "Financial year" }
                    ]
                }
            },
            {
                // White halo under the peak labels so they stay readable where lines cross.
                transform: [
                    { joinaggregate: [{ op: "max", field: "count", as: "group_max" }], groupby: ["animal_group"] },
                    { filter: "datum.count === datum.group_max" },
                    { calculate: "'Peak: ' + datum.month_short", as: "peak_label" }
                ],
                mark: { type: "text", dy: -12, fontSize: 11, fontWeight: 700, stroke: "#FFFFFF", strokeWidth: 4, strokeJoin: "round" },
                encoding: {
                    x: { field: "month_short", type: "ordinal", sort: SHORT },
                    y: { field: "count", type: "quantitative" },
                    text: { field: "peak_label" },
                    color: { value: "#FFFFFF" }
                }
            },
            {
                // Annotation: each group’s peak month for the selected period.
                transform: [
                    { joinaggregate: [{ op: "max", field: "count", as: "group_max" }], groupby: ["animal_group"] },
                    { filter: "datum.count === datum.group_max" },
                    { calculate: "'Peak: ' + datum.month_short", as: "peak_label" }
                ],
                mark: { type: "text", dy: -12, fontSize: 11, fontWeight: 700 },
                encoding: {
                    x: { field: "month_short", type: "ordinal", sort: SHORT },
                    y: { field: "count", type: "quantitative" },
                    text: { field: "peak_label" },
                    color: { field: "animal_group", type: "nominal", scale: { domain: GROUPS, range: COLOURS }, legend: null }
                }
            }
        ],
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F", gridColor: "#edf0f2" } }
    };

    // Plain-language summary for the selected period: each group's peak month and its share of that period's rescues.
    // Key patterns for the selected period, computed from the same monthly averages as the chart.
    function renderInsights(useYears) {
        const list = document.getElementById("season-insights");
        if (!list) return;
        const fmtN = n => Math.round(n).toLocaleString("en-AU");
        const stats = GROUPS.map(g => {
            const perMonth = MONTHS.map((_, i) => {
                const vals = useYears.map(y => (rows.find(r => r.financial_year === y && r.month_number === i + 1 && r.animal_group === g) || { count: 0 }).count);
                return vals.reduce((s, v) => s + v, 0) / useYears.length;
            });
            const peak = perMonth.indexOf(Math.max(...perMonth));
            const low = perMonth.indexOf(Math.min(...perMonth));
            // Share of the year falling in spring (September to November: month numbers 9–11).
            const yearTotal = perMonth.reduce((s, v) => s + v, 0);
            const spring = yearTotal ? (perMonth[8] + perMonth[9] + perMonth[10]) / yearTotal : 0;
            return { g, peak, low, peakV: perMonth[peak], lowV: perMonth[low], spring };
        });
        const byVolume = [...stats].sort((a, b) => b.peakV - a.peakV);
        const top = byVolume[0], second = byVolume[1];
        const items = [
            `<b>${top.g}</b> have the highest peak monthly volume: ${MONTHS[top.peak]} averages ${fmtN(top.peakV)} rescues, ` +
            `${(top.peakV / second.peakV).toFixed(1)}× the ${second.g.toLowerCase()} peak (${MONTHS[second.peak]}, ${fmtN(second.peakV)}).`
        ];
        list.innerHTML = items.map(x => `<li>${x}</li>`).join("");

        // Spring share per group, with a marker at 25% (what an even spread over 12 months would give).
        const spring = document.getElementById("season-spring");
        if (spring) {
            const scaleMax = 0.5;
            const pos = v => `${(100 * Math.min(v, scaleMax) / scaleMax).toFixed(1)}%`;
            spring.innerHTML =
                `<p class="spring-title">Share of the year in spring (Sep–Nov)</p>` +
                stats.map((s, i) =>
                    `<div class="spring-row"><span class="spring-name">${s.g}</span>` +
                    `<span class="spring-track"><span class="spring-fill" style="width:${pos(s.spring)};background:${COLOURS[GROUPS.indexOf(s.g)]}"></span>` +
                    `<span class="spring-even" style="left:${pos(0.25)}"></span></span>` +
                    `<b class="spring-val">${(100 * s.spring).toFixed(0)}%</b></div>`
                ).join("") +
                `<p class="spring-key"><span class="spring-even-key"></span> 25% = rescues spread evenly across the year</p>`;
        }
    }
    function summarise(selected) {
        const useYears = selected === ALL ? years : years.filter(y => showYear(y) === selected);
        const lines = GROUPS.map(g => {
            const perMonth = MONTHS.map((_, i) => {
                const vals = useYears.map(y => (rows.find(r => r.financial_year === y && r.month_number === i + 1 && r.animal_group === g) || { count: 0 }).count);
                return vals.reduce((s, v) => s + v, 0) / useYears.length;
            });
            const total = perMonth.reduce((s, v) => s + v, 0);
            const peak = perMonth.indexOf(Math.max(...perMonth));
            return `<b>${g}</b> peak in ${MONTHS[peak]} (${(100 * perMonth[peak] / total).toFixed(0)}% of their year)`;
        });
        document.getElementById("season-summary").innerHTML = lines.join(" · ");
        renderInsights(useYears);
    }

    try {
        chartEl.innerHTML = "";
        document.getElementById("season-controls").hidden = false;
        document.getElementById("season-summary").hidden = false;
        const { view } = await vegaEmbed("#seasonality-chart", spec, { actions: false, renderer: "svg", config: window.CHART_TEXT });
        summarise(view.signal("season_year"));
        view.addSignalListener("season_year", (_, y) => summarise(y));
        document.getElementById("season-note").innerHTML =
            `Source: ${SRC.kwok("supplementary file S7")}, 2013–14 to 2018–19. Counts are sums of sub-groups within each animal group. Months marked “Not recorded” are excluded.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
