# Layout

## Page anatomy

Pages use a stable top bar, one main landmark and an optional contextual rail.
Inside main, the order is: breadcrumb when needed, title and description,
primary actions, local navigation, then content. The primary action aligns with
the title on wide screens and follows the description on narrow screens.

Use three content modes:

- **Reading**: 720px maximum for guidance, explanations and forms.
- **Standard**: 1180px maximum for most product pages.
- **Wide**: viewport width with 24-32px gutters for tables, diffs and analysis.

## Grid and alignment

The standard page uses a 12-column grid with 24px gaps. A contextual rail uses
3 columns and main content 9; supporting content may use 4 plus 8. Prefer a
single column when no information relationship justifies a split.

Align headings, controls and data to a small number of persistent vertical
lines. Text aligns by its glyph edge; bordered containers align by border.
Avoid centering operational content. Centering is limited to compact empty or
loading states within a bounded region.

## Vertical rhythm and density

- Page regions: 48-64px apart.
- Section heading to content: 16-24px.
- Related controls: 8-12px.
- Compact rows: 36px minimum; default rows: 44px.
- Dividers separate peers; additional whitespace separates concepts.

Default to compact density for tables, logs and configuration. Offer a density
preference only when one view genuinely serves both scanning and touch-heavy
work; do not make users configure basic legibility.

## Responsive behavior

Breakpoints describe layout pressure rather than devices:

- Below 720px: one column; 16px page gutters; actions wrap; contextual rail
  becomes an in-flow section or disclosure; navigation can scroll horizontally.
- 720-1023px: 24px gutters; two-column layouts collapse when either column
  would fall below its readable minimum.
- 1024px and above: full standard grid; 32px gutters.

Content determines height. Never truncate primary titles or error messages.
Identifiers may truncate only when their full value is available on focus and
copy. Tables scroll horizontally inside a labelled region. Controls wrap in
reading order instead of shrinking below their minimum target.

At 200% zoom, the layout must reflow without loss of content or two-dimensional
page scrolling, except for intrinsically two-dimensional content such as code,
tables and diffs.
