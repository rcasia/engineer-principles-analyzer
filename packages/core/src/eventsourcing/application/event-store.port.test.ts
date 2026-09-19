import { describe, expect, it } from "bun:test";
import { ConcurrencyError } from "./event-store.port.ts";

describe("ConcurrencyError", () => {
  it("is an Error", () => {
    expect(new ConcurrencyError("boom")).toBeInstanceOf(Error);
  });

  it("carries the name callers discriminate on", () => {
    expect(new ConcurrencyError("boom").name).toBe("ConcurrencyError");
  });

  it("keeps the message it was given", () => {
    expect(new ConcurrencyError("boom").message).toBe("boom");
  });
});
