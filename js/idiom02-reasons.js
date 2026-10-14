// Idiom 02: What brings animals into care?
// Ranked bar chart of rescue reasons, read from data/rescue_reasons_by_year.csv.
// If the file is missing or has no usable rows, a message is shown instead of a chart.
(async function () {
    const REASONS_URL = "data/rescue_reasons_by_year.csv";
    const chartEl = document.getElementById("reasons-chart");

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Rescue numbers by reason could not be shown</h3><p>${message}</p></div>`;
    }

    let text;
    try {
        const res = await fetch(REASONS_URL);
        if (!res.ok) {
            showUnavailable(`The file <code>${REASONS_URL}</code> could not be found. No chart is shown and no values have been filled in.`);
            return;
        }
        text = await res.text();
    } catch (err) {
        showUnavailable(`The file <code>${REASONS_URL}</code> could not be read. No chart is shown and no values have been filled in.`);
        return;
    }

    // Expects reason,financial_year,rescue_count. Blank or non-numeric counts are skipped, never treated as zero.
    const rows = [];
    for (const line of text.trim().split(/\r?\n/).slice(1)) {
        const parts = line.split(",");
        const raw = parts.pop().trim();
        const year = parts.pop()?.trim();
        const reason = parts.join(",").trim().replace(/^"|"$/g, "");
        if (reason && year && /^\d+$/.test(raw)) rows.push({ reason, financial_year: year, rescue_count: Number(raw) });
    }
    if (rows.length === 0) {
        showUnavailable(`The file <code>${REASONS_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`);
        return;
    }

    const years = [...new Set(rows.map(r => r.financial_year))].sort();
    const fmt = n => n.toLocaleString("en-AU");

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: { step: 22 },
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: rows },
        params: [{ name: "reason_year", value: years[years.length - 1], bind: { input: "select", options: years, name: "Financial year ", element: "#reasons-year" } }],
        transform: [
            { filter: "datum.financial_year === reason_year" },
            { window: [{ op: "rank", as: "rank" }], sort: [{ field: "rescue_count", order: "descending" }] },
            { filter: "datum.rank <= 15" }
        ],
        encoding: {
            y: { field: "reason", type: "nominal", sort: { field: "rescue_count", op: "max", order: "descending" }, title: null, axis: { labelLimit: 220, labelFontSize: 11, ticks: false, domain: false } },
            x: { field: "rescue_count", type: "quantitative", title: "Number of rescues", axis: { format: ",d", grid: true, tickCount: 5 } },
            tooltip: [
                { field: "reason", title: "Reason" },
                { field: "financial_year", title: "Year" },
                { field: "rescue_count", title: "Rescues", format: ",d" }
            ]
        },
        layer: [
            {
                mark: { type: "bar", cornerRadiusEnd: 2, height: { band: 0.7 } },
                encoding: { color: { condition: { test: "datum.rank === 1", value: "#C66B4E" }, value: "#397DA5" } }
            },
            {
                mark: { type: "text", align: "left", baseline: "middle", dx: 4, fontSize: 11, color: "#25332F" },
                encoding: { text: { field: "rescue_count", format: ",d" } }
            }
        ],
        config: { view: { stroke: null }, font: "Atkinson Hyperlegible, system-ui, sans-serif", axis: { labelColor: "#25332F", titleColor: "#25332F", gridColor: "#edf0f2" } }
    };

    // Years in the file look like 2022-23; show them with an en dash.
    const showYear = year => year.replace(/[-\/]/, "–");

    // No share is shown: the file lists only some reasons, so its total is not all rescues.
    function updateSummary(year) {
        const inYear = rows.filter(r => r.financial_year === year).sort((a, b) => b.rescue_count - a.rescue_count);
        const top = inYear[0];
        document.getElementById("reasons-summary").innerHTML =
            `In <b>${showYear(year)}</b>, the most common reason was <b>${top.reason}</b>, ` +
            `with ${fmt(top.rescue_count)} rescues.`;
        document.getElementById("reasons-note").textContent =
            `Reporting period: ${showYear(years[0])}${years.length > 1 ? " to " + showYear(years[years.length - 1]) : ""}. ` +
            `Source: ${REASONS_URL}. Rescues with an unknown reason are not included.`;
    }

    try {
        document.getElementById("reasons-chart").innerHTML = "";
        document.getElementById("reasons-controls").hidden = false;
        document.getElementById("reasons-summary").hidden = false;
        const { view } = await vegaEmbed("#reasons-chart", spec, { actions: false, renderer: "svg" });
        updateSummary(view.signal("reason_year"));
        view.addSignalListener("reason_year", (_, year) => updateSummary(year));
    } catch (err) {
        console.error(err);
        document.getElementById("reasons-chart").innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
