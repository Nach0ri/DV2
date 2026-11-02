// Idiom 06: How are rescue reason rankings changing?
// Bump chart of rescue reasons by reporting year. Data: data/rescue_reasons_by_group_year.csv (S4, validated).
// Each year's count is the sum across the three animal groups (Birds, Mammals, Reptiles), which do not overlap.
// Rank is among all reasons in that year, excluding "Unknown". The five lines are the five reasons with the largest
// totals across all years. Blank source cells were checked against Grand Totals and are left out of the CSV.
(async function () {
    const DATA_URL = "data/rescue_reasons_by_group_year.csv";
    const chartEl = document.getElementById("vis-06-bump");
    const COLOURS = ["#25332F", "#4A5752", "#6B7872", "#8A9690", "#A3ADA8"];   // neutral greys: reasons are not a colour category elsewhere on the page
    const DASHES = [[1, 0], [7, 3], [2, 3], [9, 3, 2, 3], [4, 4]];         // line style tells the five reasons apart without hue
    const EXCLUDE = new Set(["Unknown"]);

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Bump chart could not be shown</h3><p>${message}</p></div>`;
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

    // Columns: reason, animal_group, reporting_year, rescues
    const [header, ...body] = parseCsv(text);
    const col = n => header.indexOf(n);
    const iR = col("reason"), iG = col("animal_group"), iY = col("reporting_year"), iN = col("rescues");
    if ([iR, iG, iY, iN].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Sum the animal groups for each reason and year. Rows with a non-numeric count are skipped, never treated as zero.
    const sums = new Map(); // "reason|year" -> count
    const years = new Set(), reasons = new Set();
    for (const r of body) {
        if (r.length < 4 || EXCLUDE.has(r[iR]) || !/^\d+$/.test(r[iN])) continue;
        const key = r[iR] + "|" + r[iY];
        sums.set(key, (sums.get(key) || 0) + Number(r[iN]));
        years.add(r[iY]); reasons.add(r[iR]);
    }
    if (sums.size === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const yearList = [...years].sort();
    const reasonList = [...reasons];

    // Rank within each year among all reasons (1 = most rescues).
    const rows = [];
    for (const y of yearList) {
        const ranked = reasonList
            .map(rn => ({ reason: rn, n: sums.get(rn + "|" + y) ?? null }))
            .filter(d => d.n !== null)
            .sort((a, b) => b.n - a.n);
        ranked.forEach((d, i) => rows.push({ reason: d.reason, year: y, year_label: y.replace("-", "–"), rescues: d.n, rank: i + 1 }));
    }

    // Top five by total across all years. The same five are used in every year.
    const totals = new Map();
    for (const [k, n] of sums) { const rn = k.split("|")[0]; totals.set(rn, (totals.get(rn) || 0) + n); }
    const top5 = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    const shown = rows.filter(d => top5.includes(d.reason));
    const colourOf = Object.fromEntries(top5.map((rn, i) => [rn, COLOURS[i]]));
    const maxRank = Math.max(...shown.map(d => d.rank));
    // Annotation: mark any year where a reason other than the usual leader ranks first.
    const firsts = shown.filter(d => d.rank === 1);
    const leadCount = {};
    firsts.forEach(d => { leadCount[d.reason] = (leadCount[d.reason] || 0) + 1; });
    const leader = Object.entries(leadCount).sort((a, b) => b[1] - a[1])[0][0];
    const upsets = firsts.filter(d => d.reason !== leader).map(d => ({ year_label: d.year_label, rank: 1, note: `${d.reason} ranks first` }));

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: 380,
        padding: { left: 5, top: 5, bottom: 5, right: 40 },
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: shown },
        layer: [
            {
                mark: { type: "line", strokeWidth: 2.5 },
                encoding: {
                    x: { field: "year_label", type: "ordinal", sort: yearList.map(y => y.replace("-", "–")), title: "Reporting year (financial year)", scale: { paddingOuter: 1.0 }, axis: { labelAngle: 0, labelFontSize: 12, titleFontSize: 12, domain: false, ticks: false } },
                    y: { field: "rank", type: "quantitative", title: "Rank among reasons (1 = most rescues)", scale: { domain: [0.5, maxRank + 0.5], reverse: true }, axis: { values: Array.from({ length: maxRank }, (_, i) => i + 1), format: "d", grid: true, labelFontSize: 12, titleFontSize: 12, domain: false, ticks: false } },
                    color: { field: "reason", type: "nominal", scale: { domain: top5, range: top5.map(rn => colourOf[rn]) }, legend: null },
                    strokeDash: { field: "reason", type: "nominal", scale: { domain: top5, range: top5.map((rn, i) => DASHES[i]) }, legend: null },
                    opacity: { condition: { param: "hl", empty: true, value: 1 }, value: 0.18 },
                    detail: { field: "reason" },
                    tooltip: [
                        { field: "reason", type: "nominal", title: "Reason" },
                        { field: "year_label", type: "ordinal", title: "Reporting year" },
                        { field: "rank", type: "quantitative", title: "Rank" },
                        { field: "rescues", type: "quantitative", title: "Rescues (all groups)", format: ",d" }
                    ]
                }
            },
            {
                params: [{ name: "hl", select: { type: "point", fields: ["reason"], on: "pointerover", clear: "pointerout" } }],
                mark: { type: "point", filled: true, size: 90, stroke: "#FFFFFF", strokeWidth: 1.2, cursor: "pointer" },
                encoding: {
                    opacity: { condition: { param: "hl", empty: true, value: 1 }, value: 0.18 },
                    x: { field: "year_label", type: "ordinal", sort: yearList.map(y => y.replace("-", "–")) },
                    y: { field: "rank", type: "quantitative" },
                    color: { field: "reason", type: "nominal", scale: { domain: top5, range: top5.map(rn => colourOf[rn]) }, legend: null },
                    tooltip: [
                        { field: "reason", type: "nominal", title: "Reason" },
                        { field: "year_label", type: "ordinal", title: "Reporting year" },
                        { field: "rank", type: "quantitative", title: "Rank" },
                        { field: "rescues", type: "quantitative", title: "Rescues (all groups)", format: ",d" }
                    ]
                }
            },
            {
                transform: [{ filter: "datum.year_label === '" + yearList[yearList.length - 1].replace("-", "–") + "'" }],
                mark: { type: "text", align: "left", dx: 10, fontSize: 12, fontWeight: 600, clip: false },
                encoding: {
                    opacity: { condition: { param: "hl", empty: true, value: 1 }, value: 0.25 },
                    x: { field: "year_label", type: "ordinal", sort: yearList.map(y => y.replace("-", "–")) },
                    y: { field: "rank", type: "quantitative" },
                    color: { value: PALETTE.neutral.ink },
                    text: { field: "reason", type: "nominal" }
                }
            },
            {
                data: { values: upsets },
                mark: { type: "text", dy: -18, fontSize: 11, fontStyle: "italic", color: "#5E6B63" },
                encoding: {
                    x: { field: "year_label", type: "ordinal", sort: yearList.map(y => y.replace("-", "–")) },
                    y: { field: "rank", type: "quantitative" },
                    text: { field: "note" }
                }
            }
        ],
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F", gridColor: "#E6E1D6" } }
    };

    try {
        chartEl.innerHTML = "";
        await vegaEmbed("#vis-06-bump", spec, { actions: false, renderer: "svg", config: window.CHART_TEXT });
        const note = document.getElementById("bump-note");
        if (note) note.innerHTML =
            `Source: ${SRC.kwok("supplementary file S4")}. Years ${yearList[0].replace("-", "–")} to ${yearList[yearList.length - 1].replace("-", "–")}. ` +
            `Each count sums Birds, Mammals and Reptiles. Ranks are among all reasons, excluding “Unknown”.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
