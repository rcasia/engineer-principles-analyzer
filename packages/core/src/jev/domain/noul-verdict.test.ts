import { describe, expect, test } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  COMPLIANT_AT_OR_BELOW,
  MAXIMUM_AI_CONFIDENCE,
  toNoulVerdict,
  VIOLATION_AT_OR_ABOVE,
} from "./noul-verdict.ts";

describe("toNoulVerdict", () => {
  test("exposes the unevaluated starting cutoffs", () => {
    expect(VIOLATION_AT_OR_ABOVE).toBe(0.75);
    expect(COMPLIANT_AT_OR_BELOW).toBe(0.25);
    expect(MAXIMUM_AI_CONFIDENCE).toBe(0.9);
  });

  test("reads 1 as a violation capped at the maximum AI confidence", () => {
    expect(unwrap(toNoulVerdict(1))).toEqual({
      status: "violation",
      confidence: 0.9,
    });
  });

  test("reads the violation cutoff itself as a violation", () => {
    expect(unwrap(toNoulVerdict(0.75))).toEqual({
      status: "violation",
      confidence: 0.5,
    });
  });

  test("reads just above the violation cutoff as a violation", () => {
    expect(unwrap(toNoulVerdict(0.76)).status).toBe("violation");
  });

  test("reads 0.5 as uncertain with zero confidence", () => {
    expect(unwrap(toNoulVerdict(0.5))).toEqual({
      status: "uncertain",
      confidence: 0,
    });
  });

  test("reads just below the violation cutoff as uncertain", () => {
    expect(unwrap(toNoulVerdict(0.74)).status).toBe("uncertain");
  });

  test("reads just above the compliant cutoff as uncertain", () => {
    expect(unwrap(toNoulVerdict(0.26)).status).toBe("uncertain");
  });

  test("reads the compliant cutoff itself as compliant", () => {
    expect(unwrap(toNoulVerdict(0.25))).toEqual({
      status: "compliant",
      confidence: 0.5,
    });
  });

  test("reads 0 as compliant capped at the maximum AI confidence", () => {
    expect(unwrap(toNoulVerdict(0))).toEqual({
      status: "compliant",
      confidence: 0.9,
    });
  });

  test("rejects NaN", () => {
    expect(unwrapErr(toNoulVerdict(Number.NaN)).message).toBe(
      "Noul value must be a finite number.",
    );
  });

  test("rejects Infinity", () => {
    expect(unwrapErr(toNoulVerdict(Number.POSITIVE_INFINITY)).message).toBe(
      "Noul value must be a finite number.",
    );
  });

  test("rejects a value below 0", () => {
    expect(unwrapErr(toNoulVerdict(-0.1)).message).toBe(
      "Noul value must be between 0 and 1.",
    );
  });

  test("rejects a value above 1", () => {
    expect(unwrapErr(toNoulVerdict(1.1)).message).toBe(
      "Noul value must be between 0 and 1.",
    );
  });

  test("names its error InvalidNoulValueError", () => {
    expect(unwrapErr(toNoulVerdict(Number.NaN)).name).toBe(
      "InvalidNoulValueError",
    );
  });
});
