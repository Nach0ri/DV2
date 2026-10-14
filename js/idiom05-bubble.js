// Idiom 05: More Rescues, Better Outcomes?
// Bubble chart of rescue reasons: x = total rescue cases, y = Positive outcome (%), bubble area = cases.
// Data: data/rescue_fate_by_reason_year.csv, built from S9 (Birds only). "Unknown" reason is not plotted.
// The source does not define "Positive" or "Negative" in the workbook, so the chart uses those labels as given.
(async function () {
    const DATA_URL = "data/rescue_fate_by_reason_year.csv";
    const ADEQUATE = 100;   // minimum cases for an outcome to be used in insights and labels
    const chartEl = document.getElementById("bubble-chart");

    function showUnavailable(message) {
        chartEl.innerHTML =
            `<div class="placeholder" role="note"><span class="tag">Data unavailable</span>` +
            `<h3>Outcome chart could not be shown</h3><p>${message}</p></div>`;
    }

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

    let text;
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) { showUnavailable(`The file <code>${DATA_URL}</code> could not be found. No chart is shown and no values have been filled in.`); return; }
        text = await res.text();
    } catch (err) {
        showUnavailable(`The file <code>${DATA_URL}</code> could not be read. No chart is shown and no values have been filled in.`);
        return;
    }

    const [header, ...body] = parseCsv(text);
    const col = name => header.indexOf(name);
    const iGrp = col("group"), iReason = col("reason"), iYear = col("reporting_year"), iN = col("number_of_rescues_s9"),
          iNeg = col("negative_pct"), iPos = col("positive_pct");
    if ([iGrp, iReason, iYear, iN, iNeg, iPos].some(i => i < 0)) { showUnavailable(`The file <code>${DATA_URL}</code> is missing expected columns.`); return; }

    // Keep rows with a valid count and percentages. Blank or non-numeric values are skipped, never treated as zero.
    const rows = body
        .filter(r => r.length >= 6 && r[iReason] !== "Unknown" && /^\d+$/.test(r[iN]) && r[iPos] !== "" && r[iNeg] !== "")
        .map(r => ({
            animal_group: r[iGrp], reason: r[iReason], reporting_year: r[iYear],
            cases: Number(r[iN]), negative_pct: Number(r[iNeg]), positive_pct: Number(r[iPos])
        }));
    if (rows.length === 0) { showUnavailable(`The file <code>${DATA_URL}</code> has no usable rows. No chart is shown and no values have been filled in.`); return; }

    const years = [...new Set(rows.map(r => r.reporting_year))].sort();
    const showYear = y => y.replace(/[-\/]/, "–");
    const yearOptions = years.map(showYear);
    const latest = yearOptions[yearOptions.length - 1];

    // Label flags are computed per year: the largest category, and the highest and lowest positive share among adequate cases.
    function flagLabels(list) {
        const adequate = list.filter(r => r.cases >= ADEQUATE);
        const biggest = list.reduce((a, b) => (b.cases > a.cases ? b : a), list[0]);
        const hi = adequate.length ? adequate.reduce((a, b) => (b.positive_pct > a.positive_pct ? b : a)) : null;
        const lo = adequate.length ? adequate.reduce((a, b) => (b.positive_pct < a.positive_pct ? b : a)) : null;
        for (const r of list) {
            r.label = (r === biggest || r === hi || r === lo) ? r.reason : "";
        }
    }
    for (const y of years) flagLabels(rows.filter(r => r.reporting_year === y));

    const tooltip = [
        { field: "reason", type: "nominal", title: "Reason" },
        { field: "year_label", type: "nominal", title: "Reporting year" },
        { field: "animal_group", type: "nominal", title: "Animal group" },
        { field: "cases", type: "quantitative", title: "Total rescue cases (denominator)", format: ",d" },
        { field: "positive_pct", type: "quantitative", title: "Positive (% of cases)", format: ".1f" },
        { field: "negative_pct", type: "quantitative", title: "Negative (% of cases)", format: ".1f" }
    ];

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: 420,
        autosize: { type: "fit-x", contains: "padding" },
        data: { values: rows },
        params: [
            { name: "bubble_year", value: latest, bind: { input: "select", options: yearOptions, name: "Reporting year ", element: "#bubble-year" } },
        ],
        transform: [
            { calculate: "replace(datum.reporting_year, '-', '–')", as: "year_label" },
            { filter: "datum.year_label === bubble_year" },
            { calculate: "datum.label", as: "label_text" }
        ],
        layer: [
            {
                params: [{ name: "hover", select: { type: "point", fields: ["reason"], on: "mouseover", clear: "mouseout" } }],
                mark: { type: "circle", stroke: "#1f2933", strokeWidth: 0.6, cursor: "pointer" },
                encoding: {
                    x: {
                        field: "cases", type: "quantitative", title: "Total rescue cases (S9 number of rescues)",
                        scale: { zero: true }, axis: { format: ",d", grid: true, tickCount: 6, labelFontSize: 11, titleFontSize: 11.5 }
                    },
                    y: {
                        field: "positive_pct", type: "quantitative", title: "Positive (% of cases, as labelled in source)",
                        scale: { domain: [0, 100] }, axis: { format: "d", grid: true, tickCount: 6, labelFontSize: 11, titleFontSize: 11.5 }
                    },
                    size: {
                        field: "cases", type: "quantitative", title: "Rescue cases (bubble area)",
                        scale: { type: "sqrt", range: [40, 1800], zero: true },
                        legend: { orient: "bottom", direction: "horizontal", titleFontSize: 11, labelFontSize: 10, format: ",d", values: [100, 1000, 3000] }
                    },
                    color: {
                        field: "animal_group", type: "nominal", title: "Animal group",
                        scale: { domain: ["Birds"], range: ["#0072B2"] },
                        legend: { orient: "bottom", direction: "horizontal", titleFontSize: 11, labelFontSize: 10, title: "Animal group (S9: Birds only)" }
                    },
                    opacity: { condition: { param: "hover", empty: false, value: 1 }, value: 0.6 },
                    strokeWidth: { condition: { param: "hover", empty: false, value: 2.2 }, value: 0.6 },
                    tooltip
                }
            },
            {
                transform: [{ filter: "datum.label_text !== ''" }],
                mark: { type: "text", align: "left", dx: 10, dy: -4, fontSize: 11, fontWeight: 600, stroke: "#ffffff", strokeWidth: 3, color: "#1f2933", clip: false },
                encoding: {
                    x: { field: "cases", type: "quantitative" },
                    y: { field: "positive_pct", type: "quantitative" },
                    text: { field: "label_text" }
                }
            },
            {
                transform: [{ filter: "datum.label_text !== ''" }],
                mark: { type: "text", align: "left", dx: 10, dy: -4, fontSize: 11, fontWeight: 600, color: "#1f2933", clip: false },
                encoding: {
                    x: { field: "cases", type: "quantitative" },
                    y: { field: "positive_pct", type: "quantitative" },
                    text: { field: "label_text" }
                }
            }
        ],
        config: { view: { stroke: null }, font: "Avenir, Segoe UI, Verdana, sans-serif", axis: { labelColor: "#3e4a55", titleColor: "#3e4a55", gridColor: "#edf0f2" } }
    };

    // Insight panel: values come from the same rows the chart uses, for the selected year.
    function summarise(yearLabel) {
        const list = rows.filter(r => showYear(r.reporting_year) === yearLabel);
        const total = list.reduce((s, r) => s + r.cases, 0);
        const biggest = list.reduce((a, b) => (b.cases > a.cases ? b : a));
        const adequate = list.filter(r => r.cases >= ADEQUATE);
        const hi = adequate.reduce((a, b) => (b.positive_pct > a.positive_pct ? b : a));
        const lo = adequate.reduce((a, b) => (b.positive_pct < a.positive_pct ? b : a));
        document.getElementById("bubble-summary").innerHTML =
            `In <b>${yearLabel}</b>, the most rescues were for <b>${biggest.reason}</b> (${biggest.cases.toLocaleString("en-AU")} cases, ` +
            `${(100 * biggest.cases / total).toFixed(1)}% of ${total.toLocaleString("en-AU")} cases). ` +
            `Among causes with at least ${ADEQUATE} cases, the highest positive share was <b>${hi.reason}</b> (${hi.positive_pct.toFixed(1)}%) ` +
            `and the lowest was <b>${lo.reason}</b> (${lo.positive_pct.toFixed(1)}%).`;
    }

    try {
        chartEl.innerHTML = "";
        document.getElementById("bubble-controls").hidden = false;
        document.getElementById("bubble-summary").hidden = false;
        const { view } = await vegaEmbed("#bubble-chart", spec, { actions: false, renderer: "svg" });
        summarise(view.signal("bubble_year"));
        view.addSignalListener("bubble_year", (_, y) => summarise(y));
        document.getElementById("bubble-note").textContent =
            `Source: ${DATA_URL} (S9, Birds only). Denominator for every percentage: the number of rescues in that reason and year in S9. ` +
            `“Unknown” cause is not plotted.`;
    } catch (err) {
        console.error(err);
        chartEl.innerHTML = `<p class="status error">Could not draw the chart: ${err.message}</p>`;
    }
})();
