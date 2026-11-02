// Offline data preparation for the treemap (idiom 08). Run once: node tools/make-treemap.mjs
// Vega-Lite has no treemap layout, so this script computes each rectangle's corners (squarified layout,
// Bruls, Huizing & van Wijk) at a fixed size and saves them. vega/idiom08-treemap.vg.json only draws them.
// Input:  data/rescue_monthly_by_group.csv (Kwok et al. 2021, S7), summed per sub-group over all months and years.
// Output: data/treemap_layout.csv (one row per group band and per sub-group tile).
import { readFileSync, writeFileSync } from "node:fs";

const W = 1030, H = 480, BAND = 24, GAP = 1.5;
const GROUPS = ["Birds", "Mammals", "Reptiles"];
const UNKNOWN = /unknown|unidentified/i;

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

const [header, ...body] = parseCsv(readFileSync("data/rescue_monthly_by_group.csv", "utf8"));
const col = n => header.indexOf(n);
const iG = col("animal_group"), iS = col("sub_group"), iC = col("rescue_count");
const sub = new Map();
let excluded = 0;
for (const r of body) {
    if (!GROUPS.includes(r[iG]) || !/^\d+$/.test(r[iC])) continue;
    if (UNKNOWN.test(r[iS])) { excluded += Number(r[iC]); continue; }
    const key = `${r[iG]}|${r[iS]}`;
    sub.set(key, (sub.get(key) || 0) + Number(r[iC]));
}
const total = [...sub.values()].reduce((s, v) => s + v, 0);
const groups = GROUPS.map(g => {
    const children = [...sub.entries()].filter(([k]) => k.startsWith(g + "|"))
        .map(([k, v]) => ({ name: k.split("|")[1], group: g, value: v })).sort((a, b) => b.value - a.value);
    return { name: g, value: children.reduce((s, c) => s + c.value, 0), children };
});
const ranked = [...sub.entries()].map(([k, v]) => ({ group: k.split("|")[0], name: k.split("|")[1], v })).sort((a, b) => b.v - a.v);

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
// Truncate a label to roughly fit a width (about 0.56 em per character).
function fit(text, width, size) {
    const max = Math.max(0, Math.floor((width - 8) / (size * 0.56)));
    return text.length <= max ? text : (max > 2 ? text.slice(0, max - 1) + "…" : "");
}

const rows = [];
const top = squarify(groups.map(g => ({ ...g, area: (g.value / total) * W * H })), 0, 0, W, H);
for (const g of top) {
    const full = `${g.name} · ${fmt(g.value)} (${pct(g.value)})`;
    const bandLabel = fit(full, g.w, 12.5).endsWith("…") ? fit(g.name, g.w, 12.5) : fit(full, g.w, 12.5);
    rows.push({ kind: "band", group: g.name, name: g.name, value: g.value, share: (100 * g.value / total).toFixed(1),
        x0: g.x, x1: g.x + g.w, y0: g.y, y1: g.y + Math.min(BAND, g.h), name_label: bandLabel, count_label: "", label_x: g.x + 7, name_y: g.y + BAND / 2, count_y: 0, rank: 0, badge_x: 0, badge_y: 0 });
    const inner = { x: g.x + GAP, y: g.y + BAND, w: Math.max(0, g.w - 2 * GAP), h: Math.max(0, g.h - BAND - GAP) };
    for (const l of squarify(g.children.map(c => ({ ...c, area: (c.value / g.value) * inner.w * inner.h })), inner.x, inner.y, inner.w, inner.h)) {
        const name = fit(l.name, l.w, 12);
        const withShare = `${fmt(l.value)} · ${pct(l.value)}`;
        const count = fit(withShare, l.w, 11).endsWith("…") ? fit(fmt(l.value), l.w, 11) : fit(withShare, l.w, 11);
        const big = l.w >= 70 && l.h >= 40 && name;
        const rank = ranked.findIndex(d => d.group === l.group && d.name === l.name) + 1;
        rows.push({ kind: "tile", group: l.group, name: l.name, value: l.value, share: (100 * l.value / total).toFixed(1),
            x0: l.x + GAP / 2, x1: l.x + l.w - GAP / 2, y0: l.y + GAP / 2, y1: l.y + l.h - GAP / 2,
            name_label: big ? name : "", count_label: big ? count : (l.w >= 44 && l.h >= 18 ? count : ""),
            label_x: l.x + (big ? 7 : 5), name_y: l.y + 17, count_y: big ? l.y + 31 : l.y + 14,
            rank: rank <= 3 && l.w >= 40 && l.h >= 40 ? rank : 0, badge_x: l.x + l.w - 17, badge_y: l.y + 17 });
    }
}

const cols = Object.keys(rows[0]);
const esc = v => (typeof v === "number" ? +v.toFixed(2) : `"${String(v).replace(/"/g, '""')}"`);
writeFileSync("data/treemap_layout.csv", [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n") + "\n");
console.log(`${rows.length} rows (${W}×${H}); ${fmt(total)} rescues in named sub-groups; ${fmt(excluded)} Unknown/Unidentified excluded.`);
