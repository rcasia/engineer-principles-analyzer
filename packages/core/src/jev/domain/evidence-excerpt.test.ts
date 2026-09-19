import { describe, expect, test } from "bun:test";
import { excerptForEvidence } from "./evidence-excerpt.ts";

describe("excerptForEvidence", () => {
  test("returns the first line of a single-line subject", () => {
    expect(excerptForEvidence("class Foo {}")).toEqual({
      lineNumber: 1,
      text: "class Foo {}",
    });
  });

  test("skips blank and whitespace-only lines, reporting 1-based line numbers", () => {
    expect(excerptForEvidence("\n  \n\t\nclass Foo {\n}")).toEqual({
      lineNumber: 4,
      text: "class Foo {",
    });
  });

  test("trims surrounding whitespace including carriage returns", () => {
    expect(excerptForEvidence('  class Foo {}  \r\n  bar();\r\n')).toEqual({
      lineNumber: 1,
      text: "class Foo {}",
    });
  });

  test("caps the excerpt at 120 characters", () => {
    const longLine = `class ${"F".repeat(200)} {}`;

    const excerpt = excerptForEvidence(longLine);

    expect(excerpt.lineNumber).toBe(1);
    expect(excerpt.text).toHaveLength(120);
    expect(excerpt.text).toBe(longLine.slice(0, 120));
  });

  test("leaves a 120-character line untouched", () => {
    const exact = `// ${"x".repeat(117)}`;

    expect(exact).toHaveLength(120);
    expect(excerptForEvidence(exact)).toEqual({ lineNumber: 1, text: exact });
  });

  test("falls back to line 1 with empty text for blank input", () => {
    expect(excerptForEvidence("   \n\t\n ")).toEqual({
      lineNumber: 1,
      text: "",
    });
  });
});
