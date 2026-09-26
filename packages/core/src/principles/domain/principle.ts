/**
 * An engineering principle a subject can be analyzed against.
 *
 * The shipped catalog is the five SOLID principles
 * (`SOLID_PRINCIPLES`): each one names the standard its rule already
 * checks, explains it in plain language, and says how the analyzer's
 * heuristic reads it — so the catalog is the documented contract the
 * findings already cite. See docs/adr/0002-hexagonal-architecture.md.
 */
export interface Principle {
  readonly id: string;
  readonly title: string;
  /** One-sentence plain-language definition of the standard. */
  readonly summary: string;
  /** The cost of violating it: what breaks when code ignores this standard. */
  readonly whyItMatters: string;
  /** What the analyzer's heuristic actually looks for, thresholds included. */
  readonly howChecked: string;
  /** The direction a fix takes when this principle's rule reports a finding. */
  readonly fixDirection: string;
}
