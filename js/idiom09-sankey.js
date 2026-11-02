// Idiom 09: What happens after rescue?
// Sankey diagram in Vega-Lite. Left: rescue reasons. Right: Survived and Died.
// Data: data/rescue_outcomes_by_group.csv = Kwok et al. (2021), Table 10 (aggregated over 2013–14 to 2018–19, no years).
// Source values (died_pct, survived_pct, total_rescues) are shown in tooltips unchanged.
// Flow counts are ESTIMATES (author-calculated): died = round(total_rescues x died_pct / 100), survived = total_rescues - died,
// because the source percentages are rounded to 0.1%.
// Vega-Lite has no Sankey layout, so node positions and each band's curved edges are computed here (data preparation).
// Vega-Lite draws the bands as area marks (x, y = upper edge, y2 = lower edge), the nodes as rect marks and the labels as text.
(async function () {
    const DATA_URL = "data/rescue_outcomes_by_group.csv";
    const chartEl = document.getElementById("sankey-chart");
    const noteEl = document.getElementById("sankey-note");
    const GROUPS = ["Birds", "Mammals", "Reptiles"];
    const OUTCOMES = ["Survived", "Died"];
    const TOP_N = 8;                     // only the largest reasons are shown; smaller reasons are left out
    const UNKNOWN = "Unknown";           // rescues with an unknown reason are left out of the diagram
    const NODE = "#5B6770";              // reasons are neutral nodes
    const H = 420, NODE_W = 14, GAP = 6, RIGHT_GAP = 28, SAMPLES = 40;

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
            return { group: r[iG], reason: r[iR], n, died_pct: died, survived_pct: survived, Died: estDied, Survived: n - estDied };
        });
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No diagram is shown and no values have been filled in.`); return; }

    const fmt = v => Number(v).toLocaleString("en-AU");
    const groupsWithData = GROUPS.filter(g => rows.some(r => r.group === g));

    // Position along a band at step t (0 to 1): the same cubic Bézier S-curve as a classic Sankey link.
    // x(t) is shared by the upper and lower edge, so each sample gives one x with an upper and a lower y.
    const ease = t => 3 * t * t - 2 * t * t * t;
    const xAt = (t, x0, x1) => { const xm = (x0 + x1) / 2; return (1 - t) ** 3 * x0 + 3 * t * (1 - t) * xm + t ** 3 * x1; };

    // Layout for every group at a given width. Returns flat records for the area, rect and text layers.
    function layout(W) {
        // Narrow screens: wider label column, shorter labels (the counts stay in the tooltips).
        const narrow = W < 560;
        const PAD_L = Math.round(narrow ? W * 0.38 : Math.min(250, Math.max(130, W * 0.28)));
        const PAD_R = narrow ? 124 : Math.round(Math.min(210, Math.max(118, W * 0.21)));
        const x0 = PAD_L + NODE_W, x1 = W - PAD_R;
        const flows = [], nodes = [], labels = [];

        for (const group of groupsWithData) {
            const top = rows.filter(r => r.group === group && r.reason !== UNKNOWN).sort((a, b) => b.n - a.n).slice(0, TOP_N);
            const T = top.reduce((s, r) => s + r.n, 0);
            if (T === 0) continue;
            const outTotal = { Survived: top.reduce((s, r) => s + r.Survived, 0), Died: top.reduce((s, r) => s + r.Died, 0) };

            // One scale for both sides, so flow widths are comparable within a group.
            const k = (H - GAP * (top.length - 1)) / T;
            const leftY = new Map(); let y = 0;
            for (const r of top) { leftY.set(r.reason, { y0: y, y1: y + r.n * k }); y += r.n * k + GAP; }
            const rightY = new Map(); let ry = (H - (T * k + RIGHT_GAP)) / 2;
            for (const o of OUTCOMES) { rightY.set(o, { y0: ry, y1: ry + outTotal[o] * k }); ry += outTotal[o] * k + RIGHT_GAP; }

            // Flows: each band is sampled along its length into SAMPLES + 1 points.
            const srcOff = new Map(top.map(r => [r.reason, leftY.get(r.reason).y0]));
            const tgtOff = new Map(OUTCOMES.map(o => [o, rightY.get(o).y0]));
            for (const r of top) {
                for (const o of OUTCOMES) {
                    const v = r[o];
                    if (v === 0) continue;
                    const h = v * k;
                    const sy = srcOff.get(r.reason), ty = tgtOff.get(o);
                    srcOff.set(r.reason, sy + h); tgtOff.set(o, ty + h);
                    const base = {
                        group, flow: `${group}|${r.reason}|${o}`, src: r.reason, tgt: o,
                        est: v, share: +(100 * v / r.n).toFixed(1), published: o === "Died" ? r.died_pct : r.survived_pct, total: r.n
                    };
                    for (let i = 0; i <= SAMPLES; i++) {
                        const t = i / SAMPLES, yTop = sy + (ty - sy) * ease(t);
                        flows.push({ ...base, x: xAt(t, x0, x1), y_top: yTop, y_bot: yTop + h });
                    }
                }
            }

            // Nodes and labels.
            for (const r of top) {
                const { y0, y1 } = leftY.get(r.reason);
                nodes.push({ group, node: r.reason, x0: PAD_L, x1: PAD_L + NODE_W, y0, y1: Math.max(y0 + 1, y1), colour: NODE, detail: `${fmt(r.n)} rescues (source)` });
                labels.push({ group, kind: "reason", x: PAD_L - 10, y: (y0 + y1) / 2, text: narrow ? r.reason : `${r.reason} · ${fmt(r.n)}` });
            }
            for (const o of OUTCOMES) {
                const { y0, y1 } = rightY.get(o);
                const p = (100 * outTotal[o] / T).toFixed(1);
                nodes.push({ group, node: o, x0: x1, x1: x1 + NODE_W, y0, y1: Math.max(y0 + 1, y1), colour: PALETTE.outcome[o], detail: `≈${fmt(outTotal[o])} estimated (${p}% of the ${top.length} reasons shown)` });
                labels.push({ group, kind: "outcome", x: x1 + NODE_W + 10, y: (y0 + y1) / 2 - 8, text: o });
                labels.push({ group, kind: "estimate", x: x1 + NODE_W + 10, y: (y0 + y1) / 2 + 10, text: narrow ? `≈${fmt(outTotal[o])} · ${p}%` : `≈${fmt(outTotal[o])} cases · ${p}%` });
            }
        }
        return { flows, nodes, labels, PAD_L, narrow };
    }

    function buildSpec(W, group) {
        const { flows, nodes, labels, PAD_L, narrow } = layout(W);
        // One pixel scale shared by every layer: x runs left to right, y top to bottom.
        const X = f => ({ field: f, type: "quantitative", scale: { domain: [0, W], nice: false, zero: false }, axis: null });
        const Y = f => ({ field: f, type: "quantitative", scale: { domain: [0, H], nice: false, zero: false, reverse: true }, axis: null });
        const byGroup = { filter: "datum.group === sankey_group" };
        // A flow is bright when it is hovered, or when the node it starts or ends at is hovered; the rest fade.
        const nodeHit = "vlSelectionTest('sk_node_store', {node: datum.src}) || vlSelectionTest('sk_node_store', {node: datum.tgt})";
        const anyHover = "length(data('sk_flow_store')) > 0 || length(data('sk_node_store')) > 0";
        const labelLayer = (kind, mark) => ({
            data: { values: labels },
            transform: [byGroup, { filter: `datum.kind === "${kind}"` }],
            mark: { type: "text", baseline: "middle", ...mark },
            encoding: { x: X("x"), y: Y("y"), text: { field: "text" } }
        });
        return {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            width: W,
            height: H,
            padding: { top: 6, bottom: 6, left: 0, right: 0 },
            autosize: { type: "none" },
            params: [{ name: "sankey_group", value: group, bind: { input: "select", options: groupsWithData, name: "Animal group ", element: "#sankey-group" } }],
            layer: [
                {
                    data: { values: flows },
                    transform: [byGroup],
                    params: [{ name: "sk_flow", select: { type: "point", fields: ["flow"], on: "mouseover", clear: "mouseout" } }],
                    mark: { type: "area", interpolate: "linear", cursor: "default" },
                    encoding: {
                        x: X("x"), y: Y("y_top"), y2: { field: "y_bot" },
                        detail: { field: "flow", type: "nominal" },
                        color: { field: "tgt", type: "nominal", scale: { domain: OUTCOMES, range: OUTCOMES.map(o => PALETTE.outcome[o]) }, legend: null },
                        fillOpacity: {
                            condition: [
                                { param: "sk_flow", empty: false, value: 0.62 },
                                { test: `length(data('sk_node_store')) > 0 && (${nodeHit})`, value: 0.62 },
                                { test: anyHover, value: 0.06 }
                            ],
                            value: 0.32
                        },
                        tooltip: [
                            { field: "src", type: "nominal", title: "Reason" },
                            { field: "tgt", type: "nominal", title: "Outcome" },
                            { field: "est", type: "quantitative", title: "Estimated cases (author-calculated)", format: "," },
                            { field: "share", type: "quantitative", title: "Share of this reason (%)", format: ".1f" },
                            { field: "published", type: "quantitative", title: "Published % (source)", format: ".1f" },
                            { field: "total", type: "quantitative", title: "Total rescues for reason (source)", format: "," }
                        ]
                    }
                },
                {
                    data: { values: nodes },
                    transform: [byGroup],
                    params: [{ name: "sk_node", select: { type: "point", fields: ["node"], on: "mouseover", clear: "mouseout" } }],
                    mark: { type: "rect", cursor: "default" },
                    encoding: {
                        x: X("x0"), x2: { field: "x1" }, y: Y("y0"), y2: { field: "y1" },
                        color: { field: "colour", type: "nominal", scale: null },
                        tooltip: [
                            { field: "node", type: "nominal", title: "Node" },
                            { field: "detail", type: "nominal", title: "Rescues" }
                        ]
                    }
                },
                // Labels: reason names and totals on the left, outcome name and estimate on the right.
                labelLayer("reason", { align: "right", fontSize: narrow ? 11 : 13, color: PALETTE.neutral.ink, limit: PAD_L - 16 }),
                labelLayer("outcome", { align: "left", fontSize: narrow ? 13 : 14, fontWeight: 700, color: PALETTE.neutral.ink }),
                labelLayer("estimate", { align: "left", fontSize: narrow ? 11 : 12, color: PALETTE.neutral.muted })
            ],
            config: { view: { stroke: null } }
        };
    }

    // Vega-Lite does not size this chart to its container, so the width is measured and the layout redrawn on resize.
    const drawWidth = () => Math.max(320, Math.floor(chartEl.getBoundingClientRect().width));
    let current = groupsWithData[0];
    async function draw() {
        chartEl.innerHTML = "";
        document.getElementById("sankey-group").innerHTML = "";
        const result = await vegaEmbed(chartEl, buildSpec(drawWidth(), current), { actions: false, renderer: "svg", config: window.CHART_TEXT });
        result.view.addSignalListener("sankey_group", (_, v) => { current = v; });   // keep the chosen group after a resize
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
            `Estimated flows (author-calculated): each count is calculated from the published percentage (rounded to 0.1%) and the total rescues for that reason. ` +
            `Data are aggregated across 2013–14 to 2018–19 and do not show year-by-year change. Only the ${TOP_N} most common reasons are shown; smaller reasons and rescues with an unknown reason are left out, and percentages use the reasons shown. Source: ${SRC.kwok("Table 10")}. ` +
            `Survived = released, left and observed, relocated, or permanent care. Died = dead, died or euthanased.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the diagram: ${err.message}</p>`;
    }
})();
