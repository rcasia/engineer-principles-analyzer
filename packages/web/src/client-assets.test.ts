import { describe, expect, it } from "bun:test";
import { loadClientAssets } from "./client-assets.ts";

describe("loadClientAssets", () => {
  it("loads the hashed editor bundle with its public path", async () => {
    const assets = await loadClientAssets(
      async () => ["analyze-editor-a1b2c3.js", "gutter-d4e5f6.js"],
      async () => "console.log(1);",
    );

    expect(assets?.scriptSrc).toBe("/assets/analyze-editor-a1b2c3.js");
    expect(assets?.files).toEqual({
      "analyze-editor-a1b2c3.js": "console.log(1);",
    });
  });

  it("returns undefined without a build directory", async () => {
    await expect(
      loadClientAssets(
        async () => {
          throw new Error("ENOENT");
        },
        async () => "",
      ),
    ).resolves.toBe(undefined);
  });

  it("returns undefined when no editor bundle was built", async () => {
    await expect(
      loadClientAssets(async () => ["gutter-d4e5f6.js"], async () => ""),
    ).resolves.toBe(undefined);
  });

  it("returns undefined when the bundle cannot be read", async () => {
    await expect(
      loadClientAssets(
        async () => ["analyze-editor-a1b2c3.js"],
        async () => {
          throw new Error("EACCES");
        },
      ),
    ).resolves.toBe(undefined);
  });

  it("returns undefined for an empty bundle", async () => {
    await expect(
      loadClientAssets(
        async () => ["analyze-editor-a1b2c3.js"],
        async () => "",
      ),
    ).resolves.toBe(undefined);
  });

  it("ignores files that only look like the bundle", async () => {
    await expect(
      loadClientAssets(
        async () => [
          "analyze-editor-.js",
          "analyze-editor-x.js.map",
          "prefix-analyze-editor-a1b2c3.js",
        ],
        async () => "console.log(1);",
      ),
    ).resolves.toBe(undefined);
  });
});
