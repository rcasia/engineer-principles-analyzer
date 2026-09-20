import { describe, expect, test } from "bun:test";
import { countMembers, extractInterfaces } from "./interface-declaration.ts";

describe("countMembers", () => {
  test("counts zero members in an empty body", () => {
    expect(countMembers("")).toBe(0);
    expect(countMembers("  \n ")).toBe(0);
  });

  test("counts semicolon-separated members", () => {
    expect(countMembers("save(u): void; load(id): User;")).toBe(2);
  });

  test("counts newline-separated members without semicolons", () => {
    expect(countMembers("save(u): void\nload(id): User")).toBe(2);
  });

  test("counts a nested object literal as one member", () => {
    expect(countMembers("options: { retry: boolean; timeout: number }; other: string;")).toBe(2);
  });

  test("ignores a semicolon inside a string or comment", () => {
    expect(countMembers('label: ";"; // note;\nvalue: string;')).toBe(2);
  });

  test("counts a signature broken across lines once per line", () => {
    expect(countMembers("save(\n  u: User\n): void;")).toBe(3);
  });
});

describe("extractInterfaces", () => {
  test("returns an empty list when there is no interface", () => {
    expect(extractInterfaces("export function add(a, b) { return a + b; }")).toEqual([]);
  });

  test("extracts an interface with its member count and lines", () => {
    const [info] = extractInterfaces("interface User {\n  name: string;\n  age: number;\n}");

    expect(info?.name).toBe("User");
    expect(info?.kind).toBe("interface");
    expect(info?.memberCount).toBe(2);
    expect(info?.startLine).toBe(1);
    expect(info?.endLine).toBe(4);
    expect(info?.headerExcerpt).toBe("interface User");
  });

  test("extracts an interface with an extends clause", () => {
    const [info] = extractInterfaces("interface Admin extends User {\n  level: number;\n}");

    expect(info?.name).toBe("Admin");
    expect(info?.memberCount).toBe(1);
    expect(info?.headerExcerpt).toBe("interface Admin extends User");
  });

  test("extracts an object type literal", () => {
    const [info] = extractInterfaces("type Point = {\n  x: number;\n  y: number;\n};");

    expect(info?.name).toBe("Point");
    expect(info?.kind).toBe("type");
    expect(info?.memberCount).toBe(2);
  });

  test("skips a non-object type alias", () => {
    expect(extractInterfaces("type Name = string;")).toEqual([]);
  });

  test("extracts several constructs in source order", () => {
    const infos = extractInterfaces("type B = { x: number };\ninterface A {\n  y: string;\n}");

    expect(infos.map((info) => info.name)).toEqual(["B", "A"]);
  });

  test("skips an interface with unbalanced braces", () => {
    expect(extractInterfaces("interface Broken {")).toEqual([]);
  });
});
