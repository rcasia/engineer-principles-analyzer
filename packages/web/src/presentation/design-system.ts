export const DESIGN_SYSTEM_CSS = `
:root {
  color-scheme: light dark;
  --color-bg: #f6f6f3;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-surface-subtle: #efefeb;
  --color-text: #191b1e;
  --color-text-secondary: #4d5258;
  --color-text-muted: #6b7178;
  --color-border: #d9dbdc;
  --color-border-strong: #b8bcc0;
  --color-accent: #2855c7;
  --color-accent-hover: #1d43a5;
  --color-accent-soft: #e8edfc;
  --color-success: #18794e;
  --color-success-soft: #e7f4ed;
  --color-warning: #8a5a00;
  --color-warning-soft: #fbf1d8;
  --color-error: #b42318;
  --color-error-soft: #fbe9e7;
  --color-info: #1261a0;
  --color-info-soft: #e5f1f8;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "Cascadia Code", "Roboto Mono", monospace;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --radius-1: 2px;
  --radius-2: 4px;
  --radius-3: 6px;
  --shadow-raised: 0 8px 24px rgb(20 23 26 / 9%), 0 1px 2px rgb(20 23 26 / 8%);
  --shadow-dialog: 0 24px 64px rgb(20 23 26 / 18%), 0 2px 8px rgb(20 23 26 / 10%);
  --content-width: 73.75rem;
  --reading-width: 45rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111315;
    --color-surface: #181b1e;
    --color-surface-raised: #202428;
    --color-surface-subtle: #151719;
    --color-text: #f1f3f5;
    --color-text-secondary: #b6bcc3;
    --color-text-muted: #929aa3;
    --color-border: #30353a;
    --color-border-strong: #4a5158;
    --color-accent: #8da8ff;
    --color-accent-hover: #aec0ff;
    --color-accent-soft: #202b4b;
    --color-success: #65c995;
    --color-success-soft: #173629;
    --color-warning: #e5b657;
    --color-warning-soft: #392d15;
    --color-error: #ff8a80;
    --color-error-soft: #40211f;
    --color-info: #6cb6ed;
    --color-info-soft: #172f40;
    --shadow-raised: 0 8px 24px rgb(0 0 0 / 28%), 0 1px 2px rgb(0 0 0 / 40%);
    --shadow-dialog: 0 24px 64px rgb(0 0 0 / 48%), 0 2px 8px rgb(0 0 0 / 40%);
  }
}

*, *::before, *::after { box-sizing: border-box; }
html { background: var(--color-bg); }
body {
  margin: 0;
  min-width: 20rem;
  color: var(--color-text);
  background: var(--color-bg);
  font: 0.9375rem/1.6 var(--font-sans);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
button, input, select, textarea { color: inherit; font: inherit; }
button, select { cursor: pointer; }
button:disabled, input:disabled, select:disabled { cursor: not-allowed; opacity: 0.55; }
a { color: var(--color-accent); text-decoration-thickness: 1px; text-underline-offset: 0.2em; }
a:hover { color: var(--color-accent-hover); }
code, kbd, pre, samp { font-family: var(--font-mono); }
code:not(pre code) {
  padding: 0.08em 0.3em;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  background: var(--color-surface-subtle);
  font-size: 0.875em;
}
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
:target, :focus { scroll-margin-block: 5rem 2rem; }
::selection { color: var(--color-text); background: var(--color-accent-soft); }

.skip-link {
  position: fixed;
  z-index: 100;
  inset: var(--space-3) auto auto var(--space-3);
  translate: 0 -200%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-2);
  color: var(--color-text);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-raised);
}
.skip-link:focus { translate: 0; }

.topbar {
  position: sticky;
  z-index: 20;
  top: 0;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg) 92%, transparent);
  backdrop-filter: blur(12px);
}
.topbar__inner {
  display: flex;
  min-height: 3.5rem;
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 0 var(--space-8);
  align-items: center;
  gap: var(--space-8);
}
.brand {
  display: inline-flex;
  color: var(--color-text);
  font-weight: 650;
  letter-spacing: -0.01em;
  text-decoration: none;
  align-items: center;
  gap: var(--space-3);
}
.brand__mark {
  display: grid;
  width: 1.625rem;
  height: 1.625rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-1);
  font: 600 0.6875rem/1 var(--font-mono);
  place-items: center;
}
.topnav { display: flex; align-self: stretch; gap: var(--space-6); }
.topnav a {
  display: inline-flex;
  position: relative;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  text-decoration: none;
  align-items: center;
}
.topnav a:hover { color: var(--color-text); }
.topnav a[aria-current="page"] { color: var(--color-text); font-weight: 600; }
.topnav a[aria-current="page"]::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--color-accent);
  content: "";
}
.topbar__meta {
  display: flex;
  margin-left: auto;
  color: var(--color-text-muted);
  font: 0.75rem/1 var(--font-mono);
  align-items: center;
  gap: var(--space-2);
}
kbd {
  min-width: 1.5rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--color-border-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-1);
  color: var(--color-text-secondary);
  background: var(--color-surface);
  font-size: 0.6875rem;
  line-height: 1;
  text-align: center;
}

.playground, .page {
  width: min(100% - 4rem, var(--content-width));
  margin: 0 auto;
  padding-block: var(--space-16);
}
.page { max-width: var(--reading-width); }
.intro {
  display: grid;
  padding-bottom: var(--space-12);
  border-bottom: 1px solid var(--color-border);
  grid-template-columns: minmax(0, 8fr) minmax(14rem, 4fr);
  gap: var(--space-8);
  align-items: end;
}
.eyebrow {
  margin: 0 0 var(--space-3);
  color: var(--color-accent);
  font: 600 0.6875rem/1.4 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1, h2, h3, p { margin-top: 0; }
h1 {
  max-width: 18ch;
  margin-bottom: var(--space-4);
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 650;
  line-height: 1.08;
  letter-spacing: -0.045em;
}
.lede {
  max-width: 62ch;
  margin-bottom: 0;
  color: var(--color-text-secondary);
  font-size: 1.0625rem;
  line-height: 1.65;
}
.intro__facts { margin: 0; }
.intro__facts div {
  display: grid;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  grid-template-columns: 6rem 1fr;
  gap: var(--space-3);
}
.intro__facts dt { color: var(--color-text-muted); font-size: 0.75rem; }
.intro__facts dd { margin: 0; font: 0.75rem/1.5 var(--font-mono); }
.hero__actions { margin-top: var(--space-8); }
.panel__list { display: grid; margin: 0 0 var(--space-4); padding-left: 1.25rem; color: var(--color-text-secondary); gap: var(--space-2); }
.section { padding-block: var(--space-12); border-bottom: 1px solid var(--color-border); }
.section:last-child { border-bottom: 0; }
.section__header {
  display: grid;
  margin-bottom: var(--space-8);
  grid-template-columns: 3fr 9fr;
  gap: var(--space-6);
}
.section__index { color: var(--color-text-muted); font: 0.75rem/1.4 var(--font-mono); }
.section h2 { margin-bottom: var(--space-2); font-size: 1.25rem; line-height: 1.3; letter-spacing: -0.015em; }
.section__description { max-width: 64ch; margin-bottom: 0; color: var(--color-text-secondary); }
.demo-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--space-6); }
.span-4 { grid-column: span 4; }
.span-5 { grid-column: span 5; }
.span-6 { grid-column: span 6; }
.span-7 { grid-column: span 7; }
.span-8 { grid-column: span 8; }
.span-12 { grid-column: 1 / -1; }
.panel {
  min-width: 0;
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
}
.panel--subtle { background: var(--color-surface-subtle); }
.panel__label {
  margin: 0 0 var(--space-6);
  color: var(--color-text-muted);
  font: 0.6875rem/1.4 var(--font-mono);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.type-display { margin-bottom: var(--space-6); font-size: clamp(1.75rem, 4vw, 2.75rem); font-weight: 650; line-height: 1.1; letter-spacing: -0.04em; }
.type-heading { margin-bottom: var(--space-4); font-size: 1.25rem; font-weight: 650; line-height: 1.3; }
.type-body { max-width: 56ch; margin-bottom: var(--space-4); color: var(--color-text-secondary); }
.type-mono { margin-bottom: 0; color: var(--color-text-secondary); font: 0.8125rem/1.6 var(--font-mono); }
.token-list { display: grid; margin: 0; gap: var(--space-3); }
.token-list div { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: var(--space-3); }
.token-list dt { color: var(--color-text-secondary); }
.token-list dd { margin: 0; color: var(--color-text-muted); font: 0.75rem/1 var(--font-mono); }
.swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
.swatch { min-width: 0; }
.swatch__color { display: block; height: 3.75rem; margin-bottom: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-1); }
.swatch__name { display: block; overflow: hidden; color: var(--color-text-secondary); font: 0.6875rem/1.4 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }

.button-row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.button {
  display: inline-flex;
  min-height: 2.25rem;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-2);
  color: var(--color-text);
  background: var(--color-surface);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}
.button:hover { border-color: var(--color-text-muted); color: var(--color-text); background: var(--color-surface-subtle); }
.button:active { box-shadow: inset 0 1px 2px rgb(0 0 0 / 10%); }
.button--primary { border-color: var(--color-accent); color: #fff; background: #2855c7; }
.button--primary:hover { border-color: #1d43a5; color: #fff; background: #1d43a5; }
.button--quiet { border-color: transparent; background: transparent; }
.button--danger { border-color: var(--color-error); color: var(--color-error); background: transparent; }
.button svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.75; }

.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.field { display: grid; gap: var(--space-2); }
.field--wide { grid-column: 1 / -1; }
.field label, .field__label { font-size: 0.8125rem; font-weight: 600; line-height: 1.4; }
.field__help, .field__error { margin: 0; font-size: 0.75rem; line-height: 1.45; }
.field__help { color: var(--color-text-muted); }
.field__error { color: var(--color-error); }
.input, .select {
  width: 100%;
  min-height: 2.25rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-2);
  color: var(--color-text);
  background: var(--color-surface);
  font-size: 0.8125rem;
}
.input::placeholder { color: var(--color-text-muted); opacity: 1; }
.input:hover, .select:hover { border-color: var(--color-text-muted); }
.input[aria-invalid="true"] { border-color: var(--color-error); }
.textarea {
  width: 100%;
  min-height: 16rem;
  padding: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-2);
  color: var(--color-text);
  background: var(--color-surface);
  font: 0.8125rem/1.6 var(--font-mono);
  resize: vertical;
}
.textarea::placeholder { color: var(--color-text-muted); opacity: 1; }
.textarea:hover { border-color: var(--color-text-muted); }
.textarea[aria-invalid="true"] { border-color: var(--color-error); }
.search { position: relative; }
.search svg { position: absolute; top: 50%; left: var(--space-3); width: 1rem; height: 1rem; translate: 0 -50%; fill: none; stroke: var(--color-text-muted); stroke-width: 1.75; }
.search .input { padding-left: 2.25rem; }

.tabs { display: flex; overflow-x: auto; border-bottom: 1px solid var(--color-border); gap: var(--space-6); }
.tabs a { position: relative; padding: 0 0 var(--space-3); color: var(--color-text-secondary); font-size: 0.8125rem; text-decoration: none; white-space: nowrap; }
.tabs a[aria-current="page"] { color: var(--color-text); font-weight: 600; }
.tabs a[aria-current="page"]::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: var(--color-accent); content: ""; }
.card-title { margin-bottom: var(--space-2); font-size: 0.9375rem; font-weight: 650; line-height: 1.4; }
.card-copy { margin-bottom: var(--space-4); color: var(--color-text-secondary); font-size: 0.8125rem; }
.card-meta { display: flex; margin: 0; color: var(--color-text-muted); font: 0.6875rem/1.4 var(--font-mono); justify-content: space-between; gap: var(--space-3); }

.table-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-2); background: var(--color-surface); }
.table { width: 100%; min-width: 43rem; border-collapse: collapse; font-size: 0.8125rem; }
.table th, .table td { height: 2.75rem; padding: 0 var(--space-4); border-bottom: 1px solid var(--color-border); text-align: left; white-space: nowrap; }
.table tr:last-child td { border-bottom: 0; }
.table th { color: var(--color-text-muted); background: var(--color-surface-subtle); font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.table td:first-child { font: 0.75rem/1.4 var(--font-mono); }
.table .numeric { font-variant-numeric: tabular-nums; text-align: right; }
.table__title { color: var(--color-text); font-family: var(--font-sans); font-weight: 600; }
.badge {
  display: inline-flex;
  min-height: 1.375rem;
  padding: 0 var(--space-2);
  border: 1px solid currentColor;
  border-radius: 999px;
  color: var(--color-text-secondary);
  background: var(--color-surface-subtle);
  font: 0.6875rem/1 var(--font-mono);
  align-items: center;
  gap: 0.375rem;
}
.badge::before { width: 0.375rem; height: 0.375rem; border-radius: 50%; background: currentColor; content: ""; }
.badge--success { color: var(--color-success); background: var(--color-success-soft); }
.badge--warning { color: var(--color-warning); background: var(--color-warning-soft); }
.badge--error { color: var(--color-error); background: var(--color-error-soft); }
.badge--info { color: var(--color-info); background: var(--color-info-soft); }
.status-row { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.notice { display: grid; padding: var(--space-4); border: 1px solid var(--color-border); border-left: 3px solid var(--color-info); border-radius: var(--radius-1); background: var(--color-info-soft); grid-template-columns: auto 1fr; gap: var(--space-3); }
.notice svg { width: 1.125rem; height: 1.125rem; margin-top: 0.15rem; fill: none; stroke: var(--color-info); stroke-width: 1.75; }
.notice strong { display: block; margin-bottom: var(--space-1); font-size: 0.8125rem; }
.notice p { margin: 0; color: var(--color-text-secondary); font-size: 0.8125rem; }

.code-block { overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-2); background: var(--color-surface-subtle); }
.code-block__bar { display: flex; min-height: 2.25rem; padding: 0 var(--space-3); border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); background: var(--color-surface); font: 0.6875rem/1 var(--font-mono); align-items: center; justify-content: space-between; }
.code-block pre { overflow-x: auto; margin: 0; padding: var(--space-6); font-size: 0.8125rem; line-height: 1.7; tab-size: 2; }
.syntax-comment { color: var(--color-text-muted); }
.syntax-keyword { color: var(--color-accent); }
.syntax-string { color: var(--color-success); }
.syntax-function { color: var(--color-info); }

.state { display: flex; min-height: 15rem; padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-2); background: var(--color-surface); flex-direction: column; align-items: flex-start; justify-content: center; }
.state__icon { display: grid; width: 2.25rem; height: 2.25rem; margin-bottom: var(--space-4); border: 1px solid var(--color-border-strong); border-radius: var(--radius-2); color: var(--color-text-secondary); place-items: center; }
.state__icon svg { width: 1.125rem; height: 1.125rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.75; }
.state h3 { margin-bottom: var(--space-2); font-size: 0.9375rem; line-height: 1.4; }
.state p { margin-bottom: var(--space-4); color: var(--color-text-secondary); font-size: 0.8125rem; }
.state--error { border-color: color-mix(in srgb, var(--color-error) 45%, var(--color-border)); }
.state--error .state__icon { color: var(--color-error); }
.skeleton { width: 100%; }
.skeleton span { display: block; height: 0.625rem; margin-bottom: var(--space-3); border-radius: var(--radius-1); background: var(--color-surface-subtle); }
.skeleton span:nth-child(1) { width: 45%; }
.skeleton span:nth-child(2) { width: 92%; }
.skeleton span:nth-child(3) { width: 72%; }
.progress-line { position: relative; overflow: hidden; width: 100%; height: 2px; margin-top: var(--space-4); background: var(--color-border); }
.progress-line::after { position: absolute; width: 38%; height: 100%; background: var(--color-accent); animation: progress 1.4s ease-in-out infinite; content: ""; }
@keyframes progress { from { translate: -100%; } to { translate: 270%; } }

.page-header { margin-bottom: var(--space-8); padding-bottom: var(--space-8); border-bottom: 1px solid var(--color-border); }
.principles-list { margin: 0; padding: 0; list-style: none; }
.principle { padding: var(--space-6) 0; border-bottom: 1px solid var(--color-border); }
.principle h2 { margin-bottom: var(--space-1); font-size: 1rem; }
.principle p { margin: 0; color: var(--color-text-muted); font: 0.75rem/1.4 var(--font-mono); }
.empty-state { padding: var(--space-12); border: 1px dashed var(--color-border-strong); border-radius: var(--radius-2); text-align: center; }
.empty-state strong { display: block; margin-bottom: var(--space-2); }
.empty-state p { max-width: 42ch; margin: 0 auto; color: var(--color-text-secondary); }

.findings-list { display: grid; margin: 0; padding: 0; gap: var(--space-6); list-style: none; }
.finding-evidence-list { display: grid; margin: 0; padding: 0; gap: var(--space-3); list-style: none; }

.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; border: 0; clip: rect(0 0 0 0); white-space: nowrap; }
.analyze-grid { display: grid; margin-bottom: var(--space-4); grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--space-4); align-items: start; }
.editor { padding: 0; overflow: hidden; }
.editor__toolbar { display: flex; min-height: 2.75rem; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border); align-items: center; justify-content: space-between; gap: var(--space-3); }
.editor__filename { overflow: hidden; color: var(--color-text-secondary); font: 0.75rem/1.4 var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
.editor__actions { display: flex; align-items: center; gap: var(--space-2); }
.editor__actions .button { min-height: 1.75rem; padding: 0 var(--space-3); font-size: 0.75rem; }
.editor__language { width: 7rem; min-height: 1.75rem; padding: 0 var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-2); color: var(--color-text-secondary); background: var(--color-surface-subtle); font: 0.75rem/1 var(--font-mono); }
.editor__language:hover { border-color: var(--color-text-muted); }
.editor__body { display: grid; grid-template-columns: auto minmax(0, 1fr); }
.editor__body > * { min-width: 0; }
.editor__actions { flex-wrap: wrap; min-width: 0; }
.editor__filename { min-width: 0; }
.editor__gutter { min-width: 3.25rem; padding: var(--space-3) 0; border-right: 1px solid var(--color-border); background: var(--color-surface-subtle); font-variant-numeric: tabular-nums; user-select: none; }
.editor__gutter span { display: block; padding-right: var(--space-3); color: var(--color-text-muted); font: 0.8125rem/1.6 var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
.editor__input { width: 100%; min-height: 32rem; padding: var(--space-3); border: 0; border-radius: 0; color: var(--color-text); background: transparent; font: 0.8125rem/1.6 var(--font-mono); resize: vertical; }
.editor__stage { display: grid; min-width: 0; }
.editor__stage > * { grid-area: 1 / 1; min-width: 0; }
.editor__backdrop { display: none; margin: 0; padding: var(--space-3); overflow: hidden; border: 0; font: 0.8125rem/1.6 var(--font-mono); white-space: pre-wrap; overflow-wrap: break-word; }
.editor__backdrop code { font: inherit; }
.editor--live .editor__backdrop { display: block; }
.editor--live .editor__input { position: relative; z-index: 1; color: transparent; caret-color: var(--color-text); }
.editor--live .editor__input::selection { color: transparent; background: var(--color-accent-soft); }
.hljs-keyword, .hljs-selector-tag, .hljs-doctag { color: var(--color-accent); }
.hljs-string, .hljs-regexp, .hljs-addition { color: var(--color-success); }
.hljs-number, .hljs-literal { color: var(--color-warning); }
.hljs-comment, .hljs-quote { color: var(--color-text-muted); }
.hljs-title, .hljs-title.function_, .hljs-title.class_, .hljs-function .hljs-title { color: var(--color-info); }
.hljs-type, .hljs-built_in, .hljs-builtin-name { color: var(--color-accent); }
.hljs-variable, .hljs-template-variable, .hljs-attr, .hljs-attribute { color: var(--color-text-secondary); }
.hljs-operator, .hljs-punctuation, .hljs-subst { color: var(--color-text); }
.hljs-section, .hljs-name, .hljs-selector-id, .hljs-selector-class { color: var(--color-accent); }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 650; }
.hljs-deletion { color: var(--color-error); }
.contract__group { margin-bottom: var(--space-4); }
.contract__group:last-child { margin-bottom: 0; }
.contract__group-title { margin: 0 0 var(--space-2); color: var(--color-text-muted); font: 0.6875rem/1.4 var(--font-mono); letter-spacing: 0.07em; text-transform: uppercase; }
.contract__items { display: grid; }
.contract__item { display: flex; padding: var(--space-1) 0; font-size: 0.8125rem; align-items: center; gap: var(--space-2); }
.contract__item input { accent-color: var(--color-accent); }
.contract__count { margin: var(--space-4) 0 0; padding-top: var(--space-3); border-top: 1px solid var(--color-border); color: var(--color-text-muted); font: 0.75rem/1.4 var(--font-mono); }
.analyze-toolbar { display: flex; padding: var(--space-2) 0; align-items: center; justify-content: space-between; gap: var(--space-3); }
.analyze-toolbar__meta { margin: 0; color: var(--color-text-muted); font: 0.75rem/1.4 var(--font-mono); }
.examples { margin-top: var(--space-8); padding-top: var(--space-6); border-top: 1px solid var(--color-border); }
.examples h2 { margin-bottom: var(--space-3); font-size: 0.9375rem; line-height: 1.4; }
.playground__note { margin: var(--space-4) 0 0; color: var(--color-text-muted); font-size: 0.75rem; line-height: 1.45; }

@media (max-width: 63.99rem) {
  .analyze-grid { grid-template-columns: minmax(0, 1fr); }
  .editor__toolbar { flex-wrap: wrap; }
  .editor__input { min-height: 24rem; }
}

.footer { width: min(100% - 4rem, var(--content-width)); margin: 0 auto; padding: var(--space-6) 0 var(--space-12); color: var(--color-text-muted); font: 0.6875rem/1.5 var(--font-mono); }

@media (max-width: 63.99rem) {
  .intro { grid-template-columns: 1fr; }
  .intro__facts { max-width: 32rem; }
  .span-4 { grid-column: span 6; }
  .span-5, .span-7 { grid-column: span 6; }
  .span-8 { grid-column: span 12; }
}

@media (max-width: 44.99rem) {
  .topbar__inner { overflow-x: auto; padding: 0 var(--space-4); gap: var(--space-6); }
  .topbar__meta { display: none; }
  .topnav { gap: var(--space-4); }
  .playground, .page, .footer { width: min(100% - 2rem, var(--content-width)); }
  .playground, .page { padding-block: var(--space-12); }
  .section { padding-block: var(--space-8); }
  .section__header { grid-template-columns: 1fr; gap: var(--space-2); }
  .demo-grid { gap: var(--space-4); }
  .span-4, .span-5, .span-6, .span-7, .span-8 { grid-column: 1 / -1; }
  .field-grid { grid-template-columns: 1fr; }
  .field--wide { grid-column: auto; }
  .swatches { grid-template-columns: repeat(2, 1fr); }
}

@media (forced-colors: active) {
  .badge::before, .progress-line::after, .topnav a[aria-current="page"]::after, .tabs a[aria-current="page"]::after { background: CanvasText; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
`;
