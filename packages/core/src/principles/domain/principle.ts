/**
 * An engineering principle a subject can be analyzed against.
 *
 * The shipped catalog is the five SOLID principles
 * (`SOLID_PRINCIPLES`): each one names the standard its rule already
 * checks. See docs/adr/0002-hexagonal-architecture.md.
 */
export interface Principle {
  readonly id: string;
  readonly title: string;
}
