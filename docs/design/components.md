# Components

Components are visual and behavioral contracts. Prefer native elements and
keep variants few; one-off styling weakens recognition.

## Actions and navigation

### Buttons

- **Primary**: one per decision area, solid accent, for the intended next step.
- **Secondary**: bordered surface for ordinary actions.
- **Quiet**: no container until hover, for low-emphasis local actions.
- **Danger**: error color and explicit verb; never use it as a generic accent.
- Labels start with a verb. Keep the label during loading and place progress
  beside it. Buttons do not navigate; links do not submit actions.

### Links

Inline links are underlined with a visible offset. Navigation links may omit
the underline when location and hover treatment make their role unambiguous.
External destinations are identified in text or with a labelled icon.

### Navigation and tabs

Global navigation is stable and shallow. Mark the current page with
`aria-current="page"`. Tabs switch peer views within one context; use a bottom
rule or side indicator and preserve the tab name at narrow widths. Do not use
tabs as a multi-step workflow.

## Input

### Fields, selects and search

Labels are always visible above controls. Placeholder text is an example, not
a label. Help appears before interaction; validation appears below the field,
is associated with `aria-describedby`, and explains recovery. Use native
selects until custom behavior has demonstrated value.

Search uses a `search` landmark, a descriptive label and a clear action when
text is present. Results state what scope was searched. Keyboard shortcuts may
focus search but are documented near the control.

Multi-line source or free text uses a monospace textarea (`.textarea`), sized
for its content (source code gets a tall default, not a two-line box) and
resizable vertically only. It follows the same label, help and
`aria-invalid` conventions as single-line fields.

### Forms

Group related fields with `fieldset` and `legend`. Align labels and controls in
one column by default; use columns only for tightly coupled short values. Put
the primary action first in reading order. On failure, preserve input, show an
error summary and focus the first invalid field.

## Structured content

### Cards and lists

Use a card only when content forms a movable or independently actionable unit.
Otherwise use a heading and divider. Cards have one clear heading and may have
one primary destination; avoid nested cards. Lists are the default for repeated
content and retain semantic `ul`, `ol` or `dl` structure.

### Tables

Tables are for comparison across consistent columns. Headers are concise and
sticky only when rows exceed the viewport. Numeric columns align right and use
tabular numerals. On narrow screens, keep the table and allow labelled
horizontal scrolling; do not silently hide columns. Put secondary row actions
at the end and reveal them on focus as well as hover.

### Analysis findings

A finding is a `panel` inside an ordered list (`.findings-list`): order is a
fact (rules ran in request order), so it is a list, not an unordered card
grid. Each finding leads with its status badge, method and confidence as
`status-row` badges, followed by the rule id, its explanation, then evidence
(location and a minimal excerpt) when the rule provided any. Suggested fixes
and limitations are plain text below evidence, never hidden behind a toggle.
A run with no findings is an empty state, not a blank list — it says what
that means (e.g. no rules were available yet) rather than nothing at all.

### Badges

Badges carry short categorical or status text, never actions. Status badges
combine a symbol or word with color. Use mono text for machine states such as
`queued` or `exit 1`, sans text for human categories.

### Code blocks

Code is left aligned, scrollable and never wraps by default. Include a language
label when useful. Copy is a labelled button and reports success without
replacing the code. Inline code uses a subtle surface and border, not a bright
syntax color. Syntax highlighting remains restrained and contrast-safe.

## Overlays and feedback

### Tooltips and dropdowns

Tooltips explain unfamiliar controls; they never contain required information
or actions. They appear on hover and focus. Dropdown menus contain a short set
of contextual actions, support arrow keys and Escape, and return focus to the
trigger. Separate destructive actions with a divider.

### Dialogs and command palettes

Use dialogs only when leaving the current context would be harmful. Name the
dialog, trap focus, close on Escape when safe and return focus to the trigger.
Default focus goes to the least destructive reasonable action.

The command palette is search-first and grouped by intent. It displays the
result's destination and shortcut, supports arrows and Enter, and has useful
zero-results guidance. It supplements visible navigation rather than hiding it.

### Toasts

Toasts confirm background or non-blocking outcomes. They use a polite live
region, concise copy and no timeout for errors requiring action. Do not use a
toast for validation or information needed to continue.

## System states

- **Empty**: name what is absent, why that matters and the single best next
  action. Do not celebrate emptiness with decoration.
- **Loading**: reserve final geometry. Use text or a small progress indicator
  when duration is unknown; use skeletons only for predictable repeated rows.
- **Error**: state what failed, what remains safe and how to recover. Preserve
  user work and include a technical reference when support may need it.
- **Success**: confirm the completed object or action. Avoid blocking dialogs
  for routine success.
