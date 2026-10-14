// Idiom 09: What happens after rescue?
// Sankey diagram drawn with plain SVG (no library). Left: rescue reasons. Right: Survived and Died.
// Data: data/rescue_outcomes_by_group.csv = Kwok et al. (2021), Table 10 (aggregated over 2013–14 to 2018–19, no years).
// Source values (died_pct, survived_pct, total_rescues) are shown in tooltips unchanged.
// Flow counts are ESTIMATES: died = round(total_rescues x died_pct / 100), survived = total_rescues - died,
// because the source percentages are rounded to 0.1%.
(async function () {
    const DATA_URL = "data/rescue_outcomes_by_group.csv";
    const chartEl = document.getElementById("vis-09-sankey");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const TOP_N = 8;                     // largest reasons get their own node; the rest are combined; Unknown is always its own node
    const UNKNOWN = "Unknown";
    const COLOUR = { Survived: "#397DA5", Died: "#C66B4E" }; // project palette, same as the outcome chart
    const NODE = "#176B60";
    const W = 1000, PAD_L = 250, PAD_R = 230, NODE_W = 14, GAP = 6;

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Sankey diagram could not be shown</h3><p>${message}</p></div>`;
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
        if (!res.ok) { showUnavailable(`The file <code>${DATA_URL}</code> could not be found. No diagram is shown and no values have been filled in.`); return; }
        text = await res.text();
    } catch (err) {
        showUnavailable(`The file <code>${DATA_URL}</code> could not be read. No diagram is shown and no values have been filled in.`);
        return;
    }

    const [header, ...body] = parseCsv(text);
    const col = n => header.indexOf(n);
    const iG = col("animal_group"), iR = col("rescue_reason"), iD = col("died_pct"), iS = col("survived_pct"), iN = col("total_rescues");
    if ([iG, iR, iD, iS, iN].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Keep rows with numeric values. A blank or non-numeric value is skipped, never treated as zero.
    const rows = body
        .filter(r => r.length >= 5 && GROUPS.includes(r[iG]) && /^\d+(\.\d+)?$/.test(r[iD]) && /^\d+(\.\d+)?$/.test(r[iS]) && /^\d+$/.test(r[iN]))
        .map(r => {
            const n = Number(r[iN]), died = Number(r[iD]), survived = Number(r[iS]);
            const estDied = Math.round(n * died / 100);
            return { group: r[iG], reason: r[iR], n, died_pct: died, survived_pct: survived, est_died: estDied, est_survived: n - estDied };
        });
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No diagram is shown and no values have been filled in.`); return; }

    const fmt = v => Number(v).toLocaleString("en-AU");

    // Controls: animal group only (Table 10 is not split by year).
    const controls = document.createElement("div");
    controls.className = "controls";
    controls.innerHTML = `<label>Animal group <select id="sankey-group">` +
        GROUPS.map(g => `<option value="${g}">${g}</option>`).join("") +
        `</select></label><span class="hint">Hover over a flow or node for the numbers.</span>`;
    const holder = document.createElement("div");
    chartEl.innerHTML = "";
    chartEl.appendChild(controls);
    chartEl.appendChild(holder);

    // Tooltip text is kept in an array and referenced by index, so it never goes into an HTML attribute.
    function attachHover(root, tips) {
        const svg = root.querySelector("svg");
        if (!svg) return;
        root.style.position = "relative";
        const tip = document.createElement("div");
        tip.style.cssText = "position:absolute;pointer-events:none;display:none;background:#FFFFFF;border:1px solid #D6DFD7;border-radius:6px;padding:8px 10px;font-size:13px;line-height:1.45;color:#25332F;max-width:300px;z-index:2";
        root.appendChild(tip);
        const flows = [...svg.querySelectorAll(".flow")];
        const nodes = [...svg.querySelectorAll(".node")];
        const place = e => {
            const r = root.getBoundingClientRect();
            tip.style.left = (e.clientX - r.left + 14) + "px";
            tip.style.top = (e.clientY - r.top + 14) + "px";
        };
        const show = html => { tip.innerHTML = html; tip.style.display = "block"; };
        const reset = () => { tip.style.display = "none"; flows.forEach(p => p.setAttribute("fill-opacity", "0.32")); };
        const highlight = pred => flows.forEach(p => p.setAttribute("fill-opacity", pred(p) ? "0.6" : "0.06"));
        flows.forEach(p => {
            p.addEventListener("mouseenter", e => { highlight(q => q === p); show(tips[Number(p.dataset.i)]); place(e); });
            p.addEventListener("mousemove", place);
            p.addEventListener("mouseleave", reset);
        });
        nodes.forEach(n => {
            n.addEventListener("mouseenter", e => {
                const name = n.dataset.n;
                const isOutcome = name === "Survived" || name === "Died";
                highlight(q => (isOutcome ? q.dataset.t === name : q.dataset.s === name));
                show(tips[Number(n.dataset.i)]);
                place(e);
            });
            n.addEventListener("mousemove", place);
            n.addEventListener("mouseleave", reset);
        });
    }

    function draw(group) {
        const pool = rows.filter(r => r.group === group);
        if (pool.length === 0) { holder.innerHTML = `<p class="status">The source has no rows for ${group}.</p>`; return; }

        // Reasons: Unknown is always its own node; the largest other reasons get nodes; the rest are combined.
        const reasonsSorted = pool.filter(r => r.reason !== UNKNOWN).sort((a, b) => b.n - a.n);
        const top = reasonsSorted.slice(0, TOP_N);
        const others = reasonsSorted.slice(TOP_N);
        const unknownRow = pool.find(r => r.reason === UNKNOWN);

        const leftNodes = top.map(r => ({ name: r.reason, rows: [r] }));
        if (others.length) leftNodes.push({ name: `Other reasons (${others.length})`, rows: others });
        if (unknownRow) leftNodes.push({ name: UNKNOWN, rows: [unknownRow] });

        // Estimated flows and source totals per left node.
        const links = new Map(); // "node|outcome" -> estimated count
        const leftTotal = new Map();
        for (const node of leftNodes) {
            let total = 0;
            for (const r of node.rows) {
                total += r.n;
                links.set(node.name + "|Survived", (links.get(node.name + "|Survived") || 0) + r.est_survived);
                links.set(node.name + "|Died", (links.get(node.name + "|Died") || 0) + r.est_died);
            }
            leftTotal.set(node.name, total);
        }
        const rightTotal = new Map([["Survived", 0], ["Died", 0]]);
        for (const [k, v] of links) { const t = k.split("|")[1]; rightTotal.set(t, rightTotal.get(t) + v); }
        const T = leftNodes.reduce((s, n) => s + leftTotal.get(n.name), 0);
        if (T === 0) { holder.innerHTML = `<p class="status">No rescues for ${group}.</p>`; return; }

        // Layout: one scale for both sides, so flow widths are comparable within a group.
        const H = Math.max(420, leftNodes.length * 46);
        const k = (H - GAP * (leftNodes.length - 1)) / T;
        const leftY = new Map(); let y = 0;
        for (const n of leftNodes) { const h = leftTotal.get(n.name) * k; leftY.set(n.name, { y0: y, y1: y + h }); y += h + GAP; }
        const rightGap = 28;
        const rightH = T * k;
        const rightStart = (H - (rightH + rightGap)) / 2;
        const rightY = new Map(); let ry = rightStart;
        for (const n of ["Survived", "Died"]) { const h = rightTotal.get(n) * k; rightY.set(n, { y0: ry, y1: ry + h }); ry += h + rightGap; }

        const srcOff = new Map(); const tgtOff = new Map();
        for (const n of leftNodes) srcOff.set(n.name, leftY.get(n.name).y0);
        for (const n of ["Survived", "Died"]) tgtOff.set(n, rightY.get(n).y0);

        const tips = [];
        const x0 = PAD_L + NODE_W, x1 = W - PAD_R, xm = (x0 + x1) / 2;
        let paths = "";
        for (const n of leftNodes) {
            for (const t of ["Survived", "Died"]) {
                const v = links.get(n.name + "|" + t) || 0;
                if (v === 0) continue;
                const h = v * k;
                const sy0 = srcOff.get(n.name), sy1 = sy0 + h;
                const ty0 = tgtOff.get(t), ty1 = ty0 + h;
                srcOff.set(n.name, sy1); tgtOff.set(t, ty1);
                const share = (100 * v / leftTotal.get(n.name)).toFixed(1);
                const sourceLine = n.rows.length === 1
                    ? `Source: ${fmt(n.rows[0].n)} rescues; ${t === "Died" ? n.rows[0].died_pct : n.rows[0].survived_pct}% ${t.toLowerCase()} (published)`
                    : `Combined from ${n.rows.length} reasons`;
                tips.push(`<b>${n.name}</b> → <b>${t}</b><br>Estimated: <b>${fmt(v)}</b> cases (${share}% of this reason)<br>${sourceLine}<br>Total rescues for ${n.name}: ${fmt(leftTotal.get(n.name))} · ${group}`);
                paths += `<path class="flow" data-s="${n.name}" data-t="${t}" data-i="${tips.length - 1}" d="M${x0},${sy0} C${xm},${sy0} ${xm},${ty0} ${x1},${ty0} L${x1},${ty1} C${xm},${ty1} ${xm},${sy1} ${x0},${sy1} Z" fill="${COLOUR[t]}" fill-opacity="0.32" stroke="none"></path>`;
            }
        }

        let nodes = "";
        for (const n of leftNodes) {
            const { y0, y1 } = leftY.get(n.name);
            const total = leftTotal.get(n.name);
            tips.push(`<b>${n.name}</b><br>Total rescues: ${fmt(total)} (${group})`);
            nodes += `<rect class="node" data-n="${n.name}" data-i="${tips.length - 1}" x="${PAD_L}" y="${y0}" width="${NODE_W}" height="${Math.max(1, y1 - y0)}" fill="${NODE}"></rect>`;
            nodes += `<text x="${PAD_L - 10}" y="${(y0 + y1) / 2}" text-anchor="end" dominant-baseline="middle" font-size="13" fill="#25332F">${n.name} <tspan fill="#5E6B63">${fmt(total)}</tspan></text>`;
        }
        for (const n of ["Survived", "Died"]) {
            const { y0, y1 } = rightY.get(n);
            const total = rightTotal.get(n);
            const pct = (100 * total / T).toFixed(1);
            tips.push(`<b>${n}</b><br>Estimated: ${fmt(total)} cases (${pct}% of ${group} rescues)`);
            nodes += `<rect class="node" data-n="${n}" data-i="${tips.length - 1}" x="${x1}" y="${y0}" width="${NODE_W}" height="${Math.max(1, y1 - y0)}" fill="${COLOUR[n]}"></rect>`;
            nodes += `<text x="${x1 + NODE_W + 10}" y="${(y0 + y1) / 2}" dominant-baseline="middle" font-size="14" font-weight="600" fill="#25332F">${n}</text>`;
            nodes += `<text x="${x1 + NODE_W + 10}" y="${(y0 + y1) / 2 + 18}" dominant-baseline="middle" font-size="12" fill="#5E6B63">≈${fmt(total)} cases · ${pct}%</text>`;
        }

        holder.innerHTML =
            `<svg viewBox="30 0 950 ${H}" width="100%" role="img" aria-label="Sankey diagram: rescue reasons to Survived and Died, ${group}">` +
            `<g>${paths}</g><g>${nodes}</g></svg>` +
            `<p class="legend-note">Estimated flows: each count is calculated from the published percentage (rounded to 0.1%) and the total rescues for that reason. ` +
            `Data are aggregated across 2013–14 to 2018–19 and do not show year-by-year change. Source: Kwok et al. (2021), Table 10 (${DATA_URL}). ` +
            `Survived = released, left and observed, relocated, or permanent care. Died = dead, died, or euthanased.</p>`;
        attachHover(holder, tips);
    }

    const grpSel = controls.querySelector("#sankey-group");
    grpSel.addEventListener("change", () => draw(grpSel.value));
    draw(GROUPS[0]);
})();
