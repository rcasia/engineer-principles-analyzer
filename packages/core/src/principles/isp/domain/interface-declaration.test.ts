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

  test("counts a trailing unterminated brace as part of the final fragment", () => {
    expect(countMembers("a: {")).toBe(1);
  });

  test("ignores a semicolon inside a longer string", () => {
    expect(countMembers('label: "ab;cd";\nvalue: string;')).toBe(2);
  });

  test("counts a signature broken across lines once per line", () => {
    expect(countMembers("save(\n  u: User\n): void;")).toBe(3);
  });

  test("counts a nested object literal split across lines as two members", () => {
    expect(countMembers("options: {\n  x: number\n}\nother: string;")).toBe(2);
  });

  test("does not mistake a division slash for a line comment", () => {
    expect(countMembers("ratio: 1 / 2;\nvalue: string;")).toBe(2);
  });

  test("skips a line comment at the very start of the scanned body", () => {
    expect(countMembers("// note;\nvalue: string;")).toBe(1);
  });

  test("treats a line comment running to the end of input as extending to the end", () => {
    expect(countMembers("value: string; // trailing")).toBe(1);
  });

  test("does not mistake a multiplication star for a block comment", () => {
    expect(countMembers("ratio: a * b;\nvalue: string;")).toBe(2);
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

  test("tolerates more than one space between interface and its name", () => {
    const [info] = extractInterfaces("interface  User {\n  name: string;\n}");

    expect(info?.name).toBe("User");
    expect(info?.memberCount).toBe(1);
    expect(info?.headerExcerpt).toBe("interface  User");
  });

  test("tolerates more than one space between type and its name", () => {
    const [info] = extractInterfaces("type  Point = {\n  x: number;\n};");

    expect(info?.name).toBe("Point");
    expect(info?.kind).toBe("type");
    expect(info?.memberCount).toBe(1);
  });

  test("tolerates no space before the equals in a type literal", () => {
    const [info] = extractInterfaces("type Point= {\n  x: number;\n};");

    expect(info?.name).toBe("Point");
    expect(info?.memberCount).toBe(1);
  });

  test("tolerates more than one space after the equals in a type literal", () => {
    const [info] = extractInterfaces("type Point =  {\n  x: number;\n};");

    expect(info?.name).toBe("Point");
    expect(info?.memberCount).toBe(1);
  });

  test("reports the type header up to its opening brace", () => {
    const [info] = extractInterfaces("type Point = {\n  x: number;\n  y: number;\n};");

    expect(info?.headerExcerpt).toBe("type Point =");
  });

  test("ignores braces and semicolons inside single-quoted strings", () => {
    const [info] = extractInterfaces("interface A {\n  label: '}';\n  x: number;\n}");

    expect(info?.memberCount).toBe(2);
    expect(info?.endLine).toBe(4);
  });

  test("ignores braces and semicolons inside template literals", () => {
    const [info] = extractInterfaces("interface A {\n  label: `}`;\n  x: number;\n}");

    expect(info?.memberCount).toBe(2);
    expect(info?.endLine).toBe(4);
  });

  test("skips an escaped quote inside a string when finding the body end", () => {
    const [info] = extractInterfaces('interface A {\n  label: "ab\\"cd";\n  x: number;\n}');

    expect(info?.memberCount).toBe(2);
    expect(info?.endLine).toBe(4);
  });

  test("ignores braces and semicolons inside a block comment", () => {
    const [info] = extractInterfaces("interface A {\n  /* hidden } ; */\n  x: number;\n}");

    expect(info?.memberCount).toBe(1);
    expect(info?.endLine).toBe(4);
  });

  test("does not resume inside a block comment that ends with a brace", () => {
    const [info] = extractInterfaces("interface A {\n  /* }*/\n  x: number;\n}");

    expect(info?.memberCount).toBe(1);
    expect(info?.endLine).toBe(4);
  });

  test("treats an unterminated block comment as running to the end", () => {
    expect(extractInterfaces("interface A { /* } }")).toEqual([]);
  });

  test("does not let a block-comment search run backward into an earlier closer", () => {
    expect(extractInterfaces("interface A {\n  x: number; */ /* \n  y: number;\n}")).toEqual([]);
  });

  test("searches a block-comment closer forward, never backward", () => {
    // The stray `*/` before the opener must not satisfy the search: the
    // comment runs to the end of input, swallowing the closing brace.
    expect(extractInterfaces("interface A {\n  a: b */* c;\n  x: number;\n}")).toEqual([]);
  });

  test("does not mistake a line comment ending at a block opener for a block comment", () => {
    // The `//` wins: everything through the newline is a line comment, so the
    // later `}` still closes the interface. The stray `*` forms its own
    // fragment, hence three members, not two.
    const [info] = extractInterfaces("interface A {\n  x: number; *//*\n  y: number;\n}");

    expect(info?.memberCount).toBe(3);
    expect(info?.endLine).toBe(4);
  });

  test("matches the correct closing brace with nested object literals", () => {
    const [info] = extractInterfaces("interface A {\n  options: { x: number };\n  y: string;\n}");

    expect(info?.memberCount).toBe(2);
    expect(info?.endLine).toBe(4);
  });

  test("skips an interface forward declaration terminated by a semicolon", () => {
    const infos = extractInterfaces("interface A;\ninterface B {\n  x: number;\n}");

    expect(infos.map((info) => info.name)).toEqual(["B"]);
  });

  test("does not treat a stray closing brace as a forward-declared body", () => {
    expect(extractInterfaces("interface A; }")).toEqual([]);
  });

  test("skips an interface with neither a body nor a terminator", () => {
    expect(extractInterfaces("interface A\n}")).toEqual([]);
  });
});
