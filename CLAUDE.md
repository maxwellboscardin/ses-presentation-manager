# SES Presentation Manager

## Overview
Browser-rendered HTML/CSS/JS presentations for SES leadership. Replaces PowerPoint/Illustrator workflow with JSON data + HTML output edited via Claude Code.

## Tech Stack
- **No build tools.** Pure HTML/CSS/JS with ES modules.
- **Charts**: Vanilla Canvas API with `devicePixelRatio` scaling for retina.
- **Fonts**: Gilroy `.otf` via `@font-face`.
- **Serving**: Requires a local server (ES modules need HTTP, not `file://`).

## Quick Start
```bash
# From project root:
python3 -m http.server 8080
# Open http://localhost:8080/output/1258-flipbook.html
```

## Project Structure
- `data/contracts/` — JSON data files per contract
- `fonts/` — Gilroy font subset (Regular, Medium, SemiBold, Bold, BoldItalic)
- `assets/` — SES logos, US states SVG
- `src/styles/` — CSS: design-tokens, components, flipbook-layout, print
- `src/components/` — Reusable JS chart/UI components (Canvas-based + SVG)
- `src/templates/` — Template assemblies (e.g., flipbook spread)
- `output/` — Final HTML deliverables (open in browser)

## Design Language

### Cards
White containers with rounded corners (`border-radius: var(--radius)`) and a subtle drop shadow. **All content lives in cards.** Cards come in all widths determined by their parent column layout. No content floats outside of cards except floating labels.

### Labels (Navy Bars)
Two types, both valid, with strict consistency rules:

1. **Floating labels** (`.section-header`): Stand-alone navy bars between groups of cards. Label a SECTION — a group of related cards. Full rounded corners.
2. **Embedded labels** (`.section-header` inside a card): Navy bar at the very top inside a card. Label that specific card. Parent's `overflow: hidden` clips corners to match the card shape.

**Rules:**
- Adjacent/paired cards MUST use the same label treatment. If one has an embedded label, its pair must too.
- Never mix floating and embedded labels for side-by-side cards.
- Every card that needs a title uses an embedded `.section-header`, NOT inline text titles.

### KPI Boxes
Small stat cards with two zones:
- **Top (navy)**: The label — identifies WHAT the metric is (e.g., "Total Annual Premium")
- **Bottom (white)**: The value — the actual content/data (e.g., "$11.3M")

Navy fill = label treatment. White = content. Never invert this.

### Layout Rules
1. **No orphan elements** — Nothing floats outside cards except floating section labels. No standalone buttons, titles, or elements taking their own rows.
2. **Height pairing** — Side-by-side cards in a row MUST share the same height (via flex stretch).
3. **Spread-level margins** — Both pages of a spread use identical padding. Content starts and ends at the same vertical position across pages. The spread is one unified composition.
4. **No dead space** — Charts auto-size to fill their containers tightly. No centered-in-whitespace.
5. **Tight spacing** — Every gap is intentional. Content fills containers.

### Logo & Branding
- **Logo**: Single instance, bottom-right of the right page (`.page-logo`). Not duplicated across pages.
- **Contract badge**: Single instance in page 1 header. Not duplicated.
- **Title**: Bold, not italic. Part of the compact header row, not a standalone row.

### Visual Palette
- **Colors**: Navy `#0A5383`, Orange `#E97121`, Light BG `#D8E6F0`
- **Typography**: Gilroy family, sizes from 10px (small) to 22px (page title)
- **Diagonal stripes**: Subtle white stripes on light blue gradient page background
- **No single-sided accent borders** — use background tint, shadow, or uniform borders

## Workflow
1. Edit data in `data/contracts/*.json`
2. Refresh browser to see updates
3. Print to PDF for final deliverable (Cmd+P → Save as PDF)

## Key Files
- `src/styles/design-tokens.css` — CSS variables (colors, fonts, spacing)
- `src/styles/components.css` — Card, label, KPI, table component styles
- `src/components/` — Chart components: h-bar, v-bar, stacked-bar, line, us-map (SVG), kpi-box
- `src/templates/flipbook/contract-spread.js` — Two-page flipbook assembly
- `output/1258-flipbook.html` — Contract 1258 flipbook deliverable
