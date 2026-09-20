import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { hydrateGutter, lineNumbersOf } from "./gutter.ts";

describe("lineNumbersOf", () => {
  it("returns no line numbers for an empty buffer", () => {
    expect(lineNumbersOf("")).toEqual([]);
  });

  it("numbers a single line without a trailing newline", () => {
    expect(lineNumbersOf("const a = 1;")).toEqual([1]);
  });

  it("numbers each line of a multi-line buffer", () => {
    expect(lineNumbersOf("a\nb\nc")).toEqual([1, 2, 3]);
  });

  it("counts a trailing newline as an open line", () => {
    expect(lineNumbersOf("a\n")).toEqual([1, 2]);
  });

  it("numbers a buffer holding only a newline", () => {
    expect(lineNumbersOf("\n")).toEqual([1, 2]);
  });
});

describe("hydrateGutter", () => {
  it("writes line numbers into a gutter element", () => {
    const window = new Window();

    try {
      const gutter = window.document.createElement("div");
      gutter.className = "editor__gutter";
      window.document.body.appendChild(gutter);

      expect(hydrateGutter(gutter, "a\nb\nc")).toBe(3);
      expect(gutter.textContent).toBe("1\n2\n3");
    } finally {
      void window.close();
    }
  });

  it("clears the gutter for an empty buffer", () => {
    const window = new Window();

    try {
      const gutter = window.document.createElement("div");
      gutter.textContent = "1\n2";
      window.document.body.appendChild(gutter);

      expect(hydrateGutter(gutter, "")).toBe(0);
      expect(gutter.textContent).toBe("");
    } finally {
      void window.close();
    }
  });

  it("is a no-op without a gutter element", () => {
    expect(hydrateGutter(null, "a\nb")).toBe(0);
    expect(hydrateGutter(undefined, "a\nb")).toBe(0);
  });

  it("is a no-op for a gutter without writable text", () => {
    expect(hydrateGutter(42, "a\nb")).toBe(0);
    expect(hydrateGutter("gutter", "a\nb")).toBe(0);
  });
});
