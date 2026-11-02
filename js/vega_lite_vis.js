// Embeds each visualisation into its div (same approach as the FIT3179 Week 7 studio).
// Every chart is a JSON spec in vega/: data loading, transforms, encodings and interactions are all in the spec.
// All specs are Vega-Lite except 09 (Dorling cartogram), which is Vega because Vega-Lite has no force layout;
// vegaEmbed reads each spec's "$schema" and renders both kinds the same way.

var vg_1 = "vega/idiom01-choropleth.vg.json";
vegaEmbed("#map", vg_1, { actions: false, renderer: "svg" }).then(function (result) {
    // Access the Vega view instance (https://vega.github.io/vega/docs/api/view/) as result.view
}).catch(console.error);

var vg_2 = "vega/idiom02-symbols.vg.json";
vegaEmbed("#symbol-map", vg_2, { actions: false, renderer: "svg" }).catch(console.error);

var vg_3 = "vega/idiom03-reasons.vg.json";
vegaEmbed("#reasons-chart", vg_3, { actions: false, renderer: "svg" }).catch(console.error);

var vg_4 = "vega/idiom04-seasonality.vg.json";
vegaEmbed("#seasonality-chart", vg_4, { actions: false, renderer: "svg" }).catch(console.error);

var vg_4b = "vega/idiom04-spring.vg.json";
vegaEmbed("#spring-chart", vg_4b, { actions: false, renderer: "svg" }).catch(console.error);

var vg_5 = "vega/idiom05-heatmap.vg.json";
vegaEmbed("#heatmap-chart", vg_5, { actions: false, renderer: "svg" }).catch(console.error);

var vg_6 = "vega/idiom06-bubble.vg.json";
vegaEmbed("#bubble-chart", vg_6, { actions: false, renderer: "svg" }).catch(console.error);

var vg_6b = "vega/idiom06b-group-summary.vg.json";
vegaEmbed("#group-summary", vg_6b, { actions: false, renderer: "svg" }).catch(console.error);

var vg_7 = "vega/idiom07-bump.vg.json";
vegaEmbed("#vis-07-bump", vg_7, { actions: false, renderer: "svg" }).catch(console.error);

var vg_8 = "vega/idiom08-dumbbell.vg.json";
vegaEmbed("#vis-08-connected-dot", vg_8, { actions: false, renderer: "svg" }).catch(console.error);

var vg_8b = "vega/idiom08-overview.vg.json";
vegaEmbed("#dot-ov-bar", vg_8b, { actions: false, renderer: "svg" }).catch(console.error);

var vg_9 = "vega/idiom09-dorling.vg.json";
vegaEmbed("#dorling-chart", vg_9, { actions: false, renderer: "svg" }).catch(console.error);

var vg_10 = "vega/idiom10-treemap.vg.json";
vegaEmbed("#treemap-chart", vg_10, { actions: false, renderer: "svg" }).catch(console.error);

var vg_11 = "vega/idiom11-sankey.vg.json";
vegaEmbed("#sankey-chart", vg_11, { actions: false, renderer: "svg" }).catch(console.error);

var vg_12 = "vega/idiom12-small-multiples.vg.json";
vegaEmbed("#small-multiples-chart", vg_12, { actions: false, renderer: "svg" }).catch(console.error);

var vg_13 = "vega/idiom13-lollipop.vg.json";
vegaEmbed("#lollipop-chart", vg_13, { actions: false, renderer: "svg" }).catch(console.error);

var vg_14 = "vega/idiom14-waffle.vg.json";
vegaEmbed("#waffle-chart", vg_14, { actions: false, renderer: "svg" }).catch(console.error);
