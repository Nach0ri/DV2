// Idiom 12: What proportion of rescued animals reach each outcome?
// Waffle charts in Vega-Lite: 100 squares for all groups combined, then one waffle per animal group, 2013–14 to 2018–19.
// Data: data/outcomes_by_group_full_period_table8.csv = Kwok et al. (2021), Table 8.
// Categories are the source's own. "Released" is not the same as surviving: "Left and observed" and
// "Permanent/long term care" are separate categories. Not combined with Table 10 or S9.
// JS only checks the totals and rounds each category to whole squares (largest remainder, author-calculated).
// Vega-Lite numbers the squares (window row_number) and turns each number into a row and column (calculate).
(async function () {
    const DATA_URL = "data/outcomes_by_group_full_period_table8.csv";
    const chartEl = document.getElementById("waffle-chart");
    const insightEl = document.getElementById("wf-insight");
    const noteEl = document.getElementById("wf-note");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const CATEGORIES = ["Died", "Released", "Left and observed", "Permanent/long term care", "Escaped rescuer or from care"];
    const SQUARES = 100;
    const ALL = "All groups";

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Outcome proportions could not be shown</h3><p>${message}</p></div>`;
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

    // Columns: animal_group, outcome_category, number_of_rescues, published_percent, group_total_rescues, source
    const [header, ...body] = parseCsv(text);
    const col = n => header.indexOf(n);
    const iG = col("animal_group"), iO = col("outcome_category"), iN = col("number_of_rescues"), iT = col("group_total_rescues");
    if ([iG, iO, iN, iT].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    const rows = body
        .filter(r => GROUPS.includes(r[iG]) && /^\d+$/.test(r[iN]) && /^\d+$/.test(r[iT]))
        .map(r => ({ group: r[iG], outcome: r[iO], n: Number(r[iN]), total: Number(r[iT]) }));
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    // Check that the categories add up to each group's total before using it as the denominator.
    const groupTotal = {};
    for (const g of GROUPS) {
        const sub = rows.filter(r => r.group === g);
        const sum = sub.reduce((s, r) => s + r.n, 0);
        const stated = sub[0] ? sub[0].total : NaN;
        if (sub.length === 0 || sum !== stated) {
            showUnavailable(`The categories for ${g} add up to ${sum.toLocaleString("en-AU")}, not the stated total of ${stated.toLocaleString("en-AU")}. No chart is shown.`);
            return;
        }
        groupTotal[g] = stated;
    }
    const denom = GROUPS.reduce((s, g) => s + groupTotal[g], 0);
    groupTotal[ALL] = denom;

    // Counts per panel and category, in legend order.
    const countOf = (panel, c) => rows.filter(r => r.outcome === c && (panel === ALL || r.group === panel)).reduce((s, r) => s + r.n, 0);
    const counts = {};
    for (const p of [ALL, ...GROUPS]) counts[p] = CATEGORIES.map(c => countOf(p, c));
    if (counts[ALL].reduce((s, v) => s + v, 0) !== denom) {
        showUnavailable(`The outcome categories do not add up to the combined denominator. No chart is shown.`);
        return;
    }

    // Squares: largest-remainder rounding so the 100 squares add up exactly (author-calculated).
    function allocate(values, total) {
        const exact = values.map(v => (v / total) * SQUARES);
        const out = exact.map(Math.floor);
        const left = SQUARES - out.reduce((s, v) => s + v, 0);
        exact.map((v, i) => ({ i, rem: v - Math.floor(v) }))
            .sort((a, b) => b.rem - a.rem)
            .slice(0, left)
            .forEach(({ i }) => out[i] += 1);
        return out;
    }

    const fmt = n => n.toLocaleString("en-AU");
    const pctOf = (n, t) => (100 * n / t).toFixed(1);
    const squaresAll = allocate(counts[ALL], denom);

    // One record per square: which panel it belongs to and which category it shows.
    // The record does not carry a position; Vega-Lite works out the row and column.
    const cells = [];
    for (const p of [ALL, ...GROUPS]) {
        const sq = allocate(counts[p], groupTotal[p]);
        CATEGORIES.forEach((c, ci) => {
            for (let k = 0; k < sq[ci]; k++) {
                cells.push({ panel: p, outcome: c, order: ci, n: counts[p][ci], pct: +pctOf(counts[p][ci], groupTotal[p]), squares: sq[ci], total: groupTotal[p] });
            }
        });
    }

    // Legend labels carry the combined count and share, so the legend doubles as the key figures.
    const legendText = Object.fromEntries(CATEGORIES.map((c, i) =>
        [c, `${c}  ${fmt(counts[ALL][i])} · ${pctOf(counts[ALL][i], denom)}%${squaresAll[i] === 0 ? " (under one square)" : ""}`]));
    const share = (g, c) => pctOf(counts[g][CATEGORIES.indexOf(c)], groupTotal[g]);

    function panel(p, size, name, compact) {
        const isAll = p === ALL;
        return {
            name,
            title: {
                text: p,
                subtitle: isAll ? [`${fmt(denom)} rescues · 1 square = 1%`]
                    : compact ? [`${fmt(groupTotal[p])} rescues`, `Died ${share(p, "Died")}%`, `Released ${share(p, "Released")}%`]
                    : [`${fmt(groupTotal[p])} rescues`, `Died ${share(p, "Died")}% · Released ${share(p, "Released")}%`],
                anchor: "start", fontSize: isAll ? 14 : 13, fontWeight: 700, color: PALETTE.neutral.ink,
                subtitleColor: PALETTE.neutral.muted, subtitleFontSize: compact ? 11 : 12, offset: 8
            },
            width: size,
            height: size,
            data: { values: cells.filter(c => c.panel === p) },
            transform: [
                // Number the squares in legend order, then fill the grid row by row from the top left.
                { window: [{ op: "row_number", as: "k" }], sort: [{ field: "order" }] },
                { calculate: "(datum.k - 1) % 10", as: "col" },
                { calculate: "floor((datum.k - 1) / 10)", as: "row" }
            ],
            mark: { type: "rect", cornerRadius: 2 },
            encoding: {
                x: { field: "col", type: "ordinal", axis: null, scale: { paddingInner: isAll ? 0.12 : 0.14 } },
                y: { field: "row", type: "ordinal", axis: null, scale: { paddingInner: isAll ? 0.12 : 0.14 } },
                color: {
                    field: "outcome", type: "nominal",
                    scale: { domain: CATEGORIES, range: CATEGORIES.map(c => PALETTE.outcome[c]) },
                    legend: {
                        title: null, orient: "bottom", direction: "horizontal", columns: compact ? 1 : 3, symbolType: "square", symbolSize: 160,
                        labelFontSize: compact ? 12 : 13, labelColor: PALETTE.neutral.ink, labelLimit: 440, columnPadding: 24, rowPadding: 8,
                        labelExpr: `${JSON.stringify(legendText)}[datum.label]`
                    }
                },
                // Hovering a square highlights the same outcome in every waffle.
                opacity: { condition: { param: "wf_hover", empty: true, value: 1 }, value: 0.22 },
                tooltip: [
                    { field: "panel", type: "nominal", title: "Group" },
                    { field: "outcome", type: "nominal", title: "Outcome" },
                    { field: "n", type: "quantitative", title: "Recorded rescues", format: "," },
                    { field: "pct", type: "quantitative", title: "Share of group (%)", format: ".1f" },
                    { field: "squares", type: "quantitative", title: "Squares (rounded)" }
                ]
            }
        };
    }

    // Vega-Lite does not size concatenated views to the container, so the width is measured and the chart redrawn on resize.
    const VIEWS = ["wf_all", "wf_birds", "wf_mammals", "wf_reptiles"];
    function buildSpec(width) {
        const wide = width >= 760;
        const big = wide ? Math.min(300, Math.floor(width * 0.34)) : Math.min(300, width - 8);
        const smallSpace = wide ? width - big - 60 : width;
        const gap = wide ? 26 : 14;
        const small = Math.max(72, Math.min(180, Math.floor((smallSpace - 2 * gap) / 3) - 4));
        const compact = !wide;
        const groupsRow = { hconcat: GROUPS.map((g, i) => panel(g, small, VIEWS[i + 1], compact)), spacing: gap };
        return {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            params: [{ name: "wf_hover", select: { type: "point", fields: ["outcome"], on: "mouseover", clear: "mouseout" }, views: VIEWS }],
            [wide ? "hconcat" : "vconcat"]: [panel(ALL, big, VIEWS[0], compact), groupsRow],
            spacing: wide ? 56 : 28,
            config: { view: { stroke: null }, concat: { spacing: 26 } }
        };
    }

    insightEl.innerHTML =
        `<b>Died</b> is the largest outcome: ${share(ALL, "Died")}% of ${fmt(denom)} recorded rescues. ` +
        `The mix differs by group: <b>Released</b> is ${share("Reptiles", "Released")}% for Reptiles, ${share("Birds", "Released")}% for Birds ` +
        `and ${share("Mammals", "Released")}% for Mammals, and Mammals have the highest died share (${share("Mammals", "Died")}%).`;
    insightEl.hidden = false;

    const drawWidth = () => Math.max(260, Math.floor(chartEl.getBoundingClientRect().width) - 12);
    async function draw() {
        chartEl.innerHTML = "";
        await vegaEmbed(chartEl, buildSpec(drawWidth()), { actions: false, renderer: "svg", config: window.CHART_TEXT });
    }

    try {
        await draw();
        let timer, lastWidth = drawWidth();
        window.addEventListener("resize", () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (drawWidth() === lastWidth) return;
                lastWidth = drawWidth();
                draw().catch(err => console.error(err));
            }, 200);
        });
        noteEl.innerHTML =
            `Source: ${SRC.kwok("Table 8")}, rescues 2013–14 to 2018–19. ` +
            `Each waffle has 100 squares (1% each) of that group’s recorded rescues; squares are rounded so they add to 100 (largest remainder, author-calculated), so a category under 0.5% can show no square. ` +
            `Hover a square to highlight that outcome in every waffle. Died = dead, died or euthanased.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
