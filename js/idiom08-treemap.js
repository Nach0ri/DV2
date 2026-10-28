// Idiom 08: Which animal sub-groups are rescued most often?
// Two-level treemap: animal group (Birds, Mammals, Reptiles) containing its sub-groups.
// Data: data/rescue_monthly_by_group.csv = Kwok et al. (2021), supplementary file S7, 2013–14 to 2018–19.
// Each rectangle's area is proportional to its rescue count. "Unknown" and "Unidentified" sub-groups are kept
// (grey) so the areas add up to every rescue in S7. Sub-groups are not individual species.
(async function () {
    const DATA_URL = "data/rescue_monthly_by_group.csv";
    const chartEl = document.getElementById("treemap-chart");
    const insightEl = document.getElementById("tm-insight");
    const noteEl = document.getElementById("tm-note");
    const tooltip = document.getElementById("tm-tooltip");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const COLOUR = { Birds: "#397DA5", Mammals: "#D49A38", Reptiles: "#176B60" }; // project palette
    const UNKNOWN_FILL = "#C9CFCB";
    const TEXT_ON = { Birds: "#FFFFFF", Mammals: "#25332F", Reptiles: "#FFFFFF" };
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
    const sub = new Map();
    const periods = new Set();
    for (const r of body) {
        if (!GROUPS.includes(r[iG]) || !/^\d+$/.test(r[iC])) continue;
        periods.add(r[iY]);
        const key = `${r[iG]}|${r[iS]}`;
        sub.set(key, (sub.get(key) || 0) + Number(r[iC]));
    }
    if (sub.size === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const total = [...sub.values()].reduce((s, v) => s + v, 0);
    const groups = GROUPS.map(g => {
        const leaves = [...sub.entries()]
            .filter(([k]) => k.startsWith(g + "|"))
            .map(([k, v]) => ({ name: k.split("|")[1], group: g, value: v, unknown: UNKNOWN.test(k.split("|")[1]) }))
            .sort((a, b) => b.value - a.value);
        return { name: g, value: leaves.reduce((s, l) => s + l.value, 0), children: leaves };
    }).filter(g => g.children.length > 0);
    if (groups.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    // Squarified treemap (Bruls, Huizing & van Wijk). Returns rectangles inside (x, y, w, h).
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

    function draw() {
        const W = Math.max(280, Math.floor(chartEl.getBoundingClientRect().width));
        const H = W < 680 ? 440 : 480;
        const totalArea = W * H;
        const top = squarify(groups.map(g => ({ ...g, area: (g.value / total) * totalArea })).sort((a, b) => b.value - a.value), 0, 0, W, H);

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.setAttribute("width", W);
        svg.setAttribute("height", H);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `Treemap of ${fmt(total)} recorded rescues by animal group and sub-group, ${periodText}`);
        svg.style.display = "block";
        svg.style.maxWidth = "100%";

        const el = (name, attrs, text) => {
            const n = document.createElementNS(svgNS, name);
            for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
            if (text !== undefined) n.textContent = text;
            return n;
        };

        for (const g of top) {
            const gx = g.x, gy = g.y, gw = g.w, gh = g.h;
            const inner = { x: gx + GAP, y: gy + BAND, w: Math.max(0, gw - 2 * GAP), h: Math.max(0, gh - BAND - GAP) };
            // Group label band.
            svg.appendChild(el("rect", { x: gx, y: gy, width: gw, height: Math.min(BAND, gh), fill: COLOUR[g.name] }));
            const fullBand = `${g.name} · ${fmt(g.value)} (${pct(g.value)})`;
            const bandLabel = fit(fullBand, gw, 12.5).endsWith("…") ? fit(g.name, gw, 12.5) : fit(fullBand, gw, 12.5);
            if (bandLabel) svg.appendChild(el("text", { x: gx + 7, y: gy + BAND / 2 + 4.5, "font-size": 12.5, "font-weight": 700, fill: TEXT_ON[g.name], "font-family": "Atkinson Hyperlegible, system-ui, sans-serif" }, bandLabel));

            // Sub-group rectangles inside the group, sized by their share of the group.
            const leafArea = inner.w * inner.h;
            const leaves = squarify(g.children.map(c => ({ ...c, area: (c.value / g.value) * leafArea })), inner.x, inner.y, inner.w, inner.h);
            for (const l of leaves) {
                const fill = l.unknown ? UNKNOWN_FILL : COLOUR[g.name];
                const textFill = l.unknown ? "#25332F" : TEXT_ON[g.name];
                const r = el("rect", {
                    x: l.x + GAP / 2, y: l.y + GAP / 2,
                    width: Math.max(0, l.w - GAP), height: Math.max(0, l.h - GAP),
                    fill, "data-index": leaves.indexOf(l), class: "tm-leaf"
                });
                svg.appendChild(r);
                const label = fit(l.name, l.w, 12);
                const countLabel = fit(fmt(l.value), l.w, 11);
                if (l.w >= 70 && l.h >= 40 && label) {
                    svg.appendChild(el("text", { x: l.x + 7, y: l.y + 17, "font-size": 12, "font-weight": 600, fill: textFill, "font-family": "Atkinson Hyperlegible, system-ui, sans-serif", "pointer-events": "none" }, label));
                    svg.appendChild(el("text", { x: l.x + 7, y: l.y + 31, "font-size": 11, fill: textFill, "font-family": "Atkinson Hyperlegible, system-ui, sans-serif", "pointer-events": "none" }, countLabel));
                } else if (l.w >= 44 && l.h >= 18 && countLabel) {
                    svg.appendChild(el("text", { x: l.x + 5, y: l.y + 14, "font-size": 11, fill: textFill, "font-family": "Atkinson Hyperlegible, system-ui, sans-serif", "pointer-events": "none" }, countLabel));
                }
                r.addEventListener("mousemove", e => showTip(l, e));
                r.addEventListener("mouseleave", hideTip);
                r.addEventListener("focus", () => showTipAt(l));
                r.addEventListener("blur", hideTip);
                r.setAttribute("tabindex", "0");
            }
        }

        chartEl.innerHTML = "";
        chartEl.appendChild(svg);
        chartEl.style.position = "relative";
        chartEl.appendChild(tooltip);

        function tipHtml(l) {
            return `<b>${l.name}</b><br>${l.group}<br>${fmt(l.value)} rescues · ${pct(l.value)} of ${fmt(total)}` +
                `<br><span class="tm-tip-muted">${periodText}</span>`;
        }
        function showTip(l, e) {
            const box = chartEl.getBoundingClientRect();
            tooltip.innerHTML = tipHtml(l);
            tooltip.hidden = false;
            const x = Math.min(e.clientX - box.left + 14, box.width - tooltip.offsetWidth - 4);
            tooltip.style.left = `${Math.max(4, x)}px`;
            tooltip.style.top = `${e.clientY - box.top + 14}px`;
        }
        function showTipAt(l) {
            tooltip.innerHTML = tipHtml(l);
            tooltip.hidden = false;
            tooltip.style.left = `${l.x + 6}px`;
            tooltip.style.top = `${l.y + 6}px`;
        }
        function hideTip() { tooltip.hidden = true; }
    }

    // Insight: the largest sub-groups and how much of the total the top ten make up.
    const ranked = [...sub.entries()].map(([k, v]) => ({ group: k.split("|")[0], name: k.split("|")[1], v })).sort((a, b) => b.v - a.v);
    const top10 = ranked.slice(0, 10).reduce((s, d) => s + d.v, 0);
    const [a, b] = ranked;
    insightEl.innerHTML =
        `<b>${a.name}</b> (${a.group}) is the largest sub-group, with ${pct(a.v)} of ${fmt(total)} recorded rescues, ` +
        `followed by <b>${b.name}</b> (${b.group}, ${pct(b.v)}). The ten largest sub-groups together account for ${pct(top10)}.`;
    insightEl.hidden = false;

    try {
        draw();
        let timer;
        window.addEventListener("resize", () => {
            clearTimeout(timer);
            timer = setTimeout(draw, 200);
        });
        noteEl.innerHTML =
            `Source: Kwok, A. B. C., Haering, R., Travers, S. K., &amp; Stathis, P. (2021). <i>PLOS ONE</i>, supplementary file S7 ` +
            `(<a href="https://doi.org/10.1371/journal.pone.0257209">doi:10.1371/journal.pone.0257209</a>), rescues ${periodText}. ` +
            `Project aggregation for this chart: each sub-group’s monthly counts summed over all months and years; areas are proportional to those totals. ` +
            `Percentages use the ${fmt(total)} rescues in S7 as the denominator. Grey tiles are the “Unknown” or “Unidentified” sub-groups as recorded. ` +
            `Sub-groups are not all single species. Not combined with Table 10 or S9.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the treemap: ${err.message}</p>`;
    }
})();
