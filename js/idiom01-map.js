// Idiom 01: Where are rescues happening?
// Choropleth of wildlife rescue records by NSW LGA and financial year (Vega-Lite).
// Counts come from data/rescue_counts_by_lga.csv; LGAs with no row for a year are shown as "no records", never as zero.

const BOUNDARY_URL = "data/nsw_lga.geojson";
const COUNTS_URL = "data/rescue_counts_by_lga.csv";
const NOT_RECORDED = "LGA not recorded"; // CSV rows for records with no LGA: reported in the notes, not mapped
const LORD_HOWE = "Lord Howe Island (unincorporated)";

// Sequential classes (rescue records per LGA per year). Fixed across years so colours are comparable between years.
const CLASS_BREAKS = [100, 250, 500, 1000, 2000, 4000];
const CLASS_COLOURS = ["#fff3c4", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#c4510c", "#7f2d06"];
const NO_DATA_COLOUR = "#d5d9dd";

// Greater Sydney and Central Coast inset (small, high-count LGAs cluster here).
const INSET_BOX = [[150.55, -32.98], [152.15, -32.98], [152.15, -34.25], [150.55, -34.25], [150.55, -32.98]];
const NSW_BOX = [[140.9, -28.1], [153.7, -28.1], [153.7, -37.6], [140.9, -37.6], [140.9, -28.1]];

const statusEl = document.getElementById("map-status");
const fmt = n => n.toLocaleString("en-AU");

function showError(message) {
    statusEl.textContent = message;
    statusEl.classList.add("error");
}

// Parses lga_name,financial_year,rescue_count. Blank or non-numeric counts become null, never zero.
function parseCounts(text) {
    const lines = text.trim().split(/\r?\n/);
    const counts = new Map();   // lga name (lower case) -> { fy: count }
    const notRecorded = {};     // fy -> records with no LGA
    const years = new Set();
    for (const line of lines.slice(1)) {
        const [name, fy, raw] = line.split(",").map(s => s.trim());
        if (!name || !fy) continue;
        const count = /^\d+$/.test(raw) ? Number(raw) : null;
        years.add(fy);
        if (name === NOT_RECORDED) { notRecorded[fy] = count; continue; }
        const key = name.toLowerCase();
        if (!counts.has(key)) counts.set(key, {});
        counts.get(key)[fy] = count;
    }
    return { counts, notRecorded, years: [...years].sort() };
}

async function loadCounts() {
    const res = await fetch(COUNTS_URL);
    if (!res.ok) throw new Error(`Could not load ${COUNTS_URL} (HTTP ${res.status}).`);
    return parseCounts(await res.text());
}

async function loadBoundaries() {
    const res = await fetch(BOUNDARY_URL);
    if (!res.ok) throw new Error(`Could not load ${BOUNDARY_URL} (HTTP ${res.status}).`);
    let geo;
    try {
        geo = JSON.parse(await res.text());
    } catch (err) {
        throw new Error(`${BOUNDARY_URL} is not valid GeoJSON. Replace it with the NSW LGA boundary file.`);
    }
    if (geo.type !== "FeatureCollection" || !Array.isArray(geo.features) || geo.features.length === 0) {
        throw new Error(`${BOUNDARY_URL} does not contain a GeoJSON FeatureCollection.`);
    }
    return geo.features;
}

// Shared transforms: count for the selected year, rank among LGAs and share of mapped records.
// Each row carries one field per financial year; fold + filter picks the selected year
// (indexing datum.counts by a parameter fails in Vega's expression dependency analysis).
const yearTransforms = years => [
    { fold: years, as: ["fy_key", "fy_value"] },
    { filter: "datum.fy_key === selected_year" },
    { calculate: "isValid(datum.fy_value) ? datum.fy_value : null", as: "count" },
    { calculate: "datum.count === null ? -1 : datum.count", as: "count_sort" },
    { window: [{ op: "rank", as: "rank" }], sort: [{ field: "count_sort", order: "descending" }] },
    { joinaggregate: [{ op: "sum", field: "count", as: "mapped_total" }, { op: "valid", field: "count", as: "lgas_with_data" }] },
    { calculate: "datum.count === null ? null : datum.count / datum.mapped_total", as: "share" },
    { calculate: "datum.count === null ? 'No records' : format(datum.count, ',')", as: "count_label" },
    { calculate: "datum.count === null ? '–' : datum.rank + ' of ' + datum.lgas_with_data", as: "rank_label" }
];

const colour = {
    field: "count", type: "quantitative", title: "Rescues",
    scale: { type: "threshold", domain: CLASS_BREAKS, range: CLASS_COLOURS },
    legend: null // drawn in HTML by renderLegend(): Vega-Lite only offers a squashed gradient for threshold scales
};

const tooltip = [
    { field: "lga_name", type: "nominal", title: "Area" },
    { field: "fy_label", type: "nominal", title: "Year" },
    { field: "count_label", type: "nominal", title: "Rescues" },
    { field: "rank_label", type: "nominal", title: "Rank" },
    { field: "share", type: "quantitative", title: "Share of NSW rescues", format: ".1%" }
];

// One choropleth layer + top-5 rank markers/labels, reused by the main map and the inset.
function mapLayers(selectionName, labelFilter) {
    return [
        {
            name: selectionName,
            mark: { type: "geoshape", stroke: "#ffffff", strokeWidth: 0.5, clip: true, cursor: "pointer" },
            encoding: {
                shape: { field: "geo", type: "geojson" },
                color: { condition: { test: "datum.count === null", value: NO_DATA_COLOUR }, ...colour },
                stroke: { condition: [{ param: "hover", empty: false, value: "#111111" }, { param: "pick", empty: false, value: "#111111" }], value: "#ffffff" },
                strokeWidth: { condition: [{ param: "hover", empty: false, value: 2 }, { param: "pick", empty: false, value: 2 }], value: 0.5 },
                opacity: { condition: { param: "pick", value: 1 }, value: 0.35 },
                tooltip
            }
        },
        {
            transform: [{ filter: "datum.rank <= 5 && datum.count !== null" }, { filter: labelFilter }],
            mark: { type: "circle", size: 210, fill: "#1f2933", stroke: "#ffffff", strokeWidth: 1.2, opacity: 1 },
            encoding: { longitude: { field: "lx", type: "quantitative" }, latitude: { field: "ly", type: "quantitative" }, tooltip }
        },
        {
            transform: [{ filter: "datum.rank <= 5 && datum.count !== null" }, { filter: labelFilter }],
            mark: { type: "text", fontSize: 10, fontWeight: 700, color: "#ffffff" },
            encoding: { longitude: { field: "lx", type: "quantitative" }, latitude: { field: "ly", type: "quantitative" }, text: { field: "rank" } }
        },
        {
            // White halo under the label so it stays readable on dark fills.
            transform: [{ filter: "datum.rank <= 5 && datum.count !== null" }, { filter: labelFilter }],
            mark: { type: "text", align: "left", dx: 11, fontSize: 11, fontWeight: 600, stroke: "#ffffff", strokeWidth: 3.5, strokeJoin: "round", opacity: 0.9 },
            encoding: {
                longitude: { field: "lx", type: "quantitative" }, latitude: { field: "ly", type: "quantitative" },
                text: { field: "short_label" }
            }
        },
        {
            transform: [{ filter: "datum.rank <= 5 && datum.count !== null" }, { filter: labelFilter }],
            mark: { type: "text", align: "left", dx: 11, fontSize: 11, fontWeight: 600, color: "#1f2933" },
            encoding: {
                longitude: { field: "lx", type: "quantitative" }, latitude: { field: "ly", type: "quantitative" },
                text: { field: "short_label" }
            }
        }
    ];
}

function buildSpec(rows, years) {
    const latest = years[years.length - 1];
    const projection = box => ({
        type: "conicEqualArea", rotate: [-147, 0], parallels: [-29, -36],
        fit: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [box] } }
    });
    // Transforms live on each view: each view computes the selected year's values.
    const viewTransforms = [
        ...yearTransforms(years),
        { calculate: "replace(datum.fy_key, '/', '–')", as: "fy_label" },
        { calculate: "datum.lga_name + '  ' + format(datum.count, ',')", as: "short_label" }
    ];
    const inInset = `datum.lx >= ${INSET_BOX[0][0]} && datum.lx <= ${INSET_BOX[1][0]} && datum.ly <= ${INSET_BOX[0][1]} && datum.ly >= ${INSET_BOX[2][1]}`;

    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: rows },
        params: [
            { name: "selected_year", value: latest, bind: { input: "select", options: years, name: "Financial year ", element: "#fy-control" } },
            { name: "hover", select: { type: "point", fields: ["lga_name"], on: "mouseover", clear: "mouseout" }, views: ["lgaMain", "lgaInset"] },
            { name: "pick", select: { type: "point", fields: ["lga_name"], on: "click", clear: "dblclick" }, views: ["lgaMain", "lgaInset", "topBars"] }
        ],
        align: "none",
        center: false,
        columns: 1,
        concat: [
            {
                hconcat: [
                    {
                        width: 530, height: 450,
                        title: { text: "Wildlife rescues by council area", subtitle: "Darker areas had more rescues. Numbers 1 to 5 mark the top five.", anchor: "start" },
                        transform: viewTransforms,
                        projection: projection(NSW_BOX),
                        layer: [
                            ...mapLayers("lgaMain", `!(${inInset}) && datum.lga_name !== '${LORD_HOWE}'`),
                            {
                                data: { values: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [INSET_BOX] } }] },
                                mark: { type: "geoshape", filled: false, stroke: "#1f2933", strokeWidth: 1.1, strokeDash: [4, 3] }
                            }
                        ]
                    },
                    {
                        width: 290, height: 360,
                        title: { text: "Sydney and Central Coast", subtitle: "Close-up of the dashed box", anchor: "start" },
                        transform: viewTransforms,
                        projection: projection(INSET_BOX),
                        layer: mapLayers("lgaInset", inInset)
                    }
                ]
            },
            {
                width: 860,
                height: { step: 17 },
                title: {
                    text: "Top 15 council areas",
                    subtitle: "Click a bar to find the area on the map.",
                    anchor: "start"
                },
                transform: [...viewTransforms, { filter: "datum.count !== null && datum.rank <= 15" }],
                encoding: {
                    y: { field: "lga_name", type: "nominal", sort: { field: "count", op: "max", order: "descending" }, axis: null },
                    x: {
                        field: "count", type: "quantitative", title: "Number of rescues",
                        scale: { domain: [0, 11000] },
                        axis: { format: ",d", values: [0, 2000, 4000, 6000, 8000], grid: true, domain: false }
                    },
                    tooltip
                },
                layer: [
                    {
                        name: "topBars",
                        mark: { type: "bar", cursor: "pointer", cornerRadiusEnd: 2, height: { band: 0.72 }, stroke: "#5b4a3a", strokeWidth: 0.4 },
                        encoding: { color: { ...colour, legend: null }, opacity: { condition: { param: "pick", value: 1 }, value: 0.35 } }
                    },
                    {
                        mark: { type: "text", align: "left", baseline: "middle", dx: 5, fontSize: 11, color: "#1f2933" },
                        encoding: { text: { field: "bar_label" } },
                        transform: [{ calculate: "datum.rank + '. ' + datum.lga_name + '  ' + format(datum.count, ',')", as: "bar_label" }]
                    }
                ]
            }
        ],
        config: {
            view: { stroke: null },
            font: "Avenir, Segoe UI, Verdana, sans-serif",
            title: { fontSize: 14, fontWeight: 600, color: "#1f2933", subtitleFontSize: 11.5, subtitleColor: "#5b6770", offset: 8 },
            axis: { labelFontSize: 10.5, titleFontSize: 11, labelColor: "#3e4a55", titleColor: "#3e4a55", gridColor: "#edf0f2" },
            concat: { spacing: 28 }
        }
    };
}

// HTML legend for the fixed classes, kept in sync with CLASS_BREAKS / CLASS_COLOURS.
function renderLegend() {
    const labels = CLASS_COLOURS.map((_, i) =>
        i === 0 ? `Under ${fmt(CLASS_BREAKS[0])}`
        : i === CLASS_BREAKS.length ? `${fmt(CLASS_BREAKS[i - 1])}+`
        : `${fmt(CLASS_BREAKS[i - 1])}–${fmt(CLASS_BREAKS[i] - 1)}`);
    const item = (colour, label) => `<span class="key"><i style="background:${colour}"></i>${label}</span>`;
    document.getElementById("map-legend").innerHTML =
        `<b>Number of rescues</b>` +
        CLASS_COLOURS.map((c, i) => item(c, labels[i])).join("") + item(NO_DATA_COLOUR, "No records");
}

// Evidence-based notes for the selected year, computed from the same data the map shows.
function updateNotes(rows, notRecorded, fy) {
    const withData = rows.filter(r => r.counts[fy] !== undefined && r.counts[fy] !== null);
    const total = withData.reduce((s, r) => s + r.counts[fy], 0);
    const sorted = [...withData].sort((a, b) => b.counts[fy] - a.counts[fy]);
    const top5 = sorted.slice(0, 5).reduce((s, r) => s + r.counts[fy], 0);
    const half = Math.ceil(sorted.length / 2);
    const bottomHalf = sorted.slice(half).reduce((s, r) => s + r.counts[fy], 0);
    const lordHowe = rows.find(r => r.lga_name === LORD_HOWE);
    const label = fy.replace("/", "–");

    document.getElementById("fy-summary").innerHTML =
        `In <b>${label}</b>, ${fmt(total)} rescues were linked to a council area. ` +
        `The top five (${sorted.slice(0, 5).map(r => r.lga_name).join(", ")}) had ` +
        `<b>${(100 * top5 / total).toFixed(1)}%</b> of them. The bottom ${sorted.length - half} areas together had only ` +
        `${(100 * bottomHalf / total).toFixed(1)}%.`;
    document.getElementById("fy-gaps").textContent =
        `${fmt(notRecorded[fy] ?? 0)} rescues in ${label} had no location, so they are not on the map. ` +
        `Lord Howe Island is too far east to show (${lordHowe && lordHowe.counts[fy] != null ? fmt(lordHowe.counts[fy]) + " rescues" : "no data"}). ` +
        `Grey areas have no data.`;
}

async function init() {
    try {
        const [features, { counts, notRecorded, years }] = await Promise.all([loadBoundaries(), loadCounts()]);

        const rows = features.map(feature => {
            const p = feature.properties || {};
            if (!p.lga_name) throw new Error(`${BOUNDARY_URL} features need an lga_name property.`);
            return {
                lga_name: p.lga_name,
                lx: p.lx,
                ly: p.ly,
                counts: counts.get(p.lga_name.toLowerCase()) || {},
                geo: feature.geometry
            };
        });

        // Flatten counts into one field per year for the fold transform.
        for (const r of rows) for (const y of years) r[y] = r.counts[y] ?? null;

        const unmatched = [...counts.keys()].filter(k => !rows.some(r => r.lga_name.toLowerCase() === k));
        if (unmatched.length) console.warn("Count rows with no matching boundary:", unmatched);

        // vegaEmbed replaces the contents of #map, so render into a child and keep the status element until it succeeds.
        const target = document.createElement("div");
        document.getElementById("map").appendChild(target);
        const { view } = await vegaEmbed(target, buildSpec(rows, years), { actions: { export: true, source: false, compiled: false, editor: false }, renderer: "svg" });
        statusEl.remove();
        renderLegend();
        updateNotes(rows, notRecorded, view.signal("selected_year"));
        view.addSignalListener("selected_year", (_, fy) => updateNotes(rows, notRecorded, fy));
    } catch (err) {
        console.error(err);
        showError(err.message);
    }
}

init();
