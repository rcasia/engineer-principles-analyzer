import { describe, expect, it } from "bun:test";
import { CODE_EXAMPLES, exampleFor } from "./code-examples.ts";

describe("CODE_EXAMPLES", () => {
  it("ships one snippet per example button, in button order", () => {
    expect(
      CODE_EXAMPLES.map((example) => [
        example.id,
        example.label,
        example.filename,
        example.language,
      ]),
    ).toEqual([
      [
        "single-responsibility",
        "Single Responsibility",
        "UserService.ts",
        "typescript",
      ],
      [
        "hexagonal-violation",
        "Hexagonal violation",
        "OrderService.ts",
        "typescript",
      ],
      [
        "dependency-inversion",
        "Dependency inversion",
        "ReportService.ts",
        "typescript",
      ],
      ["clean-architecture", "Clean architecture", "CreateUser.ts", "typescript"],
    ]);
  });

  it("gives each snippet a short, self-contained source", () => {
    for (const example of CODE_EXAMPLES) {
      expect(example.source.length).toBeGreaterThan(0);
      expect(example.source.split("\n").length).toBeLessThanOrEqual(16);
    }

    expect(CODE_EXAMPLES[0]?.source).toContain("sendWelcomeEmail");
    expect(CODE_EXAMPLES[1]?.source).toContain("PgOrderRepository");
    expect(CODE_EXAMPLES[2]?.source).toContain("new SmtpMailer");
    expect(CODE_EXAMPLES[3]?.source).toContain('from "express"');
  });
});

describe("exampleFor", () => {
  it("resolves a known id to its snippet", () => {
    expect(exampleFor("single-responsibility")?.filename).toBe(
      "UserService.ts",
    );
    expect(exampleFor("clean-architecture")?.source).toContain(
      "createUser",
    );
  });

  it.each([null, "", "does-not-exist", "Single-Responsibility"])(
    "resolves %p to no snippet, so the page falls back to the blank form",
    (id) => {
      expect(exampleFor(id)).toBeUndefined();
    },
  );
});
