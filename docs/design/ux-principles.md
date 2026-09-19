# UX principles

## Organize around user questions

Lead with what the user is trying to determine: what was analyzed, what the
system found, why it reached that result and what can happen next. Put the most
decision-relevant information first. Use progressive disclosure for evidence,
configuration and raw output; never hide information required to trust a result.

## Make location and consequence clear

Navigation labels use stable domain language. A page title names the current
object or task; breadcrumbs describe hierarchy, not browsing history. Action
labels state the result (`Run analysis`, `Remove principle`) rather than the
mechanism (`Submit`, `OK`). Place actions beside the object they affect.

Before an action, communicate unusual scope or irreversible consequence. After
it, confirm the affected object and resulting state near the action. Optimistic
feedback is appropriate only when failure is reversible and clearly reported.

## Handle waiting honestly

Show loading feedback after roughly 150ms to avoid flicker. Preserve known
content during refresh and mark it as updating. For multi-stage work, name the
current stage when the system knows it. Never show fake percentage progress.
Users can leave long-running work without losing it when technically possible.

## Design recovery, not blame

Errors use this order: what failed, likely impact, recovery action, technical
detail. Keep valid input and completed work. Prefer inline field errors for
local problems and a page-level summary for submission failures. Retry only
idempotent actions automatically, with a visible final failure.

Empty states distinguish first use, filtered zero results, unavailable data and
permission limits. Each requires different explanation and recovery.

## Confirmation and destructive actions

Do not confirm routine reversible actions. Prefer undo when the effect can be
reliably reversed. Confirm destructive or high-cost actions at the moment of
commit, name the affected object and use explicit verbs. Typed confirmation is
reserved for broad, irreversible loss; it is not a default safety pattern.

## Keyboard interaction

Tab order follows the document. Enter activates links and buttons; Space
activates buttons and toggles; Escape closes transient layers. Arrow-key
behavior follows WAI-ARIA patterns for composite widgets. Shortcuts are visible
near their action, remappable when global, and never conflict with text entry.

On navigation, focus moves to the new page title or main landmark. On validation
failure, focus moves to the error summary or first invalid field. On closing an
overlay, focus returns to the opener.

## Accessibility baseline

Target WCAG 2.2 AA. Use native semantics before ARIA, one `h1`, logical heading
levels, labelled landmarks, programmatic field labels and text alternatives.
Text contrast is at least 4.5:1 and non-text UI contrast 3:1. Do not rely on
color, position, sound or motion alone. Support keyboard-only use, reduced
motion, forced colors, 200% zoom and screen-reader announcements for dynamic
state.

Accessibility is checked in HTML tests and manually in the rendered interface.
For every new flow, test keyboard order, visible focus, zoom/reflow, light and
dark themes, reduced motion, long content and all system states.
