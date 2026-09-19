import { describe, expect, test } from "bun:test";
import { JevTransportError } from "./jev-client.port.ts";

describe("JevTransportError", () => {
  test("carries its name and message", () => {
    const error = new JevTransportError("Jev request failed with status 429.");

    expect(error.name).toBe("JevTransportError");
    expect(error.message).toBe("Jev request failed with status 429.");
    expect(error).toBeInstanceOf(Error);
  });
});
