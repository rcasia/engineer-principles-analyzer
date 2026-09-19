# Product design

This directory is the source of truth for the product's visual language and
interaction model. The system is designed for engineers who value legibility,
speed and directness over decoration.

## Direction: technical editorial

The interface should feel like a well-made engineering document: structured,
quiet and dense enough to be useful. Warm neutral surfaces reduce glare;
graphite text carries most of the hierarchy; a single blue accent identifies
actions and focus. Monospace is reserved for identifiers, code and operational
metadata rather than used as a costume.

The product is distinctive through alignment, typography, concise language and
small technical details. It does not use decorative gradients, glass effects,
illustrations, large radii or marketing-style hero sections.

## Product principles

1. **Information earns space.** Every element must explain, orient or enable an
   action. Remove it otherwise.
2. **Hierarchy before chrome.** Use position, type and spacing before adding a
   container, border or color.
3. **Dense, not cramped.** Experienced users can scan structured information;
   density must still preserve clear groups and reliable targets.
4. **State is explicit.** Loading, empty, error, success and disabled states
   say what happened and what the user can do next.
5. **The platform is the baseline.** Prefer semantic HTML and native behavior.
   The site remains server-rendered without client JavaScript until a real
   interaction requires revisiting ADR-0004.
6. **Keyboard use is first-class.** Focus order follows reading order, focus is
   always visible, and shortcuts supplement rather than replace controls.

## Using the system

- Start with semantic tokens from [design-system.md](design-system.md). Do not
  add an arbitrary color, spacing value or radius inside a feature.
- Compose the patterns in [components.md](components.md) before inventing a
  new component.
- Use [layout.md](layout.md) for page structure, density and responsive rules.
- Apply [ux-principles.md](ux-principles.md) to flows and product language.
- Review `/design` locally after changing a token or shared component:

  ```sh
  bun --hot packages/web/src/bin.ts
  # open http://localhost:3000/design
  ```

## Change rule

A design-system change updates these documents and the playground in the same
commit. A local exception should be rare, explained near its use and promoted
to a token only when it recurs.
