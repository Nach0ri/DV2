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

// One colour = one meaning across the whole page. Every chart reads its colours from here.
// Checked with colour-blind simulation (deuteranopia, protanopia, tritanopia): every colour set that
// appears together in one chart keeps a colour difference (CIE ΔE) of at least 20.
window.PALETTE = {
    // Animal groups (categorical): dark blue, gold, green, separated in lightness as well as hue.
    group: { Birds: "#23508F", Mammals: "#E0AE2E", Reptiles: "#4CA36B" },
    // Darker versions for text and labels on white, so every label passes contrast.
    groupText: { Birds: "#23508F", Mammals: "#8A6A12", Reptiles: "#2E7A4A" },
    // Text drawn on top of a group-coloured fill.
    groupOn: { Birds: "#FFFFFF", Mammals: "#25332F", Reptiles: "#1B2A22" },
    // Outcomes: Died in red; every "survived" category in the purple family; escaped in grey.
    outcome: {
        "Died": "#B83F35",
        "Released": "#7A55B3",
        "Left and observed": "#D2C2EC",
        "Permanent/long term care": "#341C57",
        "Escaped rescuer or from care": "#8F9592",
        "Survived": "#7A55B3"
    },
    // Text on top of an outcome fill (light fills get dark text).
    outcomeOn: { "Died": "#FFFFFF", "Released": "#FFFFFF", "Left and observed": "#25332F", "Permanent/long term care": "#FFFFFF", "Escaped rescuer or from care": "#FFFFFF" },
    // Direction of change between two years.
    change: { rose: "#A0286C", same: "#D6DAD7", fell: "#8FA0A9", fellText: "#5F6F78" },
    // Neutral roles: years, emphasis and context (no hue, so they never compete with a category).
    neutral: { ink: "#25332F", earlier: "#A9B1AD", context: "#9DAAA4", stem: "#D3D7D4", muted: "#5E6B63" },
    // Magnitude (low to high): the brand teal ramp, used only for sequential data.
    sequential: ["#E6F2EF", "#C2E0D8", "#93C7B9", "#5FA897", "#348676", "#176B60", "#0B4A42"]
};
