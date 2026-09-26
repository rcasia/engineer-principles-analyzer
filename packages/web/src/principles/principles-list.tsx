import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Principle } from "@principled/core";

export const EMPTY_STATE =
  "The standards behind the rules that already run — like the SOLID checks in the analyzer — are written down here as they are drafted.";

/**
 * The principles list as an SSR-only component (Phase 1, #49): rendered with
 * `renderToStaticMarkup` and shipped as plain HTML with no `<script>` tag,
 * so the ADR-0004 no-JS baseline holds unchanged. Text interpolation is
 * escaped by React, which is a superset of `escapeHtml` (it additionally
 * encodes `'` as `&#x27;`) — still XSS-safe at the boundary, and rendering
 * identically in the browser.
 *
 * Each entry is a self-contained card: the definition, why it matters, how
 * the shipped rule checks it, and the fix direction — plus a link into the
 * analyzer so the catalog leads somewhere checkable.
 */
export function PrinciplesList(props: {
  readonly principles: readonly Principle[];
}): ReactElement {
  if (props.principles.length === 0) {
    return (
      <div className="empty-state">
        <strong>Catalog is being drafted</strong>
        <p>{EMPTY_STATE}</p>
      </div>
    );
  }

  return (
    <ul aria-label="Engineering principles" className="principles-list">
      {props.principles.map((principle) => (
        <li className="principle" key={principle.id}>
          <article aria-labelledby={`${principle.id}-title`}>
            <h2 id={`${principle.id}-title`}>{principle.title}</h2>
            <p className="principle__id">
              <code>{principle.id}</code>
            </p>
            <p className="principle__summary">{principle.summary}</p>
            <dl className="principle__details">
              <div>
                <dt>Why it matters</dt>
                <dd>{principle.whyItMatters}</dd>
              </div>
              <div>
                <dt>How Principled checks it</dt>
                <dd>{principle.howChecked}</dd>
              </div>
              <div>
                <dt>If you get a finding</dt>
                <dd>{principle.fixDirection}</dd>
              </div>
            </dl>
            <p className="principle__cta">
              <a href="/analyze">Try it in the analyzer →</a>
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}

/** Renders the list fragment to static HTML. Keeps JSX out of `.ts` callers. */
export function renderPrinciplesList(
  principles: readonly Principle[],
): string {
  return renderToStaticMarkup(<PrinciplesList principles={principles} />);
}
