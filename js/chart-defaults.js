// Shared text defaults for every Vega-Lite chart, so chart labels match the page typography.
// Passed to vegaEmbed as `config`; values set inside a chart's own spec still take precedence.
window.CHART_TEXT = {
    font: "Atkinson Hyperlegible, system-ui, sans-serif",
    axis: { labelFontSize: 11, titleFontSize: 12, titleFontWeight: 700 },
    legend: { labelFontSize: 11, titleFontSize: 12, titleFontWeight: 700 },
    header: { labelFontSize: 12, titleFontSize: 12 },
    title: { fontSize: 14, subtitleFontSize: 12 }
};

// Shared source citations for the notes under each chart (full references are in the page footer).
window.SRC = {
    kwok: part => `Kwok et al. (2021), <i>PLOS ONE</i>, ${part} (<a href="https://doi.org/10.1371/journal.pone.0257209">doi:10.1371/journal.pone.0257209</a>)`,
    dashboard: `NSW DCCEEW, <a href="https://www.environment.nsw.gov.au/topics/animals-and-plants/native-animals/rehabilitating-native-animals/wildlife-rehabilitation-data-and-reporting/wildlife-rehabilitation-data-dashboard">NSW Wildlife Rehabilitation Data Dashboard</a>`,
    report2223: `NSW DCCEEW, <a href="https://www2.environment.nsw.gov.au/sites/default/files/wildlife-rehabilitaton-annual-report-2022-23-240222.pdf">NSW Wildlife Rehabilitation Annual Report 2022–23</a>, p. 15`
};
