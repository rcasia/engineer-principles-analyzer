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
  it("writes one span per line, matching the server markup", () => {
    const window = new Window();

    try {
      const gutter = window.document.createElement("div");
      gutter.className = "editor__gutter";
      window.document.body.appendChild(gutter);

      expect(hydrateGutter(gutter, "a\nb\nc")).toBe(3);
      expect(gutter.innerHTML).toBe(
        "<span>1</span><span>2</span><span>3</span>",
      );
    } finally {
      void window.close();
    }
  });

  it("replaces stale spans when the buffer shrinks", () => {
    const window = new Window();

    try {
      const gutter = window.document.createElement("div");
      gutter.innerHTML =
        "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>";
      window.document.body.appendChild(gutter);

      expect(hydrateGutter(gutter, "a\nb")).toBe(2);
      expect(gutter.innerHTML).toBe("<span>1</span><span>2</span>");
    } finally {
      void window.close();
    }
  });

  it("clears the gutter for an empty buffer", () => {
    const window = new Window();

    try {
      const gutter = window.document.createElement("div");
      gutter.innerHTML = "<span>1</span><span>2</span>";
      window.document.body.appendChild(gutter);

      expect(hydrateGutter(gutter, "")).toBe(0);
      expect(gutter.innerHTML).toBe("");
    } finally {
      void window.close();
    }
  });

  it("never writes source text into the gutter", () => {
    const window = new Window();

    try {
      const gutter = window.document.createElement("div");
      window.document.body.appendChild(gutter);

      expect(hydrateGutter(gutter, "<script>alert(1)</script>")).toBe(1);
      expect(gutter.innerHTML).toBe("<span>1</span>");
    } finally {
      void window.close();
    }
  });

  it("is a no-op without a gutter element", () => {
    expect(hydrateGutter(null, "a\nb")).toBe(0);
    expect(hydrateGutter(undefined, "a\nb")).toBe(0);
  });

  it("is a no-op for a gutter without writable markup", () => {
    expect(hydrateGutter(42, "a\nb")).toBe(0);
    expect(hydrateGutter("gutter", "a\nb")).toBe(0);
    expect(hydrateGutter({ textContent: "1" }, "a\nb")).toBe(0);
    expect(hydrateGutter({ innerHTML: 42 }, "a\nb")).toBe(0);
  });
});
