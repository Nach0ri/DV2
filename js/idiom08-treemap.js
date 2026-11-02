// Idiom 08: Which animal sub-groups are rescued most often?
// Two-level treemap in Vega-Lite: animal group (Birds, Mammals, Reptiles) containing its sub-groups.
// Data: data/rescue_monthly_by_group.csv = Kwok et al. (2021), supplementary file S7, 2013–14 to 2018–19.
// Each rectangle's area is proportional to its rescue count. "Unknown" and "Unidentified" sub-groups are excluded
// before the total is taken. Sub-groups are not individual species.
// Vega-Lite has no treemap layout, so the rectangles' corners are computed here (squarified layout, a data-preparation
// step) and Vega-Lite draws them as rect marks with x, x2, y and y2, plus text marks for labels and rank badges.
(async function () {
    const DATA_URL = "data/rescue_monthly_by_group.csv";
    const chartEl = document.getElementById("treemap-chart");
    const insightEl = document.getElementById("tm-insight");
    const noteEl = document.getElementById("tm-note");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const BAND = 24;   // height of the group label band
    const GAP = 1.5;   // white gap between rectangles
    const UNKNOWN = /unknown|unidentified/i;

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Treemap could not be shown</h3><p>${message}</p></div>`;
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
    const iY = col("financial_year"), iG = col("animal_group"), iS = col("sub_group"), iC = col("rescue_count");
    if ([iY, iG, iS, iC].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Sum every month and year for each sub-group. Blank counts are skipped, never treated as zero.
    // "Unknown" and "Unidentified" sub-groups are not categories, so they are left out and counted separately.
    const sub = new Map();
    const periods = new Set();
    let excluded = 0;
    for (const r of body) {
        if (!GROUPS.includes(r[iG]) || !/^\d+$/.test(r[iC])) continue;
        if (UNKNOWN.test(r[iS])) { excluded += Number(r[iC]); continue; }
        periods.add(r[iY]);
        const key = `${r[iG]}|${r[iS]}`;
        sub.set(key, (sub.get(key) || 0) + Number(r[iC]));
    }
    if (sub.size === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const total = [...sub.values()].reduce((s, v) => s + v, 0);
    const groups = GROUPS.map(g => {
        const leaves = [...sub.entries()]
            .filter(([k]) => k.startsWith(g + "|"))
            .map(([k, v]) => ({ name: k.split("|")[1], group: g, value: v }))
            .sort((a, b) => b.value - a.value);
        return { name: g, value: leaves.reduce((s, l) => s + l.value, 0), children: leaves };
    }).filter(g => g.children.length > 0);
    if (groups.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }
    const ranked = [...sub.entries()].map(([k, v]) => ({ group: k.split("|")[0], name: k.split("|")[1], v })).sort((a, b) => b.v - a.v);

    // Squarified treemap layout (Bruls, Huizing & van Wijk). Returns rectangles inside (x, y, w, h).
    function squarify(items, x, y, w, h) {
        const out = [];
        const sum = a => a.reduce((s, n) => s + n.area, 0);
        const worst = (row, side) => {
            const s = sum(row), max = Math.max(...row.map(n => n.area)), min = Math.min(...row.map(n => n.area));
            return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
        };
        let rest = items.slice();
        while (rest.length && w > 0 && h > 0) {
            const side = Math.min(w, h);
            let row = [rest[0]], i = 1;
            while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) { row.push(rest[i]); i++; }
            const rowArea = sum(row);
            if (w >= h) {
                const cw = rowArea / h; let yy = y;
                for (const n of row) { const ch = n.area / cw; out.push({ ...n, x, y: yy, w: cw, h: ch }); yy += ch; }
                x += cw; w -= cw;
            } else {
                const rh = rowArea / w; let xx = x;
                for (const n of row) { const cw = n.area / rh; out.push({ ...n, x: xx, y, w: cw, h: rh }); xx += cw; }
                y += rh; h -= rh;
            }
            rest = rest.slice(row.length);
        }
        return out;
    }

    const fmt = n => Math.round(n).toLocaleString("en-AU");
    const pct = v => `${((100 * v) / total).toFixed(1)}%`;
    const periodText = (() => {
        const ys = [...periods].sort();
        return `${ys[0].replace("-", "–")} to ${ys[ys.length - 1].replace("-", "–")}`;
    })();

    // Truncate a label to roughly fit a width (about 0.56 em per character at the chosen size).
    function fit(text, width, size) {
        const max = Math.max(0, Math.floor((width - 8) / (size * 0.56)));
        return text.length <= max ? text : (max > 2 ? text.slice(0, max - 1) + "…" : "");
    }

    // Layout in pixels for a given width: one record per group band and one per sub-group tile.
    function layout(W, H) {
        const bands = [], tiles = [];
        const top = squarify(groups.map(g => ({ ...g, area: (g.value / total) * W * H })).sort((a, b) => b.value - a.value), 0, 0, W, H);
        for (const g of top) {
            const fullBand = `${g.name} · ${fmt(g.value)} (${pct(g.value)})`;
            const bandLabel = fit(fullBand, g.w, 12.5).endsWith("…") ? fit(g.name, g.w, 12.5) : fit(fullBand, g.w, 12.5);
            bands.push({ group: g.name, x0: g.x, x1: g.x + g.w, y0: g.y, y1: g.y + Math.min(BAND, g.h), label: bandLabel, labelY: g.y + BAND / 2, ink: PALETTE.groupOn[g.name] });
            const inner = { x: g.x + GAP, y: g.y + BAND, w: Math.max(0, g.w - 2 * GAP), h: Math.max(0, g.h - BAND - GAP) };
            const leaves = squarify(g.children.map(c => ({ ...c, area: (c.value / g.value) * inner.w * inner.h })), inner.x, inner.y, inner.w, inner.h);
            for (const l of leaves) {
                const name = fit(l.name, l.w, 12);
                const withShare = `${fmt(l.value)} · ${pct(l.value)}`;
                const countLabel = fit(withShare, l.w, 11).endsWith("…") ? fit(fmt(l.value), l.w, 11) : fit(withShare, l.w, 11);
                const big = l.w >= 70 && l.h >= 40 && name;
                const rank = ranked.findIndex(d => d.group === l.group && d.name === l.name) + 1;
                tiles.push({
                    name: l.name, group: l.group, value: l.value, share: +(100 * l.value / total).toFixed(1),
                    x0: l.x + GAP / 2, x1: l.x + l.w - GAP / 2, y0: l.y + GAP / 2, y1: l.y + l.h - GAP / 2,
                    ink: PALETTE.groupOn[l.group],
                    // Labels only where they fit: name and count on large tiles, the count alone on medium ones.
                    nameLabel: big ? name : "",
                    countLabel: big ? countLabel : (l.w >= 44 && l.h >= 18 ? countLabel : ""),
                    countY: big ? l.y + 31 : l.y + 14,
                    labelX: l.x + (big ? 7 : 5),
                    nameY: l.y + 17,
                    // Annotation: rank badge on the three largest sub-groups.
                    rank: rank >= 1 && rank <= 3 && l.w >= 40 && l.h >= 40 ? rank : 0,
                    badgeX: l.x + l.w - 17, badgeY: l.y + 17
                });
            }
        }
        return { bands, tiles };
    }

    function buildSpec(W, H) {
        const { bands, tiles } = layout(W, H);
        // One pixel scale shared by every layer: x runs left to right, y top to bottom.
        const X = f => ({ field: f, type: "quantitative", scale: { domain: [0, W], nice: false, zero: false }, axis: null });
        const Y = f => ({ field: f, type: "quantitative", scale: { domain: [0, H], nice: false, zero: false, reverse: true }, axis: null });
        const groupColour = { field: "group", type: "nominal", scale: { domain: GROUPS, range: GROUPS.map(g => PALETTE.group[g]) }, legend: null };
        const textCommon = { type: "text", align: "left", baseline: "alphabetic" };
        return {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            width: W,
            height: H,
            padding: 0,
            autosize: { type: "none" },
            description: `Treemap of ${fmt(total)} recorded rescues by animal group and sub-group, ${periodText}`,
            layer: [
                // Group label bands.
                { data: { values: bands }, mark: { type: "rect" }, encoding: { x: X("x0"), x2: { field: "x1" }, y: Y("y0"), y2: { field: "y1" }, color: groupColour } },
                // Sub-group tiles: area proportional to rescues. Hover outlines the tile.
                {
                    data: { values: tiles },
                    params: [{ name: "tm_hover", select: { type: "point", fields: ["group", "name"], on: "mouseover", clear: "mouseout" } }],
                    mark: { type: "rect", stroke: PALETTE.neutral.ink, cursor: "default" },
                    encoding: {
                        x: X("x0"), x2: { field: "x1" }, y: Y("y0"), y2: { field: "y1" },
                        color: groupColour,
                        strokeWidth: { condition: { param: "tm_hover", empty: false, value: 2.5 }, value: 0 },
                        tooltip: [
                            { field: "name", type: "nominal", title: "Sub-group" },
                            { field: "group", type: "nominal", title: "Animal group" },
                            { field: "value", type: "quantitative", title: "Recorded rescues", format: "," },
                            { field: "share", type: "quantitative", title: `Share of ${fmt(total)} (%)`, format: ".1f" }
                        ]
                    }
                },
                // Group band labels.
                {
                    data: { values: bands },
                    mark: { ...textCommon, baseline: "middle", dx: 7, fontSize: 12.5, fontWeight: 700 },
                    encoding: { x: X("x0"), y: Y("labelY"), text: { field: "label" }, color: { field: "ink", type: "nominal", scale: null } }
                },
                // Tile names.
                {
                    data: { values: tiles.filter(t => t.nameLabel) },
                    mark: { ...textCommon, fontSize: 12, fontWeight: 600 },
                    encoding: { x: X("labelX"), y: Y("nameY"), text: { field: "nameLabel" }, color: { field: "ink", type: "nominal", scale: null } }
                },
                // Tile counts and shares.
                {
                    data: { values: tiles.filter(t => t.countLabel) },
                    mark: { ...textCommon, fontSize: 11 },
                    encoding: { x: X("labelX"), y: Y("countY"), text: { field: "countLabel" }, color: { field: "ink", type: "nominal", scale: null } }
                },
                // Rank badges 1–3 (annotation for the three largest sub-groups).
                {
                    data: { values: tiles.filter(t => t.rank) },
                    mark: { type: "circle", size: 400, color: "#FFFFFF", opacity: 1 },
                    encoding: { x: X("badgeX"), y: Y("badgeY") }
                },
                {
                    data: { values: tiles.filter(t => t.rank) },
                    mark: { type: "text", align: "center", baseline: "middle", fontSize: 12, fontWeight: 700, color: PALETTE.neutral.ink },
                    encoding: { x: X("badgeX"), y: Y("badgeY"), text: { field: "rank" } }
                }
            ],
            config: { view: { stroke: null } }
        };
    }

    // Insight: the largest sub-groups and how much of the total the top ten make up.
    const top10 = ranked.slice(0, 10).reduce((s, d) => s + d.v, 0);
    const [a, b] = ranked;
    insightEl.innerHTML =
        `<b>${a.name}</b> (${a.group}) is the largest sub-group, with ${pct(a.v)} of ${fmt(total)} recorded rescues, ` +
        `followed by <b>${b.name}</b> (${b.group}, ${pct(b.v)}). The ten largest sub-groups together account for ${pct(top10)}.`;
    insightEl.hidden = false;

    // Key findings beside the summary, from the same totals as the treemap.
    let cum = 0, half = 0;
    for (const d of ranked) { cum += d.v; half++; if (cum >= total / 2) break; }
    const top3 = ranked.slice(0, 3).reduce((t, d) => t + d.v, 0);
    const leaders = groups.map(g => { const c = g.children[0]; return `<b>${g.name}</b>: ${c.name} (${(100 * c.value / g.value).toFixed(0)}% of ${g.name.toLowerCase()})`; });
    const findingsEl = document.getElementById("tm-findings");
    if (findingsEl) findingsEl.innerHTML =
        `<p class="dot-ov-title">Key findings</p><ul class="insight-list heat-findings bubble-findings-list">` +
        `<li>Just <b>${half} of ${ranked.length}</b> sub-groups make up half of all rescues.</li>` +
        `<li>The top three (numbered 1–3 on the chart) account for <b>${pct(top3)}</b>.</li>` +
        `<li>Largest in each group: ${leaders.join("; ")}.</li></ul>`;

    // Vega-Lite does not size this chart to its container, so the width is measured and the layout redrawn on resize.
    const drawWidth = () => Math.max(280, Math.floor(chartEl.getBoundingClientRect().width));
    async function draw() {
        const W = drawWidth();
        chartEl.innerHTML = "";
        await vegaEmbed(chartEl, buildSpec(W, W < 680 ? 440 : 480), { actions: false, renderer: "svg", config: window.CHART_TEXT });
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
            `Source: Kwok et al. (2021), <i>PLOS ONE</i>, supplementary file S7 ` +
            `(<a href="https://doi.org/10.1371/journal.pone.0257209">doi:10.1371/journal.pone.0257209</a>), rescues ${periodText}. ` +
            `Project aggregation for this chart: each sub-group’s monthly counts summed over all months and years; areas are proportional to those totals. ` +
            `Percentages use the ${fmt(total)} rescues with a named sub-group as the denominator (author-calculated). ${fmt(excluded)} rescues recorded as “Unknown” or “Unidentified” sub-groups are excluded. ` +
            `Sub-groups are not all single species. Not combined with Table 10 or S9.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the treemap: ${err.message}</p>`;
    }
})();
