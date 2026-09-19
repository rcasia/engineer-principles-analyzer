# Design system

The implementation is plain semantic HTML and CSS custom properties. Token
names describe purpose, not appearance, so light and dark themes preserve the
same hierarchy.

## Color

Light is the default and dark follows `prefers-color-scheme`. Text and controls
meet WCAG 2.2 AA contrast. Never communicate status by color alone.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-bg` | `#f6f6f3` | `#111315` | Page canvas |
| `--color-surface` | `#ffffff` | `#181b1e` | Primary content surface |
| `--color-surface-raised` | `#ffffff` | `#202428` | Menus, dialogs, raised panels |
| `--color-surface-subtle` | `#efefeb` | `#151719` | Grouped or inset regions |
| `--color-text` | `#191b1e` | `#f1f3f5` | Primary text |
| `--color-text-secondary` | `#4d5258` | `#b6bcc3` | Supporting text |
| `--color-text-muted` | `#6b7178` | `#929aa3` | Metadata and placeholders |
| `--color-border` | `#d9dbdc` | `#30353a` | Default separators |
| `--color-border-strong` | `#b8bcc0` | `#4a5158` | Emphasized boundaries |
| `--color-accent` | `#2855c7` | `#8da8ff` | Links, selected state, focus |
| `--color-accent-hover` | `#1d43a5` | `#aec0ff` | Accent hover |
| `--color-accent-soft` | `#e8edfc` | `#202b4b` | Selected backgrounds |
| `--color-success` | `#18794e` | `#65c995` | Successful state |
| `--color-warning` | `#8a5a00` | `#e5b657` | Caution or partial state |
| `--color-error` | `#b42318` | `#ff8a80` | Failure or destructive state |
| `--color-info` | `#1261a0` | `#6cb6ed` | Neutral information |

Status surfaces use a quiet tinted background, a visible icon or label and
plain-language text. The accent is not a status color.

## Typography

No web font is required. This avoids a render delay, external request and
platform mismatch while retaining native clarity.

- `--font-sans`: platform UI stack for prose and controls.
- `--font-mono`: platform monospace stack for code, IDs, values and shortcuts.
- Body: 15px/1.6. Compact UI text: 13px/1.4. Metadata: 12px/1.4.
- Page title: `clamp(30px, 4vw, 44px)`, weight 650, tight tracking.
- Section heading: 20px/1.3, weight 650. Card heading: 15px/1.4, weight 650.
- Use sentence case. Do not use all caps for prose; uppercase is limited to
  short mono eyebrow labels with additional letter spacing.
- Prose measure is 68 characters. Tables and structured work areas may use the
  full content width.

## Spacing and sizing

The 4px base scale is `1, 2, 3, 4, 6, 8, 12, 16` units: 4, 8, 12, 16, 24,
32, 48 and 64px. Use adjacent steps to show grouping; do not use spacing to
compensate for unclear structure.

- Compact control height: 32px. Default: 36px. Comfortable/touch: 44px.
- Icon sizes: 14px compact, 16px default, 20px prominent.
- Minimum pointer target: 24x24px; use 44px where touch is likely.
- Content width: 1180px. Reading width: 720px. Narrow form width: 560px.

## Borders, radii and elevation

- Default border: 1px `--color-border`; strong border uses
  `--color-border-strong`.
- Radius scale: 2px for code and compact controls, 4px default, 6px for raised
  panels. Pill radius is reserved for badges and tags.
- Cards are separated by borders and spacing, not shadows.
- `--shadow-raised` is a subtle menu/tooltip shadow. `--shadow-dialog` is only
  for modal layers. No colored or ambient shadows.

## Icons

Use simple 1.5px stroke icons on a 16 or 20px grid. Prefer familiar symbols
and pair ambiguous icons with text. Icon-only controls require an accessible
name and tooltip; decorative icons are hidden from assistive technology.
Do not mix filled, outlined and emoji icon languages.

## Motion

Motion confirms causality; it does not decorate. Color, border and opacity
transitions use 120ms. Menus and dialogs may use 160ms opacity plus at most
4px translation. Avoid spring effects, parallax and continuous animation.
Under `prefers-reduced-motion: reduce`, transitions and animations are removed.

## Interaction states

Every interactive component defines default, hover, active, focus-visible,
disabled and pending behavior.

- Hover increases contrast without moving geometry.
- Active state uses a darker surface or 1px visual inset.
- Focus uses a 2px accent outline with 2px offset and must not be obscured.
- Disabled controls remain legible, use 55% opacity and never accept events.
- Pending controls keep their width, retain the action label and add progress.
- Selected state uses accent text, a soft accent surface and another cue such
  as a border, check or position indicator.
