// Offline data preparation for the Sankey diagram (idiom 09). Run once: node tools/make-sankey.mjs
// Vega-Lite has no Sankey layout, so this script computes node positions and samples each band's S-curve into
// points at a fixed size, for every animal group. vega/idiom09-sankey.vg.json only draws them (area, rect, text).
// Input:  data/rescue_outcomes_by_group.csv (Kwok et al. 2021, Table 10).
// Estimated flows (author-calculated): died = round(total × died% / 100), survived = total − died.
// Output: data/sankey_layout.json, one flat list; "kind" says whether a row is a flow point, a node or a label.
import { readFileSync, writeFileSync } from "node:fs";

const W = 1030, H = 420, NODE_W = 14, GAP = 6, RIGHT_GAP = 28, SAMPLES = 40, TOP_N = 8;
const PAD_L = 250, PAD_R = 210;
const GROUPS = ["Birds", "Mammals", "Reptiles"], OUTCOMES = ["Survived", "Died"];

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

const [header, ...body] = parseCsv(readFileSync("data/rescue_outcomes_by_group.csv", "utf8"));
const col = n => header.indexOf(n);
const iG = col("animal_group"), iR = col("rescue_reason"), iD = col("died_pct"), iS = col("survived_pct"), iN = col("total_rescues");
const rows = body
    .filter(r => GROUPS.includes(r[iG]) && /^\d+(\.\d+)?$/.test(r[iD]) && /^\d+(\.\d+)?$/.test(r[iS]) && /^\d+$/.test(r[iN]))
    .map(r => {
        const n = Number(r[iN]), died = Number(r[iD]);
        const estDied = Math.round(n * died / 100);
        return { group: r[iG], reason: r[iR], n, died_pct: died, survived_pct: Number(r[iS]), Died: estDied, Survived: n - estDied };
    });

const fmt = v => Number(v).toLocaleString("en-AU");
const ease = t => 3 * t * t - 2 * t * t * t;
const xAt = (t, x0, x1) => { const xm = (x0 + x1) / 2; return (1 - t) ** 3 * x0 + 3 * t * (1 - t) * xm + t ** 3 * x1; };
const r2 = v => +v.toFixed(2);
const x0 = PAD_L + NODE_W, x1 = W - PAD_R;
const flows = [], nodes = [], labels = [];

for (const group of GROUPS) {
    const top = rows.filter(r => r.group === group && r.reason !== "Unknown").sort((a, b) => b.n - a.n).slice(0, TOP_N);
    const T = top.reduce((s, r) => s + r.n, 0);
    const outTotal = { Survived: top.reduce((s, r) => s + r.Survived, 0), Died: top.reduce((s, r) => s + r.Died, 0) };
    const k = (H - GAP * (top.length - 1)) / T;   // one scale for both sides
    const leftY = new Map(); let y = 0;
    for (const r of top) { leftY.set(r.reason, { y0: y, y1: y + r.n * k }); y += r.n * k + GAP; }
    const rightY = new Map(); let ry = (H - (T * k + RIGHT_GAP)) / 2;
    for (const o of OUTCOMES) { rightY.set(o, { y0: ry, y1: ry + outTotal[o] * k }); ry += outTotal[o] * k + RIGHT_GAP; }

    const srcOff = new Map(top.map(r => [r.reason, leftY.get(r.reason).y0]));
    const tgtOff = new Map(OUTCOMES.map(o => [o, rightY.get(o).y0]));
    for (const r of top) {
        for (const o of OUTCOMES) {
            const v = r[o];
            if (v === 0) continue;
            const h = v * k, sy = srcOff.get(r.reason), ty = tgtOff.get(o);
            srcOff.set(r.reason, sy + h); tgtOff.set(o, ty + h);
            const base = { group, flow: `${group}|${r.reason}|${o}`, src: r.reason, tgt: o, est: v,
                share: r2(100 * v / r.n), published: o === "Died" ? r.died_pct : r.survived_pct, total: r.n };
            for (let i = 0; i <= SAMPLES; i++) {
                const t = i / SAMPLES, yTop = sy + (ty - sy) * ease(t);
                flows.push({ ...base, x: r2(xAt(t, x0, x1)), y_top: r2(yTop), y_bot: r2(yTop + h) });
            }
        }
    }
    for (const r of top) {
        const { y0, y1 } = leftY.get(r.reason);
        nodes.push({ group, node: r.reason, x0: PAD_L, x1: PAD_L + NODE_W, y0: r2(y0), y1: r2(Math.max(y0 + 1, y1)), colour: "#5B6770", detail: `${fmt(r.n)} rescues (source)` });
        labels.push({ group, kind: "reason", x: PAD_L - 10, y: r2((y0 + y1) / 2), text: `${r.reason} · ${fmt(r.n)}` });
    }
    for (const o of OUTCOMES) {
        const { y0, y1 } = rightY.get(o);
        const p = (100 * outTotal[o] / T).toFixed(1);
        nodes.push({ group, node: o, x0: x1, x1: x1 + NODE_W, y0: r2(y0), y1: r2(Math.max(y0 + 1, y1)), colour: o === "Died" ? "#B83F35" : "#7A55B3", detail: `≈${fmt(outTotal[o])} estimated (${p}% of the ${top.length} reasons shown)` });
        labels.push({ group, kind: "outcome", x: x1 + NODE_W + 10, y: r2((y0 + y1) / 2 - 8), text: o });
        labels.push({ group, kind: "estimate", x: x1 + NODE_W + 10, y: r2((y0 + y1) / 2 + 10), text: `≈${fmt(outTotal[o])} cases · ${p}%` });
    }
}

writeFileSync("data/sankey_layout.json", JSON.stringify([...flows.map(d => ({ kind: "flow", ...d })), ...nodes.map(d => ({ kind: "node", ...d })), ...labels]) + "\n");
console.log(`${flows.length} flow points, ${nodes.length} nodes, ${labels.length} labels (${W}×${H}).`);
