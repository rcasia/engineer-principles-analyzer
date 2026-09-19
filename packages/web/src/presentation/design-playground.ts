import { DESIGN_SYSTEM_CSS } from "./design-system.ts";

export const DESIGN_PLAYGROUND_TITLE = "Design playground | Principled";

export function renderDesignPlayground(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:,">
<title>${DESIGN_PLAYGROUND_TITLE}</title>
<style>${DESIGN_SYSTEM_CSS}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar__inner">
    <a class="brand" href="/"><span class="brand__mark" aria-hidden="true">P/</span><span>Principled</span></a>
    <nav class="topnav" aria-label="Primary">
      <a href="/">Principles</a>
      <a href="/analyze">Analyze</a>
      <a href="/design" aria-current="page">Design system</a>
    </nav>
    <div class="topbar__meta" aria-label="Command palette shortcut"><kbd>⌘</kbd><kbd>K</kbd></div>
  </div>
</header>
<main class="playground" id="main">
  <header class="intro">
    <div>
      <p class="eyebrow">Internal reference · v0.1</p>
      <h1>Interface foundation for careful engineering.</h1>
      <p class="lede">A working inventory of the tokens, components and system states used to turn technical evidence into clear decisions.</p>
    </div>
    <dl class="intro__facts">
      <div><dt>Direction</dt><dd>technical editorial</dd></div>
      <div><dt>Base unit</dt><dd>4px</dd></div>
      <div><dt>Contrast</dt><dd>WCAG 2.2 AA</dd></div>
      <div><dt>Runtime</dt><dd>0kb client JS</dd></div>
    </dl>
  </header>

  <section class="section" aria-labelledby="type-heading">
    <header class="section__header">
      <span class="section__index">01 / Foundations</span>
      <div><h2 id="type-heading">Type and color</h2><p class="section__description">Sans carries explanation and action. Mono identifies values, commands and machine state. Color reinforces hierarchy but never carries meaning alone.</p></div>
    </header>
    <div class="demo-grid">
      <article class="panel span-7">
        <p class="panel__label">Type specimen</p>
        <p class="type-display">Evidence before opinion.</p>
        <p class="type-heading">Continuous integration shortens feedback loops.</p>
        <p class="type-body">Analyze a repository against explicit engineering principles, inspect the evidence, and understand how each conclusion was reached.</p>
        <p class="type-mono">src/pipeline/verify.ts:42 · score 87/100 · 1.8s</p>
      </article>
      <article class="panel span-5">
        <p class="panel__label">Scale</p>
        <dl class="token-list">
          <div><dt>Page title</dt><dd>32–52 / 1.08</dd></div>
          <div><dt>Section</dt><dd>20 / 1.30</dd></div>
          <div><dt>Body</dt><dd>15 / 1.60</dd></div>
          <div><dt>UI label</dt><dd>13 / 1.40</dd></div>
          <div><dt>Metadata</dt><dd>12 / 1.40</dd></div>
        </dl>
      </article>
      <article class="panel span-12">
        <p class="panel__label">Semantic colors</p>
        <div class="swatches">
          <div class="swatch"><span class="swatch__color" style="background:var(--color-text)"></span><span class="swatch__name">text</span></div>
          <div class="swatch"><span class="swatch__color" style="background:var(--color-surface-subtle)"></span><span class="swatch__name">surface-subtle</span></div>
          <div class="swatch"><span class="swatch__color" style="background:var(--color-accent)"></span><span class="swatch__name">accent</span></div>
          <div class="swatch"><span class="swatch__color" style="background:var(--color-success)"></span><span class="swatch__name">success</span></div>
          <div class="swatch"><span class="swatch__color" style="background:var(--color-warning)"></span><span class="swatch__name">warning</span></div>
          <div class="swatch"><span class="swatch__color" style="background:var(--color-error)"></span><span class="swatch__name">error</span></div>
          <div class="swatch"><span class="swatch__color" style="background:var(--color-info)"></span><span class="swatch__name">information</span></div>
          <div class="swatch"><span class="swatch__color" style="background:var(--color-border)"></span><span class="swatch__name">border</span></div>
        </div>
      </article>
    </div>
  </section>

  <section class="section" aria-labelledby="controls-heading">
    <header class="section__header">
      <span class="section__index">02 / Controls</span>
      <div><h2 id="controls-heading">Actions and input</h2><p class="section__description">Controls remain compact, explicit and familiar. Labels describe outcomes; persistent field labels preserve context after entry.</p></div>
    </header>
    <div class="demo-grid">
      <article class="panel span-5">
        <p class="panel__label">Buttons</p>
        <div class="button-row">
          <button class="button button--primary" type="button">Run analysis</button>
          <button class="button" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>Export JSON</button>
          <button class="button button--quiet" type="button">View config</button>
          <button class="button button--danger" type="button">Remove</button>
          <button class="button" type="button" disabled>Queued</button>
        </div>
      </article>
      <article class="panel span-7">
        <p class="panel__label">Form controls</p>
        <form class="field-grid">
          <div class="field field--wide">
            <label for="repository">Repository URL</label>
            <input class="input" id="repository" name="repository" type="url" value="https://github.com/acme/compiler">
            <p class="field__help" id="repository-help">Public Git repository, including owner and name.</p>
          </div>
          <div class="field">
            <label for="branch">Branch</label>
            <input class="input" id="branch" name="branch" type="text" placeholder="main">
          </div>
          <div class="field">
            <label for="profile">Analysis profile</label>
            <select class="select" id="profile" name="profile"><option>Balanced</option><option>Strict</option><option>Exploratory</option></select>
          </div>
          <div class="field field--wide">
            <label for="config">Configuration path</label>
            <input class="input" id="config" name="config" type="text" value=".principled.yml" aria-invalid="true" aria-describedby="config-error">
            <p class="field__error" id="config-error">No configuration file exists at this path.</p>
          </div>
        </form>
      </article>
      <article class="panel span-12">
        <p class="panel__label">Search and local navigation</p>
        <div class="field" style="max-width:32rem;margin-bottom:1.5rem">
          <label for="search">Search evidence</label>
          <div class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input class="input" id="search" type="search" placeholder="File, principle, or finding"></div>
        </div>
        <nav class="tabs" aria-label="Analysis sections"><a href="#summary" aria-current="page">Summary <span class="badge">12</span></a><a href="#evidence">Evidence</a><a href="#configuration">Configuration</a><a href="#raw-output">Raw output</a></nav>
      </article>
    </div>
  </section>

  <section class="section" aria-labelledby="content-heading">
    <header class="section__header">
      <span class="section__index">03 / Content</span>
      <div><h2 id="content-heading">Structured evidence</h2><p class="section__description">Lists and tables favor comparison. Cards are reserved for independently useful units rather than used as default page furniture.</p></div>
    </header>
    <div class="demo-grid">
      <article class="panel span-6">
        <p class="panel__label">Principle card</p>
        <h3 class="card-title">Make invalid states unrepresentable</h3>
        <p class="card-copy">Model constraints in types and constructors so errors are rejected before execution.</p>
        <p class="card-meta"><span>type-safety</span><span>4 findings →</span></p>
      </article>
      <article class="panel span-6">
        <p class="panel__label">Principle card</p>
        <h3 class="card-title">Optimize for fast feedback</h3>
        <p class="card-copy">Keep verification close to the change and make the reliable path the shortest path.</p>
        <p class="card-meta"><span>feedback-loops</span><span>7 findings →</span></p>
      </article>
      <div class="span-12 table-wrap" tabindex="0" role="region" aria-label="Analysis findings table">
        <table class="table">
          <thead><tr><th scope="col">Status</th><th scope="col">Principle</th><th scope="col">Location</th><th class="numeric" scope="col">Confidence</th></tr></thead>
          <tbody>
            <tr><td><span class="badge badge--success">pass</span></td><td class="table__title">Dependencies point inward</td><td>packages/core/src/</td><td class="numeric">98%</td></tr>
            <tr><td><span class="badge badge--warning">review</span></td><td class="table__title">Fail fast at boundaries</td><td>src/adapters/github.ts:84</td><td class="numeric">76%</td></tr>
            <tr><td><span class="badge badge--error">fail</span></td><td class="table__title">Keep secrets out of state</td><td>infra/variables.tf:17</td><td class="numeric">94%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="status-heading">
    <header class="section__header">
      <span class="section__index">04 / Feedback</span>
      <div><h2 id="status-heading">Status and code</h2><p class="section__description">Machine state is terse and scannable. Explanations state impact and recovery without burying technical detail.</p></div>
    </header>
    <div class="demo-grid">
      <article class="panel span-4">
        <p class="panel__label">Status indicators</p>
        <div class="status-row"><span class="badge badge--success">complete</span><span class="badge badge--warning">partial</span><span class="badge badge--error">exit 1</span><span class="badge badge--info">running</span></div>
      </article>
      <article class="panel span-8">
        <p class="panel__label">Inline notice</p>
        <div class="notice"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/></svg><div><strong>Analysis uses the repository default branch</strong><p>No branch was configured. Results are based on <code>main</code> at commit <code>9f8c2a1</code>.</p></div></div>
      </article>
      <div class="span-12 code-block">
        <div class="code-block__bar"><span>principled.config.ts</span><button class="button button--quiet" type="button">Copy</button></div>
        <pre aria-label="TypeScript configuration example"><code><span class="syntax-keyword">import</span> { <span class="syntax-function">defineConfig</span> } <span class="syntax-keyword">from</span> <span class="syntax-string">"principled"</span>;

<span class="syntax-keyword">export default</span> <span class="syntax-function">defineConfig</span>({
  profile: <span class="syntax-string">"strict"</span>,
  include: [<span class="syntax-string">"packages/*/src/**"</span>],
  <span class="syntax-comment">// Evidence remains inspectable in CI artifacts.</span>
  output: <span class="syntax-string">"reports/principles.json"</span>,
});</code></pre>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="states-heading">
    <header class="section__header">
      <span class="section__index">05 / System states</span>
      <div><h2 id="states-heading">Empty, loading and error</h2><p class="section__description">Every state preserves context and names the next useful action. Layout remains stable while content changes.</p></div>
    </header>
    <div class="demo-grid">
      <article class="state span-4">
        <div class="state__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12H4zM8 7V4h8v3"/></svg></div>
        <h3>No analyses yet</h3>
        <p>Run an analysis to compare a repository with the active engineering principles.</p>
        <button class="button button--primary" type="button">Analyze repository</button>
      </article>
      <article class="state span-4" aria-label="Loading analysis">
        <div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
        <h3>Inspecting dependency boundaries</h3>
        <p>Stage 3 of 5 · 186 files indexed</p>
        <div class="progress-line" aria-hidden="true"></div>
      </article>
      <article class="state state--error span-4">
        <div class="state__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3L12 3Zm0 6v5m0 3h.01"/></svg></div>
        <h3>Repository could not be read</h3>
        <p>The analysis did not start. Check that the URL is public or update its access token.</p>
        <div class="button-row"><button class="button" type="button">Try again</button><a href="#details">View details</a></div>
      </article>
    </div>
  </section>
</main>
<footer class="footer">Principled design reference · semantic HTML · light/dark · reduced motion · responsive</footer>
</body>
</html>`;
}
