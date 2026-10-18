// Idiom 12: What proportion of rescued animals reach each outcome?
// 10 × 10 waffle chart (100 squares) of outcome categories for Birds, Mammals and Reptiles combined, 2013–14 to 2018–19.
// Data: data/outcomes_by_group_full_period_table8.csv = Kwok et al. (2021), Table 8.
// Categories are the source's own. "Released" is not the same as surviving: "Left and observed" and
// "Permanent/long term care" are separate categories. Not combined with Table 10 or S9.
(async function () {
    const DATA_URL = "data/outcomes_by_group_full_period_table8.csv";
    const chartEl = document.getElementById("waffle-chart");
    const insightEl = document.getElementById("wf-insight");
    const noteEl = document.getElementById("wf-note");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const CATEGORIES = [
        { name: "Died", colour: "#C66B4E" },                         // Terracotta
        { name: "Released", colour: "#397DA5" },                     // River Blue
        { name: "Left and observed", colour: "#D49A38" },            // Golden Ochre
        { name: "Permanent/long term care", colour: "#176B60" },     // Forest Teal
        { name: "Escaped rescuer or from care", colour: "#8A968F" }  // grey-green, as in Idiom 05
    ];
    const SQUARES = 100;

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
    const iG = col("animal_group"), iO = col("outcome_category"), iN = col("number_of_rescues"), iP = col("published_percent"), iT = col("group_total_rescues");
    if ([iG, iO, iN, iP, iT].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    const rows = body
        .filter(r => GROUPS.includes(r[iG]) && /^\d+$/.test(r[iN]) && /^\d+$/.test(r[iT]))
        .map(r => ({ group: r[iG], outcome: r[iO], n: Number(r[iN]), total: Number(r[iT]), published: r[iP] }));
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

    // Combined counts per category, in the order used on the page.
    const counts = CATEGORIES.map(c => ({
        ...c,
        n: rows.filter(r => r.outcome === c.name).reduce((s, r) => s + r.n, 0)
    }));
    if (counts.reduce((s, c) => s + c.n, 0) !== denom) {
        showUnavailable(`The outcome categories do not add up to the combined denominator. No chart is shown.`);
        return;
    }

    // Squares: largest-remainder rounding so the 100 squares add up exactly.
    const exact = counts.map(c => (c.n / denom) * SQUARES);
    const squares = exact.map(Math.floor);
    let left = SQUARES - squares.reduce((s, v) => s + v, 0);
    exact.map((v, i) => ({ i, rem: v - Math.floor(v) }))
        .sort((a, b) => b.rem - a.rem)
        .slice(0, left)
        .forEach(({ i }) => squares[i] += 1);

    const pct = c => `${((c.n / denom) * 100).toFixed(1)}%`;
    const fmt = n => n.toLocaleString("en-AU");
    const share = (group, name) => {
        const r = rows.find(x => x.group === group && x.outcome === name);
        return (100 * r.n / groupTotal[group]).toFixed(1);
    };

    // Waffle cells, filled row by row from the top left, in the order of the legend.
    const cells = [];
    counts.forEach((c, i) => { for (let k = 0; k < squares[i]; k++) cells.push(c); });
    chartEl.innerHTML =
        `<div class="wf-layout">` +
        `<div class="wf-grid" role="img" aria-label="Waffle chart: each square is one of 100 equal shares of ${fmt(denom)} recorded rescues">` +
        cells.map(c => `<span class="wf-cell" style="background:${c.colour}" title="${c.name}"></span>`).join("") +
        `</div>` +
        `<ul class="wf-legend">` +
        counts.map((c, i) =>
            `<li><span class="wf-swatch" style="background:${c.colour}"></span>` +
            `<span class="wf-label"><b>${c.name}</b><br>${fmt(c.n)} rescues · ${pct(c)} · ${squares[i] === 0 ? "under one square" : `${squares[i]} square${squares[i] === 1 ? "" : "s"}`}</span></li>`
        ).join("") +
        `</ul>` +
        `</div>`;

    insightEl.innerHTML =
        `<b>Died</b> is the largest outcome: ${pct(counts[0])} of ${fmt(denom)} recorded rescues. ` +
        `The mix differs by group: <b>Released</b> is ${share("Reptiles", "Released")}% for Reptiles, ${share("Birds", "Released")}% for Birds ` +
        `and ${share("Mammals", "Released")}% for Mammals, and Mammals have the highest died share (${share("Mammals", "Died")}%).`;
    insightEl.hidden = false;

    noteEl.innerHTML =
        `Source: Kwok, A. B. C., Haering, R., Travers, S. K., &amp; Stathis, P. (2021). <i>PLOS ONE</i>, Table 8 ` +
        `(<a href="https://doi.org/10.1371/journal.pone.0257209">doi:10.1371/journal.pone.0257209</a>), rescues 2013–14 to 2018–19. ` +
        `Percentages use ${fmt(denom)} recorded rescues across Birds (${fmt(groupTotal.Birds)}), Mammals (${fmt(groupTotal.Mammals)}) and Reptiles (${fmt(groupTotal.Reptiles)}), ` +
        `the group totals in Table 8. Calculated for this chart: each category’s count ÷ ${fmt(denom)}, shown to one decimal place; ` +
        `the 100 squares use largest-remainder rounding, so a category under 0.5% can show no square. ` +
        `“Died” is the source’s category (dead, died or euthanised). Not combined with Table 10 or S9.`;
})();
