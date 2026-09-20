import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Principle } from "@principled/core";

export const EMPTY_STATE = "No principles are defined yet.";

/**
 * The principles list as an SSR-only component (Phase 1, #49): rendered with
 * `renderToStaticMarkup` and shipped as plain HTML with no `<script>` tag,
 * so the ADR-0004 no-JS baseline holds unchanged. Text interpolation is
 * escaped by React, which is a superset of `escapeHtml` (it additionally
 * encodes `'` as `&#x27;`) — still XSS-safe at the boundary, and rendering
 * identically in the browser.
 */
export function PrinciplesList(props: {
  readonly principles: readonly Principle[];
}): ReactElement {
  if (props.principles.length === 0) {
    return (
      <div className="empty-state">
        <strong>Catalog is empty</strong>
        <p>{EMPTY_STATE}</p>
      </div>
    );
  }

  return (
    <ul aria-label="Engineering principles" className="principles-list">
      {props.principles.map((principle) => (
        <li className="principle" key={principle.id}>
          <h2>{principle.title}</h2>
          <p>{principle.id}</p>
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
