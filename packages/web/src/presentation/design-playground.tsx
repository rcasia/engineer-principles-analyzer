import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DESIGN_SYSTEM_CSS } from "./design-system.ts";
import { VERSION } from "../version.ts";

export const DESIGN_PLAYGROUND_TITLE = "Design playground | Principled";

function TopBar(): ReactElement {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <a className="brand" href="/">
          <span className="brand__mark" aria-hidden="true">
            P/
          </span>
          <span>Principled</span>
        </a>
        <nav className="topnav" aria-label="Primary">
          <a href="/">Principles</a>
          <a href="/analyze">Analyze</a>
          <a href="/design" aria-current="page">
            Design system
          </a>
        </nav>
        <div
          className="topbar__meta"
          aria-label="Command palette shortcut"
        >
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </div>
      </div>
    </header>
  );
}

function IntroHeader(): ReactElement {
  return (
    <header className="intro">
      <div>
        <p className="eyebrow">Internal reference · v0.1</p>
        <h1>Interface foundation for careful engineering.</h1>
        <p className="lede">
          A working inventory of the tokens, components and system states
          used to turn technical evidence into clear decisions.
        </p>
      </div>
      <dl className="intro__facts">
        <div>
          <dt>Direction</dt>
          <dd>technical editorial</dd>
        </div>
        <div>
          <dt>Base unit</dt>
          <dd>4px</dd>
        </div>
        <div>
          <dt>Contrast</dt>
          <dd>WCAG 2.2 AA</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>0kb client JS</dd>
        </div>
      </dl>
    </header>
  );
}

function TypeSection(): ReactElement {
  return (
    <section className="section" aria-labelledby="type-heading">
      <header className="section__header">
        <span className="section__index">01 / Foundations</span>
        <div>
          <h2 id="type-heading">Type and color</h2>
          <p className="section__description">
            Sans carries explanation and action. Mono identifies values,
            commands and machine state. Color reinforces hierarchy but never
            carries meaning alone.
          </p>
        </div>
      </header>
      <div className="demo-grid">
        <article className="panel span-7">
          <p className="panel__label">Type specimen</p>
          <p className="type-display">Evidence before opinion.</p>
          <p className="type-heading">
            Continuous integration shortens feedback loops.
          </p>
          <p className="type-body">
            Analyze a repository against explicit engineering principles,
            inspect the evidence, and understand how each conclusion was
            reached.
          </p>
          <p className="type-mono">
            src/pipeline/verify.ts:42 · score 87/100 · 1.8s
          </p>
        </article>
        <article className="panel span-5">
          <p className="panel__label">Scale</p>
          <dl className="token-list">
            <div>
              <dt>Page title</dt>
              <dd>32–52 / 1.08</dd>
            </div>
            <div>
              <dt>Section</dt>
              <dd>20 / 1.30</dd>
            </div>
            <div>
              <dt>Body</dt>
              <dd>15 / 1.60</dd>
            </div>
            <div>
              <dt>UI label</dt>
              <dd>13 / 1.40</dd>
            </div>
            <div>
              <dt>Metadata</dt>
              <dd>12 / 1.40</dd>
            </div>
          </dl>
        </article>
        <article className="panel span-12">
          <p className="panel__label">Semantic colors</p>
          <div className="swatches">
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-text)" }}
              ></span>
              <span className="swatch__name">text</span>
            </div>
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-surface-subtle)" }}
              ></span>
              <span className="swatch__name">surface-subtle</span>
            </div>
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-accent)" }}
              ></span>
              <span className="swatch__name">accent</span>
            </div>
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-success)" }}
              ></span>
              <span className="swatch__name">success</span>
            </div>
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-warning)" }}
              ></span>
              <span className="swatch__name">warning</span>
            </div>
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-error)" }}
              ></span>
              <span className="swatch__name">error</span>
            </div>
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-info)" }}
              ></span>
              <span className="swatch__name">information</span>
            </div>
            <div className="swatch">
              <span
                className="swatch__color"
                style={{ background: "var(--color-border)" }}
              ></span>
              <span className="swatch__name">border</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function ControlsSection(): ReactElement {
  return (
    <section className="section" aria-labelledby="controls-heading">
      <header className="section__header">
        <span className="section__index">02 / Controls</span>
        <div>
          <h2 id="controls-heading">Actions and input</h2>
          <p className="section__description">
            Controls remain compact, explicit and familiar. Labels describe
            outcomes; persistent field labels preserve context after entry.
          </p>
        </div>
      </header>
      <div className="demo-grid">
        <article className="panel span-5">
          <p className="panel__label">Buttons</p>
          <div className="button-row">
            <button className="button button--primary" type="button">
              Run analysis
            </button>
            <button className="button" type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" />
              </svg>
              Export JSON
            </button>
            <button className="button button--quiet" type="button">
              View config
            </button>
            <button className="button button--danger" type="button">
              Remove
            </button>
            <button className="button" type="button" disabled>
              Queued
            </button>
          </div>
        </article>
        <article className="panel span-7">
          <p className="panel__label">Form controls</p>
          <form className="field-grid">
            <div className="field field--wide">
              <label htmlFor="repository">Repository URL</label>
              <input
                className="input"
                id="repository"
                name="repository"
                type="url"
                defaultValue="https://github.com/acme/compiler"
              />
              <p className="field__help" id="repository-help">
                Public Git repository, including owner and name.
              </p>
            </div>
            <div className="field">
              <label htmlFor="branch">Branch</label>
              <input
                className="input"
                id="branch"
                name="branch"
                type="text"
                placeholder="main"
              />
            </div>
            <div className="field">
              <label htmlFor="profile">Analysis profile</label>
              <select className="select" id="profile" name="profile">
                <option>Balanced</option>
                <option>Strict</option>
                <option>Exploratory</option>
              </select>
            </div>
            <div className="field field--wide">
              <label htmlFor="config">Configuration path</label>
              <input
                className="input"
                id="config"
                name="config"
                type="text"
                defaultValue=".principled.yml"
                aria-invalid="true"
                aria-describedby="config-error"
              />
              <p className="field__error" id="config-error">
                No configuration file exists at this path.
              </p>
            </div>
          </form>
        </article>
        <article className="panel span-12">
          <p className="panel__label">Search and local navigation</p>
          <div
            className="field"
            style={{ maxWidth: "32rem", marginBottom: "1.5rem" }}
          >
            <label htmlFor="search">Search evidence</label>
            <div className="search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                className="input"
                id="search"
                type="search"
                placeholder="File, principle, or finding"
              />
            </div>
          </div>
          <nav className="tabs" aria-label="Analysis sections">
            <a href="#summary" aria-current="page">
              Summary <span className="badge">12</span>
            </a>
            <a href="#evidence">Evidence</a>
            <a href="#configuration">Configuration</a>
            <a href="#raw-output">Raw output</a>
          </nav>
        </article>
      </div>
    </section>
  );
}

function ContentSection(): ReactElement {
  return (
    <section className="section" aria-labelledby="content-heading">
      <header className="section__header">
        <span className="section__index">03 / Content</span>
        <div>
          <h2 id="content-heading">Structured evidence</h2>
          <p className="section__description">
            Lists and tables favor comparison. Cards are reserved for
            independently useful units rather than used as default page
            furniture.
          </p>
        </div>
      </header>
      <div className="demo-grid">
        <article className="panel span-6">
          <p className="panel__label">Principle card</p>
          <h3 className="card-title">
            Make invalid states unrepresentable
          </h3>
          <p className="card-copy">
            Model constraints in types and constructors so errors are
            rejected before execution.
          </p>
          <p className="card-meta">
            <span>type-safety</span>
            <span>4 findings →</span>
          </p>
        </article>
        <article className="panel span-6">
          <p className="panel__label">Principle card</p>
          <h3 className="card-title">Optimize for fast feedback</h3>
          <p className="card-copy">
            Keep verification close to the change and make the reliable path
            the shortest path.
          </p>
          <p className="card-meta">
            <span>feedback-loops</span>
            <span>7 findings →</span>
          </p>
        </article>
        <div
          className="span-12 table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Analysis findings table"
        >
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Principle</th>
                <th scope="col">Location</th>
                <th className="numeric" scope="col">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="badge badge--success">pass</span>
                </td>
                <td className="table__title">Dependencies point inward</td>
                <td>packages/core/src/</td>
                <td className="numeric">98%</td>
              </tr>
              <tr>
                <td>
                  <span className="badge badge--warning">review</span>
                </td>
                <td className="table__title">Fail fast at boundaries</td>
                <td>src/adapters/github.ts:84</td>
                <td className="numeric">76%</td>
              </tr>
              <tr>
                <td>
                  <span className="badge badge--error">fail</span>
                </td>
                <td className="table__title">Keep secrets out of state</td>
                <td>infra/variables.tf:17</td>
                <td className="numeric">94%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StatusSection(): ReactElement {
  return (
    <section className="section" aria-labelledby="status-heading">
      <header className="section__header">
        <span className="section__index">04 / Feedback</span>
        <div>
          <h2 id="status-heading">Status and code</h2>
          <p className="section__description">
            Machine state is terse and scannable. Explanations state impact
            and recovery without burying technical detail.
          </p>
        </div>
      </header>
      <div className="demo-grid">
        <article className="panel span-4">
          <p className="panel__label">Status indicators</p>
          <div className="status-row">
            <span className="badge badge--success">complete</span>
            <span className="badge badge--warning">partial</span>
            <span className="badge badge--error">exit 1</span>
            <span className="badge badge--info">running</span>
          </div>
        </article>
        <article className="panel span-8">
          <p className="panel__label">Inline notice</p>
          <div className="notice">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5m0-9h.01" />
            </svg>
            <div>
              <strong>
                Analysis uses the repository default branch
              </strong>
              <p>
                No branch was configured. Results are based on <code>main</code>{" "}
                at commit <code>9f8c2a1</code>.
              </p>
            </div>
          </div>
        </article>
        <div className="span-12 code-block">
          <div className="code-block__bar">
            <span>principled.config.ts</span>
            <button className="button button--quiet" type="button">
              Copy
            </button>
          </div>
          <pre aria-label="TypeScript configuration example">
            <code>
              <span className="syntax-keyword">import</span>
              {" { "}
              <span className="syntax-function">defineConfig</span>
              {" } "}
              <span className="syntax-keyword">from</span>
              {" "}
              <span className="syntax-string">"principled"</span>
              {";\n\n"}
              <span className="syntax-keyword">export default</span>
              {" "}
              <span className="syntax-function">defineConfig</span>
              {"({"}
              {"\n  profile: "}
              <span className="syntax-string">"strict"</span>
              {","}
              {"\n  include: ["}
              <span className="syntax-string">"packages/*/src/**"</span>
              {"],"}
              {"\n  "}
              <span className="syntax-comment">
                {"// Evidence remains inspectable in CI artifacts."}
              </span>
              {"\n  output: "}
              <span className="syntax-string">"reports/principles.json"</span>
              {","}
              {"\n});"}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function StatesSection(): ReactElement {
  return (
    <section className="section" aria-labelledby="states-heading">
      <header className="section__header">
        <span className="section__index">05 / System states</span>
        <div>
          <h2 id="states-heading">Empty, loading and error</h2>
          <p className="section__description">
            Every state preserves context and names the next useful action.
            Layout remains stable while content changes.
          </p>
        </div>
      </header>
      <div className="demo-grid">
        <article className="state span-4">
          <div className="state__icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16v12H4zM8 7V4h8v3" />
            </svg>
          </div>
          <h3>No analyses yet</h3>
          <p>
            Run an analysis to compare a repository with the active
            engineering principles.
          </p>
          <button className="button button--primary" type="button">
            Analyze repository
          </button>
        </article>
        <article className="state span-4" aria-label="Loading analysis">
          <div className="skeleton" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <h3>Inspecting dependency boundaries</h3>
          <p>Stage 3 of 5 · 186 files indexed</p>
          <div className="progress-line" aria-hidden="true"></div>
        </article>
        <article className="state state--error span-4">
          <div className="state__icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 3 9 17H3L12 3Zm0 6v5m0 3h.01" />
            </svg>
          </div>
          <h3>Repository could not be read</h3>
          <p>
            The analysis did not start. Check that the URL is public or
            update its access token.
          </p>
          <div className="button-row">
            <button className="button" type="button">
              Try again
            </button>
            <a href="#details">View details</a>
          </div>
        </article>
      </div>
    </section>
  );
}

function DesignPlaygroundPage(): ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="data:," />
        <title>{DESIGN_PLAYGROUND_TITLE}</title>
        <style>{DESIGN_SYSTEM_CSS}</style>
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <TopBar />
        <main className="playground" id="main">
          <IntroHeader />
          <TypeSection />
          <ControlsSection />
          <ContentSection />
          <StatusSection />
          <StatesSection />
        </main>
        <footer className="footer">
          Principled design reference · semantic HTML · light/dark · reduced
          motion · responsive · v{VERSION}
        </footer>
      </body>
    </html>
  );
}

/**
 * The design playground as SSR-only components (#51): rendered with
 * `renderToStaticMarkup` and shipped as plain HTML with no `<script>` tag,
 * so the no-JS baseline holds unchanged. No hydration need was shown for
 * this page — it is a static reference — so no island is wired to it.
 */
export function renderDesignPlayground(): string {
  return `<!doctype html>\n${renderToStaticMarkup(<DesignPlaygroundPage />)}`;
}
