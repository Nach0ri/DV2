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
