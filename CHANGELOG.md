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
