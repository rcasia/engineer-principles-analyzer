import { describe, expect, test } from "bun:test";
import {
  countBranchSignals,
  locateFirstSignal,
  MAX_EXCERPT_LENGTH,
  stripNoise,
} from "./branch-signals.ts";

describe("stripNoise", () => {
  test("leaves plain code untouched", () => {
    expect(stripNoise("switch (x) {}")).toBe("switch (x) {}");
  });

  test("blanks double-quoted strings but keeps the quotes' width", () => {
    expect(stripNoise('const s = "switch";')).toBe("const s =         ;");
  });

  test("blanks single-quoted strings with escapes", () => {
    expect(stripNoise("const s = 'it\\'s';")).toBe("const s =        ;");
  });

  test("blanks template literals whole, including interpolations", () => {
    expect(stripNoise("const s = `switch ${x}`;")).toBe("const s =              ;");
  });

  test("blanks line comments but keeps the newline", () => {
    expect(stripNoise("foo(); // switch\nbar();")).toBe("foo();          \nbar();");
  });

  test("blanks block comments but keeps newlines inside them", () => {
    expect(stripNoise("a(); /* switch\nelse if */ b();")).toBe(
      "a();          \n           b();",
    );
  });

  test("an unterminated string blanks to the end of input", () => {
    expect(stripNoise('const s = "switch;')).toBe("const s =         ");
  });

  test("an unterminated block comment blanks to the end of input", () => {
    expect(stripNoise("a(); /* switch")).toBe("a();          ");
  });
});

describe("countBranchSignals", () => {
  test("counts zero signals in plain sequential code", () => {
    expect(countBranchSignals("const x = 1;\nreturn x + 1;")).toEqual({
      switches: 0,
      elseIfs: 0,
      typeGuards: 0,
      total: 0,
    });
  });

  test("counts each signal kind separately and totals them", () => {
    const source = [
      "switch (kind) { case 1: break; }",
      "if (a) {} else if (b) {}",
      "if (typeof x === 'string') {}",
      "if (y instanceof Foo) {}",
    ].join("\n");

    expect(countBranchSignals(source)).toEqual({
      switches: 1,
      elseIfs: 1,
      typeGuards: 2,
      total: 4,
    });
  });

  test("counts an else-if split across a newline", () => {
    expect(countBranchSignals("if (a) {}\nelse\nif (b) {}").elseIfs).toBe(1);
  });

  test("does not count a bare else without an if", () => {
    expect(countBranchSignals("if (a) {} else {}").elseIfs).toBe(0);
  });

  test("ignores signals inside strings, templates and comments", () => {
    const source = [
      'const s = "switch";',
      "const t = `else if ${typeof x}`;",
      "// switch (x) {}",
      "/* if (a instanceof B) {} */",
    ].join("\n");

    expect(countBranchSignals(source)).toEqual({
      switches: 0,
      elseIfs: 0,
      typeGuards: 0,
      total: 0,
    });
  });

  test("does not count identifiers that merely contain a keyword", () => {
    const source = "const switches = 1;\nconst myTypeof = 2;\ncheckInstanceof();";

    expect(countBranchSignals(source)).toEqual({
      switches: 0,
      elseIfs: 0,
      typeGuards: 0,
      total: 0,
    });
  });
});

describe("locateFirstSignal", () => {
  test("returns undefined when there is no signal", () => {
    expect(locateFirstSignal("const x = 1;")).toBeUndefined();
  });

  test("points at the first signal line with its trimmed text", () => {
    const source = "const x = 1;\n  switch (kind) {\n  }";

    expect(locateFirstSignal(source)).toEqual({
      startLine: 2,
      excerpt: "switch (kind) {",
    });
  });

  test("skips signal-looking text hidden in a comment", () => {
    const source = "// switch (x) {}\nif (y instanceof Foo) {}";

    expect(locateFirstSignal(source)).toEqual({
      startLine: 2,
      excerpt: "if (y instanceof Foo) {}",
    });
  });

  test("caps the excerpt at MAX_EXCERPT_LENGTH characters", () => {
    const longLine = `switch (${"x".repeat(200)}) {}`;

    expect(MAX_EXCERPT_LENGTH).toBe(120);

    const found = locateFirstSignal(longLine);

    expect(found?.startLine).toBe(1);
    expect(found?.excerpt).toBe(longLine.slice(0, 120));
    expect(found?.excerpt.length).toBe(120);
  });
});
