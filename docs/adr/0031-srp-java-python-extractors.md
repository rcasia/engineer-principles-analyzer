# ADR-0031: Support Java and Python in the SRP heuristic with per-language extractors

**Status**: Accepted (Extends [0022](0022-srp-heuristic-rule.md))
**Date**: 2026-09-20

## Context

Issue #16 asks for the initial SOLID analyzers to work across Java,
TypeScript, JavaScript and Python, with the language abstraction designed
so further ecosystems can be added without duplicating the rule engine.
Language detection (ADR-0025/ADR-0026) already recognises six languages,
but the SRP heuristic (ADR-0022) only knew TypeScript and JavaScript:
Java and Python subjects were reported `not_applicable`, and the
allow-list named exactly those two languages.

Java is brace-shaped like TypeScript, so its classes are already
delineated — but its methods carry return types, `throws` clauses and
constructors spelled as the class name, none of which the method header
matched. Python has no braces at all: `class Name:` blocks are owned by
indentation and methods are `def` lines. One shared extractor cannot read
both shapes without becoming a parser in disguise.

## Decision Drivers

- **Zero runtime dependencies** (ADR-0008): still no parsers, still a
  hand-written scanner. Whatever is added must stay dependency-free.
- **Rule semantics stay language-independent where possible** (#16): the
  verdict thresholds, the responsibility dictionary and the
  worst-class-wins aggregation must not fork per language — only the
  reading of class/method shapes may vary.
- **No OO-style imperialism** (ADR-0022): a language without classes must
  keep reporting `not_applicable`, never a borrowed verdict.
- **Remediation must not invent APIs**: suggestions name a decomposition
  direction, never an import, a snippet, or a framework.

## Considered Options

### Option 1: Per-language extractors feeding the shared assessment core (chosen)

- **Pros**: `assessClass`, the responsibility dictionary and the verdict
  thresholds run unchanged for every language; each new language is one
  extractor plus tests. Java needs only a tolerant method header (return
  type, `throws`, class-named constructor); Python needs an
  indentation-based class scan plus a `def`-line method scan.
- **Cons**: Two shape-readers to maintain; Python specifics (nested
  classes reported separately, multi-line strings misread as code) become
  permanent documented gaps.

### Option 2: Depend on tree-sitter (or one parser per language)

- **Pros**: Correct boundaries in every language, including ones with no
  class keyword at all.
- **Cons**: Rejected for the same reasons as ADR-0022's Option 1 — a
  parser per language in the published bundle against ADR-0008, multiplied
  audit surface (ADR-0011), and it still would not answer the actual
  judgment (which names form a "responsibility").

### Option 3: Normalise every language to the brace extractor

- **Pros**: One code path; no new extractor.
- **Cons**: Requires rewriting Python into pseudo-braces before analysis,
  which is a parser by another name — with all of Option 2's costs and
  none of its correctness.

## Decision

Option 1:

- `supported-language.ts` allows `typescript`, `javascript`, `java` and
  `python`. Go (no classes) and Rust (`impl` blocks, not classes) stay
  `not_applicable` until a dedicated interpretation exists for them.
- The brace path (`extractClasses` + brace `extractMethodNames`) serves
  TypeScript, JavaScript and Java. The method header additionally tolerates
  a leading return type, a leading generic list and a trailing `throws`
  clause; a method named after its class is excluded as a constructor,
  alongside `constructor` and `__init__`.
- The Python path (`extractPythonClasses` + `def`-line
  `extractMethodNames`) owns `class Name:` blocks by indentation and reads
  methods at the shallowest `def` depth, so nested functions are never
  counted as interface. Nested classes are reported as their own
  declarations rather than folded into the outer one.
- Evidence mirrors the analysed syntax (`class Foo { … }` vs
  `class Foo: …`), and violation remediation names the language's own
  decomposition unit (`collaborator(s)` for brace languages, `module(s)`
  for Python).

## Consequences

### Positive

- #16's four initial languages are analysed by one rule, one assessment
  core and one verdict scale, with idiomatic per-language tests (a Java
  service class, a Python manager class, constructor exclusions in both).
- Adding Go or Rust later means adding an extractor, not re-arguing the
  verdict semantics — the extension pattern is worked, not just claimed.
- Remediation stays API-free: it names responsibilities and a direction
  ("extract … into its own module(s)"), never code to paste.

### Negative

- The method header now accepts a two-word `Type name(...)` shape, so a
  hypothetical brace-language member spelled that way without being a
  method would match. Java is the only supported language where that
  shape is idiomatic, which bounds the exposure.
- Python extraction is line-oriented: a `class` line inside a multi-line
  string is misread, and only the shallowest `def` depth counts. Both are
  documented on `extractPythonClasses`, in the same spirit as ADR-0022's
  disclosed scanner gaps.
- Thresholds and dictionary remain unmeasured (ADR-0022's caveat stands):
  they were reasoned for English method names and are now applied to Java
  and Python names on the same basis — to be tuned against the corpus
  (#27), not re-derived here.

### Risks and mitigations

- **Risk**: A Java constructor counted as a responsibility signal inflates
  the method count. *Mitigation*: class-named methods are excluded, locked
  by a dedicated test.
- **Risk**: Python's `__init__` (often several assignments) skews
  assessment. *Mitigation*: excluded like `constructor`, locked by test.
- **Risk**: A future contributor adds a language by copying the rule
  instead of the extractor pattern. *Mitigation*: recorded here — new
  languages add an extractor and an allow-list entry, never a rule fork.
