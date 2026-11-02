// Offline data preparation for the dot density map. Run once: node tools/make-dots.mjs
// Places one dot per DOT_VALUE rescues (2024/25) at random inside each council area's boundary, using a FIXED seed,
// so the output file is identical every time and nothing is randomised when the page loads.
// Dots do not show real rescue locations: the source only gives a count per council area.
// Input:  data/rescue_counts_by_lga.csv, data/nsw_lga.geojson
// Output: data/rescue_dots_2024_25.csv (lga_name, lon, lat)
import { readFileSync, writeFileSync } from "node:fs";

const YEAR = "2024/25";
const DOT_VALUE = 25;          // 1 dot = 25 rescues
const SEED = 20251102;

// mulberry32: small seeded random number generator (same seed, same sequence).
function mulberry32(a) {
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(SEED);

// Even-odd ray casting; a polygon is [outer ring, ...holes], so holes are excluded automatically.
function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
const inPolygon = (x, y, rings) => rings.reduce((acc, ring) => acc !== inRing(x, y, ring), false);
const polygonsOf = geom => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);

const counts = new Map();
for (const line of readFileSync("data/rescue_counts_by_lga.csv", "utf8").trim().split(/\r?\n/).slice(1)) {
    const [name, fy, raw] = line.split(",");
    if (fy === YEAR && /^\d+$/.test(raw)) counts.set(name, Number(raw));
}
const geo = JSON.parse(readFileSync("data/nsw_lga.geojson", "utf8"));

const out = ["lga_name,lon,lat"];
let dots = 0;
const report = [];
for (const f of [...geo.features].sort((a, b) => a.properties.lga_name.localeCompare(b.properties.lga_name))) {
    const name = f.properties.lga_name;
    if (!counts.has(name)) { report.push(`no count for ${name} (no dots)`); continue; }
    const n = Math.round(counts.get(name) / DOT_VALUE);
    const polys = polygonsOf(f.geometry);
    const pts = polys.flat(2);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let placed = 0, tries = 0;
    while (placed < n) {
        if (++tries > n * 100000) throw new Error(`could not place dots in ${name}`);
        const x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0);
        if (!polys.some(rings => inPolygon(x, y, rings))) continue;
        out.push(`${name.includes(",") ? `"${name}"` : name},${x.toFixed(4)},${y.toFixed(4)}`);
        placed++;
    }
    dots += placed;
}
writeFileSync("data/rescue_dots_2024_25.csv", out.join("\n") + "\n");
console.log(`${dots} dots (1 dot = ${DOT_VALUE} rescues, seed ${SEED}).`);
for (const r of report) console.log(r);
