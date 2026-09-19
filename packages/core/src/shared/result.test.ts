import { describe, expect, it } from "bun:test";
import { err, ok, unwrap, unwrapErr, UnwrapError } from "./result.ts";

describe("ok", () => {
  it("is an ok result carrying the value", () => {
    const result = ok(42);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(42);
  });
});

describe("err", () => {
  it("is an err result carrying the error", () => {
    const result = err("boom");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("boom");
  });
});

describe("unwrap", () => {
  it("returns the value of an ok result", () => {
    expect(unwrap(ok(42))).toBe(42);
  });

  it("throws on an err result", () => {
    expect(() => unwrap(err("boom"))).toThrow(
      new UnwrapError("Called unwrap on an error result: boom"),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(() => unwrap(err("boom"))).toThrow(UnwrapError);
    expect(new UnwrapError("boom").name).toBe("UnwrapError");
  });
});

describe("unwrapErr", () => {
  it("returns the error of an err result", () => {
    expect(unwrapErr(err("boom"))).toBe("boom");
  });

  it("throws on an ok result", () => {
    expect(() => unwrapErr(ok(42))).toThrow(
      new UnwrapError("Called unwrapErr on an ok result."),
    );
  });
});
