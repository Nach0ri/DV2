// Embeds each Vega-Lite visualisation into its div (same approach as the FIT3179 Week 7 studio).
// Every chart is a Vega-Lite JSON file in vega/: data loading, transforms, encodings and interactions are all in the spec.

var vg_1 = "vega/idiom01-choropleth.vg.json";
vegaEmbed("#map", vg_1, { actions: false, renderer: "svg" }).then(function (result) {
    // Access the Vega view instance (https://vega.github.io/vega/docs/api/view/) as result.view
}).catch(console.error);

var vg_1b = "vega/idiom01b-symbols.vg.json";
vegaEmbed("#symbol-map", vg_1b, { actions: false, renderer: "svg" }).catch(console.error);

var vg_2 ="vega/idiom02-reasons.vg.json";
vegaEmbed("#reasons-chart", vg_2, { actions: false, renderer: "svg" }).catch(console.error);

var vg_3 = "vega/idiom03-seasonality.vg.json";
vegaEmbed("#seasonality-chart", vg_3, { actions: false, renderer: "svg" }).catch(console.error);

var vg_3b = "vega/idiom03-spring.vg.json";
vegaEmbed("#spring-chart", vg_3b, { actions: false, renderer: "svg" }).catch(console.error);

var vg_4 = "vega/idiom04-heatmap.vg.json";
vegaEmbed("#heatmap-chart", vg_4, { actions: false, renderer: "svg" }).catch(console.error);

var vg_5 = "vega/idiom05-bubble.vg.json";
vegaEmbed("#bubble-chart", vg_5, { actions: false, renderer: "svg" }).catch(console.error);

var vg_5b = "vega/idiom05b-group-summary.vg.json";
vegaEmbed("#group-summary", vg_5b, { actions: false, renderer: "svg" }).catch(console.error);

var vg_6 = "vega/idiom06-bump.vg.json";
vegaEmbed("#vis-06-bump", vg_6, { actions: false, renderer: "svg" }).catch(console.error);

var vg_7 = "vega/idiom07-dumbbell.vg.json";
vegaEmbed("#vis-07-connected-dot", vg_7, { actions: false, renderer: "svg" }).catch(console.error);

var vg_7b = "vega/idiom07-overview.vg.json";
vegaEmbed("#dot-ov-bar", vg_7b, { actions: false, renderer: "svg" }).catch(console.error);

// 07b is a Vega spec (Vega-Lite has no force layout); vegaEmbed reads the "$schema" and renders it the same way.
var vg_7c = "vega/idiom07b-dorling.vg.json";
vegaEmbed("#dorling-chart", vg_7c, { actions: false, renderer: "svg" }).catch(console.error);

var vg_8 ="vega/idiom08-treemap.vg.json";
vegaEmbed("#treemap-chart", vg_8, { actions: false, renderer: "svg" }).catch(console.error);

var vg_9 = "vega/idiom09-sankey.vg.json";
vegaEmbed("#sankey-chart", vg_9, { actions: false, renderer: "svg" }).catch(console.error);

var vg_10 = "vega/idiom10-small-multiples.vg.json";
vegaEmbed("#small-multiples-chart", vg_10, { actions: false, renderer: "svg" }).catch(console.error);

var vg_11 = "vega/idiom11-lollipop.vg.json";
vegaEmbed("#lollipop-chart", vg_11, { actions: false, renderer: "svg" }).catch(console.error);

var vg_12 = "vega/idiom12-waffle.vg.json";
vegaEmbed("#waffle-chart", vg_12, { actions: false, renderer: "svg" }).catch(console.error);
