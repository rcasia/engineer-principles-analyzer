import { describe, expect, it } from "bun:test";
import { VERSION } from "./version.ts";

describe("VERSION", () => {
  it("reports dev when running from source", () => {
    expect(VERSION).toBe("0.0.0-dev");
  });
});
