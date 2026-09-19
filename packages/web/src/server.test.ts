import { describe, expect, it } from "bun:test";
import { InMemoryPrincipleCatalog, ListPrinciples } from "@epa/core";
import type { Principle } from "@epa/core";
import { createRequestHandler } from "./server.ts";

const tdd: Principle = { id: "tdd", title: "Test Driven Development" };

function handlerFor(principles: readonly Principle[] = []) {
  return createRequestHandler(
    new ListPrinciples(new InMemoryPrincipleCatalog(principles)),
  );
}

describe("createRequestHandler", () => {
  it("serves the principles page as html at the root", async () => {
    const response = await handlerFor([tdd])(
      new Request("http://localhost/"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    await expect(response.text()).resolves.toContain(
      "Test Driven Development",
    );
  });

  it("lets the cdn cache the page and serve it stale while revalidating", async () => {
    const response = await handlerFor()(new Request("http://localhost/"));

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=600",
    );
  });

  it("lets the cdn cache 404s so they never reach the origin twice", async () => {
    const response = await handlerFor()(new Request("http://localhost/gone"));

    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("ignores the query string when routing", async () => {
    const response = await handlerFor()(
      new Request("http://localhost/?anything=1"),
    );

    expect(response.status).toBe(200);
  });

  it("serves the internal design playground", async () => {
    const response = await handlerFor()(new Request("http://localhost/design"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    await expect(response.text()).resolves.toContain(
      "Design playground | Principled",
    );
  });

  it.each(["/missing", "/principles", "/design/", "//"])(
    "responds 404 as plain text for %p",
    async (pathname) => {
      const response = await handlerFor()(
        new Request(`http://localhost${pathname}`),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8",
      );
      await expect(response.text()).resolves.toBe("Not found");
    },
  );
});
