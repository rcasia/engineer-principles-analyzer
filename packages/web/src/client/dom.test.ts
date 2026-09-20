import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { byTag } from "./dom.ts";

describe("byTag", () => {
  it("returns the element when the tag matches", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML = `<form id="analyzeForm"></form>`;

      expect(
        byTag(document, "form#analyzeForm", "FORM")?.tagName,
      ).toBe("FORM");
    } finally {
      void window.close();
    }
  });

  it("returns null when nothing matches", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;

      expect(byTag(document, "form#analyzeForm", "FORM")).toBe(null);
    } finally {
      void window.close();
    }
  });

  it("returns null for a mistagged element instead of wiring the wrong node", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML = `<div id="sourceCode"></div>`;

      expect(byTag(document, "#sourceCode", "TEXTAREA")).toBe(null);
    } finally {
      void window.close();
    }
  });
});
