# CHANGELOG — Wildlife Rescue & Rehabilitation in NSW (FIT3179 DV2)

Author: Nachanok Kladsamniang. Each entry records what changed, which rubric line or DV1 lesson it addresses,
and (for charts) a short explanation of the idiom choice for the interview.

Backup before Phase 2: git tag `backup-pre-hd-audit` (commit `62e170e`).

---

## Step 1 — Global palette: one colour = one meaning
**Rubric:** Layout, colour, figure-ground (3%). **DV1 lessons:** colour-blind-safe palette (DV1 used red and green
together); consistent colour for visual hierarchy.

**Problem found in the audit:** the same hue meant different things. River Blue was Birds, Released, Survived, the
summary boxes and the map; Golden Ochre was Mammals, Left and observed, and 2018–19; Forest Teal was Reptiles,
Permanent care and 2024–25. Blue vs teal also failed a tritanopia check (ΔE 11.7).

**Change:** one shared palette in `js/chart-defaults.js` (`window.PALETTE`); every chart now reads its colours from it.

| Role (meaning) | Colours | Used in |
|---|---|---|
| Animal group (categorical) | Birds `#23508F` dark blue · Mammals `#E0AE2E` gold · Reptiles `#4CA36B` green | 03, 05, 08, 10 |
| Outcome | Died `#B83F35` red · survival family in purple: Released/Survived `#7A55B3`, Left and observed `#D2C2EC`, Permanent care `#341C57` · Escaped `#8F9592` grey | 05b, 09, 12 |
| Change direction | Rose `#A0286C` raspberry · Same `#D6DAD7` · Fell `#8FA0A9` slate | 07 overview, new proportional-symbol map |
| Magnitude (sequential) | Brand teal ramp `#E6F2EF` → `#0B4A42` | 01 map, 04 heatmap |
| Neutral roles | Ink `#25332F`, greys | 02 and 11 highlight, 06 bump lines, 07 years, Sankey reason nodes |

- Text drawn on coloured fills uses darker or contrasting versions (`groupText`, `groupOn`, outcome labels), so gold
  labels and labels on light lilac stay readable.
- 06 bump chart: reasons are not a colour category anywhere else, so its lines are neutral greys told apart by
  **dash pattern** plus direct labels (no hue needed).
- UI accents (summary boxes, headline tiles, finding icons, link hover, header leaves) no longer reuse category hues:
  brand teal for chrome; red only for the "Died" figure.
- "Rose" uses raspberry rather than the suggested orange: orange was indistinguishable from Mammals gold under
  deuteranopia (ΔE 8–11) and from Died red under tritanopia.

**Colour-blind check** (Machado 2009 simulation, deuteranopia/protanopia/tritanopia, worst pair within each chart):
animal groups 29.1 · outcomes 21.3 · Sankey 69.1 · change 22.4 · dumbbell years 51.3 · highlight 48.4.
The bump greys are intentionally close; their lines are distinguished by dash pattern and labels.
Please also confirm visually in Color Oracle.

---

## Fix — 05 bubble chart: bubble area now truly proportional to estimated deaths
**Rubric:** Idioms & complexity (marks and channels used correctly). **DV1 lesson:** encodings must be honest.

- **Before:** `size` used `scale: { type: "sqrt", range: [30, 1500] }`. In Vega-Lite the `size` channel already sets the
  mark's **area** (px²), so a square-root scale made area ∝ √deaths: large values were under-represented, while the
  legend said "bubble area". The range also started at 30 px², so even zero deaths had an area.
- **After:** `scale: { type: "linear", zero: true, range: [0, 1600] }`, so area ∝ estimated deaths (0 deaths = 0 area;
  the 10,000 legend circle is 100× the area of the 100 circle).
- With true proportional area, 12 of 57 bubbles fall below a 1 px radius, so a small fixed-size dot in the group
  colour marks every bubble's position. The note says the dot only marks position.
- Estimated deaths are labelled **author-calculated** in the note.

**Idiom (for the interview):** bubble chart (a scatterplot plus a size channel). x = total rescues on a log scale
(position; counts span 2 to ~25,000), y = died % (position), area = estimated deaths (size, linear in area), hue =
animal group. It answers "which reasons are both common and deadly?" with three quantitative variables at once.

---

## Fix: every chart is now built in Vega-Lite (08 treemap, 09 Sankey, 12 waffle, 07 overview bar)
**Rubric:** Idioms & complexity, and the DV2 brief's requirement that the visualisation is built with Vega-Lite.
**Problem:** 08, 09 and 12 were drawn with hand-written SVG/HTML, and the small "rose / same / fell" bar beside 07 was
coloured HTML spans. Data, colours, annotations and text are unchanged; only the rendering moved to Vega-Lite.

| Chart | Before | After (Vega-Lite) |
|---|---|---|
| 08 treemap | SVG `<rect>`/`<text>` built in JS, custom tooltip | Layout (squarified) is a data-prep step; `rect` marks with `x`/`x2`/`y`/`y2`, `text` marks for labels, `circle` + `text` for rank badges 1–3; Vega-Lite tooltip; hover `param` outlines the tile |
| 09 Sankey | SVG `<path>` Bézier bands, custom hover and dropdown | Each band is sampled into 41 points along the same S-curve and drawn as an `area` mark (`y` = upper edge, `y2` = lower edge, `detail` = flow); nodes are `rect` marks; group dropdown is a `param` bound to a select and every layer is filtered by it; hovering a flow or node highlights the connected flows (point selections + `fillOpacity` conditions) |
| 12 waffle | HTML `<span>` grid | One record per square; Vega-Lite `window` (`row_number`) numbers the squares and `calculate` gives `col = (k−1) % 10` and `row = floor((k−1)/10)`; `rect` marks on ordinal x/y; four views in `hconcat`; legend is a Vega-Lite legend with counts and shares; hovering a square highlights that outcome in all four waffles (one `param` shared across views) |
| 07 overview bar | HTML spans with % widths | Normalised stacked `bar` (`stack: "normalize"`) with tooltips |

- Narrow screens: the waffle stacks the groups under "All groups" with a one-column legend; the Sankey widens its label
  column and drops the counts from labels (they stay in the tooltips).
- Labels added to the notes: Sankey flows and waffle rounding are **author-calculated**; treemap shares use an
  author-calculated denominator.
- Removed the now-unused CSS (`.tm-tooltip`, `.tm-leaf`, `.wf-*`, `.dot-ov-bar span`).
- Only the header leaf animation and the headline number tiles remain plain HTML/JS: they are page decoration and
  text, not charts.

**Idioms (for the interview):**
- **Treemap:** containment shows the group → sub-group hierarchy; area ∝ rescues. Vega-Lite has no treemap transform,
  so the squarified layout is computed as data preparation and Vega-Lite draws it.
- **Sankey:** band width ∝ estimated cases from reason to outcome. The layout and curves are computed as data, and
  Vega-Lite draws them as area marks.
- **Waffle:** 100 countable squares give a part-to-whole reading that is more precise than pie angles. Vega-Lite's own
  window and calculate transforms lay out the grid.
- **01 map key:** the colour key was HTML swatches. It is now a small Vega-Lite chart (`square` + `text` marks, laid out
  in a grid with `calculate`: 8 columns on desktop, 4 or 2 on narrow screens). Vega-Lite's built-in legend is not used
  because it draws a threshold scale as a squashed gradient. Classes, colours and labels are unchanged.
- Known issue, not caused by this change: on phone width the 01 map is wider than its card. It will be fixed in
  Step 2, when the map is rebuilt.
- **03 spring-share bars** (text column beside 03): these were HTML bars. They are now a Vega-Lite layered bar chart:
  a grey track, a bar per animal group (group colours), a `rule` at 25% (an even spread across the year) and value
  labels, with tooltips. Values are unchanged (author-calculated share of each group's year falling in Sep–Nov).

---

## New charts 13 and 14: two maps written as pure Vega-Lite JSON specs
**Rubric:** Idioms & complexity (more distinct map idioms; the audit found only one). **Plan item:** Phase 2 B and C.
Both charts are complete Vega-Lite specifications in `specs/`. Vega-Lite loads the CSV and GeoJSON itself and does all
reshaping (filter, pivot, lookup, calculate, window). The page only calls `vegaEmbed(element, "specs/….vl.json")`.
No chart code is in JavaScript.

### 13 Proportional symbol map: "Where are the most rescues, and where are they rising?"
`specs/idiom13-symbols.vl.json`. Data: NSW DCCEEW dashboard counts by LGA, 2018–19 and 2024–25.
- Vega-Lite `pivot` puts both years on one row, `calculate` gives change and direction, and `lookup` joins each LGA to
  its label point (`lx`, `ly`) in the boundary file.
- Circle **area** ∝ 2024–25 rescues (`size` linear, `zero: true`, shared across both views), with a size legend.
  Colour = change direction (raspberry rose / grey same / slate fell: never red vs green). Fill opacity 0.62 with a
  thin white stroke, and `order` draws big circles first so small ones stay on top.
- NSW map plus a Sydney and Central Coast close-up (same circle scale); top five labelled.
- Interaction: click a colour in the key (`bind: "legend"`) to keep only areas that rose, stayed the same or fell;
  tooltips give both years, change and change % (author-calculated).
- Lord Howe Island (0 rescues) and 64 rescues with no LGA are not mapped; the note says so.

**Idiom (for the interview):** a proportional symbol map uses a position on the map and the area of a circle for
magnitude. Unlike the choropleth, small, busy councils are not hidden by their small area. A second channel (hue)
answers the trend question.

### 14 Dot density map: "How concentrated are rescues?"
`specs/idiom14-dots.vl.json`. Data: 2024–25 counts; dots from `data/rescue_dots_2024_25.csv`.
- Dots are generated **once, offline** by `tools/make-dots.mjs` with a fixed seed (20251102): one dot per 25 rescues,
  placed at random inside each LGA polygon (holes excluded). Running it twice gives a byte-identical file. 4,782 dots
  represent 119,582 rescues (rounding per LGA, author-calculated). Nothing is randomised at render time.
- 1 dot = 25 avoids a single solid Sydney blob on the close-up; the main map's dashed box points to the Sydney and
  Central Coast close-up, where the dots are drawn smaller and lighter.
- Hovering an area outlines it and shows its count and number of dots.
- Caption: "1 dot = 25 rescues. Dots are placed randomly within each council area and do not show exact rescue
  locations."
- Sydney Harbour (unincorporated) has no row in the counts file, so it has no dots (reported by the script).

**Idiom (for the interview):** dot density shows concentration. Dense clusters read instantly as "lots here" without
classing the data, but the positions inside an area are random, so it must not be read as exact locations.

- Both maps are fixed-size (a JSON spec cannot measure the page), so on narrow screens they scroll sideways inside the
  card (`.vl-scroll`) instead of overflowing the page.
- Numbering 13 and 14 is temporary; Step 3 regroups and renumbers the sections.

---

## Every chart is now a pure Vega-Lite JSON specification (no chart JavaScript)
**Why:** the brief asks for Vega-Lite. Before, 01–12 were Vega-Lite specs built at runtime by JavaScript files, which
also did the data preparation and wrote the text. Now every chart is a standalone `.vl.json` file in `specs/`.

**What changed**
- `js/` is deleted (all 15 chart scripts, `chart-defaults.js`, `headline-stats.js`, `header-wildlife.js`).
- 17 specs in `specs/`: 01 choropleth (map, close-up, linked top-5 bars, colour key), 02, 03, 03 spring bars, 04, 05,
  05b, 06, 07 dumbbell, 07 overview bar, 08, 09, 10, 11, 12, 13, 14. Each spec loads its CSV/GeoJSON by URL and does all
  reshaping itself: `filter`, `aggregate`, `joinaggregate`, `window` (rank, row_number, dense_rank, cumulative sum),
  `pivot`, `fold`, `lookup`, `flatten`, `calculate`. Dropdowns are params bound to selects; hover/click/legend
  highlighting uses selection params.
- The page loads each spec with one loop: `vegaEmbed(el, el.dataset.vl)` for every `<div data-vl="specs/…">`. That
  loop is the only script on the page, because vega-embed itself is a JavaScript library.
- Things Vega-Lite cannot compute are generated once, offline, into data files (same approach as the dot density map):
  - `tools/make-treemap.mjs` → `data/treemap_layout.csv` (squarified rectangle corners and fitted labels)
  - `tools/make-sankey.mjs` → `data/sankey_layout.json` (node positions, band curves sampled to points, estimated flows)
  - `tools/make-dots.mjs` → `data/rescue_dots_2024_25.csv` (unchanged)
- The waffle's largest-remainder rounding now runs inside Vega-Lite (`joinaggregate` + `window` rank of remainders),
  and `sequence()` + `flatten` expand each category into one row per square.
- Summaries, key findings and notes that the scripts used to compute are now static text in `index.html`, copied
  exactly from what the scripts produced (no number changed). Where a dropdown exists, the static text names the view
  it describes (for example "In 2024–25", "All classes", "All years (average)"); the in-chart annotations (peak
  labels, top-five labels, rank badges, largest-rise label, reference line) are still computed by Vega-Lite and update
  with the selection.
- `data/rescue_outcomes_by_group.csv`: its first line was a `#` comment, which Vega's CSV loader cannot skip. The
  comment moved to `data/rescue_outcomes_by_group.SOURCE.txt`; the data rows are unchanged.
- Fixed-size specs (maps, treemap, Sankey, waffle) shrink to fit narrow screens through the SVG viewBox
  (`[data-vl] svg { max-width: 100%; height: auto }`) instead of overflowing; tooltips keep exact values.
- Removed with the scripts: the animated leaf canvas in the header and the count-up animation on the headline numbers
  (the numbers themselves are static HTML and unchanged).
- Corrected an out-of-date note on 11 ("terracotta = the lowest 3" → "dark dots = the lowest 3").
- 07 dumbbell axis title now says "axis starts at 1,000" (Step 2 item).

**Checked:** all 17 specs render with no errors; hover, click, legend and dropdown interactions tested with simulated
events (Sankey flow/node highlight and group switch, waffle linked highlight, map year switch, heatmap group switch);
screenshots compared with the previous version at desktop and phone widths.

---

## Removed: 13 proportional symbol map and 14 dot density map
Removed at the author's request: their articles in `index.html`, `specs/idiom13-symbols.vl.json`,
`specs/idiom14-dots.vl.json`, and the files only they used (`tools/make-dots.mjs`, `data/rescue_dots_2024_25.csv`).
The page now has 15 Vega-Lite specs. Both maps remain in git history (commit `4b98aae`) if needed again.

---

## Restored: header background animation and headline count-up
At the author's request, `js/header-wildlife.js` (drifting eucalyptus leaves and birds that react to the pointer and
clicks; one still frame under reduced motion) and `js/headline-stats.js` (headline figures count up when the header comes
into view and replay on hover or focus) are back, restored unchanged from before commit `7e50a4b`, with their canvas and
CSS. They are page decoration, not charts: every chart is still a pure Vega-Lite spec in `specs/`.

---

## Embedding follows the Week 7 studio approach
- Specs moved from `specs/` to `vega/` (by the author) and renamed from `.vl.json` to `.vg.json`, the naming used in the
  Week 7 studio. Contents unchanged.
- `js/vega_lite_vis.js` embeds each chart the way the studio shows: `var vg_1 = "vega/….vg.json";` then
  `vegaEmbed("#div-id", vg_1, …).catch(console.error);` for each of the 15 specs. Each chart has its own `<div id="…">` in
  `index.html` (the `data-vl` attributes and the inline loop are gone).
- `renderer: "svg"` is set so charts can scale down on narrow screens.

---

## Treemap and Sankey laid out entirely in Vega-Lite (no offline scripts)
- **08 treemap** is now a two-level **slice-and-dice** treemap (Shneiderman 1992) computed in the spec: each animal group
  is a column whose width is its share of rescues (`joinaggregate` totals → `calculate` x0/x1); inside each column the
  `stack` transform with `offset: "normalize"` splits the height among sub-groups, largest first. Area is still
  proportional to rescues. Labels appear only where the tile is tall enough and are clipped to the tile width
  (`limit` as an expression); rank badges 1–3 come from a `window` row_number. Replaces the squarified layout, which
  Vega-Lite cannot compute.
- **09 Sankey** is computed in the spec: `window` rank keeps the top 8 reasons; running sums place the left nodes;
  `fold` turns each reason into a Survived flow and a Died flow; a running sum per outcome stacks the band ends on the
  right; `sequence` + `flatten` sample 41 points per band and `calculate` applies the cubic Bézier S-curve; bands are
  `area` marks (`y` = top edge, `y2` = bottom edge). Estimated flows (author-calculated) as before. Output identical to
  the previous version (Birds ≈40,442 Survived, ≈41,343 Died).
- Hover: node selections use their own fields (`lnode`, `rnode`) so hovering a flow highlights only that flow.
- Removed `tools/make-treemap.mjs`, `tools/make-sankey.mjs`, `data/treemap_layout.csv`, `data/sankey_layout.json`. No
  offline layout step remains: every chart is computed by Vega-Lite from the source CSV files.

- Audit: all 15 chart specs are Vega-Lite v5 and compile; removed two redundant `legend: null` settings (03, 05) that caused
  "conflicting legend" warnings. Remaining "Dropping fit-y" notes (02, 03 spring, 04, 11) are informational: those charts
  use a step height on purpose.

## Audit fix: three map idioms (01 choropleth, 01b proportional symbol map, 07b Dorling cartogram)
**Requirement:** at least three different map idioms. Before this change the site had one (01).
- **01b Proportional symbol map** (`vega/idiom01b-symbols.vg.json`, Vega-Lite). Brought back from the deleted idiom 13
  with one fix: the "Same" and "Fell" colours were almost identical greys (#9DAAA4 vs #8FA0A9); "Fell" is now dark
  slate #5F6F78 and "Same" light grey #C9D0CC, matching the 07 overview key. Circle area = 2024–25 rescues, hue =
  rose/same/fell since 2018–19 (author-calculated). Legend click filters by direction. Placed after 01 in "Where".
- **07b Dorling cartogram** (`vega/idiom07b-dorling.vg.json`, **Vega**, not Vega-Lite). One circle per council, area ∝
  rescues on one fixed scale for every year (0–7,200 → 0–2,830 px²), colour uses the same seven classes as 01. A Vega
  `force` transform (collide + x/y pull to each council's label point, static, 300 iterations) pushes circles apart.
  Vega-Lite has no force layout, so this one spec is Vega; it is embedded the same way (vegaEmbed reads `$schema`).
  Year select (12 years), hover outline, tooltip, top-five labels. No offline layout step and no new data.
- Summary figures checked against `data/rescue_counts_by_lga.csv` with a script: 130 mapped councils, 107 rose / 1
  same / 22 fell; mapped total 82,922 → 119,582 (+44.2%). Land shares (top five ≈ 1.06% of NSW land, Northern Beaches
  0.03%) are author-calculated from `data/nsw_lga.geojson` (total 802,170 km², close to the official ~801,150 km²).
- 01 note now says the colour is raw counts (not per person or per km²) and points to 01b and 07b.

**Idioms (for the interview):** a proportional symbol map keeps geography and shows magnitude by circle area, so
small, busy councils are not hidden as they are on a choropleth. A Dorling cartogram gives up exact position to
remove overlap: each council becomes a circle sized by its value, so the comparison is size against size.

## Audit fixes: dead control, metadata, section title, readable JSON
- **02 ranked bar:** removed the "Financial year" select. `data/rescue_reasons_by_year.csv` holds only 2022–23, so
  the select had one option and did nothing (an interaction that cannot change the view). The filter now names
  2022–23 directly, and the empty `#reasons-controls` div is gone.
- **Metadata:** byline and footer author are now "Nachanok Kladsamniang"; updated date 2 November 2026.
  Footer credits say which charts are Vega-Lite and which one is Vega, and link to the `vega/` folder on GitHub
  (requirement: every spec is in the repository). Source list "Used in" lines now include 01b and 07b.
- **Section 3 title:** "When do rescues happen, and how do outcomes differ?" did not match its charts (regions,
  sub-groups, outcomes; nothing about timing). It is now "Which regions and animals, and what happens next?",
  and the story outline matches. The section order (from the sketch) is unchanged.
- **All 17 specs reformatted** with one style: 2-space indent, short objects and arrays on one line, longer ones
  broken over lines. A script checked each file parses to exactly the same JSON before and after, and every chart
  rendered with the same number of SVG items as before. Long lines that remain are single expressions or descriptions.

## Renumbered all idioms 01–14 in page order (user request)
01b became 02, and every later chart moved up so the numbers run 01 to 14 down the page with no "b" numbers.

| Old | New | Chart | Spec file |
|---|---|---|---|
| 01 | 01 | Choropleth | `idiom01-choropleth.vg.json` |
| 01b | 02 | Proportional symbol map | `idiom02-symbols.vg.json` |
| 02 | 03 | Ranked bar (reasons) | `idiom03-reasons.vg.json` |
| 03 | 04 | Multi-series line + spring bars | `idiom04-seasonality.vg.json`, `idiom04-spring.vg.json` |
| 04 | 05 | Heatmap | `idiom05-heatmap.vg.json` |
| 05 | 06 | Bubble + group summary | `idiom06-bubble.vg.json`, `idiom06b-group-summary.vg.json` |
| 06 | 07 | Bump chart | `idiom07-bump.vg.json` |
| 07 | 08 | Dumbbell + overview bar | `idiom08-dumbbell.vg.json`, `idiom08-overview.vg.json` |
| 07b | 09 | Dorling cartogram (Vega) | `idiom09-dorling.vg.json` |
| 08 | 10 | Treemap | `idiom10-treemap.vg.json` |
| 09 | 11 | Sankey | `idiom11-sankey.vg.json` |
| 10 | 12 | Small multiples | `idiom12-small-multiples.vg.json` |
| 11 | 13 | Lollipop | `idiom13-lollipop.vg.json` |
| 12 | 14 | Waffle | `idiom14-waffle.vg.json` |

Updated together: visible numbers, `idiom-NN-title` anchors, headline and key-finding links ("See Idiom …"),
chart container ids (`vis-NN-…`), source "Used in" lists, the 01 note, footer credits, spec file names, spec
descriptions and `js/vega_lite_vis.js`. Earlier entries in this changelog keep the old numbers. All 17 charts
were re-rendered after the change. The "b" files (04-spring, 06b, 08-overview) are companion views of their chart.

## AI acknowledgement in the footer
Added an "AI acknowledgement" heading and paragraph at the bottom of the footer, after the credits, using the
user's own wording. It uses the existing `sources-sub` heading and `footer-credits` text styles, so no new CSS.

## Removed the end-of-page Key findings section; cleaner footer
- **Key findings removed** (user request): the four finding cards, the "★ Key findings" link in the story
  outline, and their CSS (`.findings-*`, `.finding-*`). The findings boxes inside charts 05, 06 and 10 stay.
- **Footer rebuilt** in three blocks: "About this visualisation" (title, author, unit, date and data period in one
  white card), the numbered "Data sources" list (unchanged content), then "Credits" and "AI acknowledgement" as
  two matching cards side by side (stacked under 760 px). The data-period text is shortened to
  "2013–14 to 2024–25 (stated on each chart)" so it fits on one line. Checked at 1280 px and 390 px.

## Copy edit: professional, story-led wording across the page
Rewrote all reader-facing text in `index.html` (subtitle, intro, headline labels, story outline, section titles and
subtitles, chart titles, lead paragraphs, notes, hints, summaries and source notes). **No figures changed**: every
number is the same as before; the one new comparison ("2.4 times the next reason, unsuitable environment (6,530)")
comes from `data/rescue_reasons_by_year.csv` and matches the earlier key finding.
- **Story thread:** the intro states the scope (recorded rescues, not populations); lead paragraphs now link the
  charts ("Knowing where rescues happen leads to the next question: why", "From places to animals", "The story ends
  where every rescue ends: with an outcome").
- **Titles match content:** Section 1 "Where and when are animals rescued?"; Section 4 "How do animal groups
  differ?"; 08 says "council areas" (the data unit) instead of "regions"; 10 and 13 say "animals" instead of
  "animal sub-groups" in the title.
- **Plain English:** replaced shorthand such as "×", "=", "Transformation for this chart", "LGA" and "See Idiom"
  with full sentences, "Method:", "council area" and "See chart". Claims kept within what the data shows
  (e.g. "associations, not evidence of cause"; low counts are not rarity).
