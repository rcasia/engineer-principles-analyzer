import { describe, expect, it } from "bun:test";
import { main } from "./main.ts";

describe("main", () => {
  it("writes exactly one line to the injected writer", async () => {
    const written: string[] = [];

    await main((line) => written.push(line));

    expect(written).toEqual(["No principles are defined yet."]);
  });
});
