import { describe, expect, test } from "bun:test";
import { extractClasses } from "./class-declaration.ts";

describe("extractClasses", () => {
  test("returns an empty array for source with no class", () => {
    expect(extractClasses("function foo() {}")).toEqual([]);
  });

  test("extracts a single class's name, location and body", () => {
    const source = "class Foo {\n  bar() {}\n}";
    const [declaration] = extractClasses(source);

    expect(declaration?.name).toBe("Foo");
    expect(declaration?.startLine).toBe(1);
    expect(declaration?.endLine).toBe(3);
    expect(declaration?.headerExcerpt).toBe("class Foo");
    expect(declaration?.body).toBe("\n  bar() {}\n");
  });

  test("extracts the header including extends/implements clauses", () => {
    const source = "class Foo extends Bar implements Baz {\n}";
    const [declaration] = extractClasses(source);

    expect(declaration?.headerExcerpt).toBe(
      "class Foo extends Bar implements Baz",
    );
  });

  test("extracts every class in a multi-class subject", () => {
    const source = "class A {}\nclass B {}";
    const declarations = extractClasses(source);

    expect(declarations.map((d) => d.name)).toEqual(["A", "B"]);
  });

  test("does not let a nested class break outer class boundary detection", () => {
    const source = "class Outer {\n  method() { class Inner {} }\n}\nclass After {}";
    const declarations = extractClasses(source);

    expect(declarations.map((d) => d.name)).toEqual(["Outer", "After"]);
  });

  test("ignores a brace inside a string literal when finding the class body end", () => {
    const source = 'class Foo {\n  bar() { return "}"; }\n}';
    const [declaration] = extractClasses(source);

    expect(declaration?.endLine).toBe(3);
  });

  test("skips an ambient class declaration with no body", () => {
    const source = "declare class Foo;\nclass Bar {}";
    const declarations = extractClasses(source);

    expect(declarations.map((d) => d.name)).toEqual(["Bar"]);
  });

  test("skips a class whose body never closes and reports nothing for it", () => {
    const source = "class Foo {\n  bar() {}";
    expect(extractClasses(source)).toEqual([]);
  });

  test("tolerates more than one space between the class keyword and its name", () => {
    const source = "class   Foo {}";
    const declarations = extractClasses(source);

    expect(declarations.map((d) => d.name)).toEqual(["Foo"]);
  });

  test("reports nothing when a class has neither a body nor a terminator, even if a later brace exists", () => {
    // No body and no ";" after "Foo": the class must be reported as skipped
    // rather than accidentally absorbing the unrelated trailing "}".
    const source = "class Foo\n}";
    expect(extractClasses(source)).toEqual([]);
  });

  test("does not let an ambient declaration's body search run into a later class's members", () => {
    const source = "declare class Foo;\n}\nclass Bar {}";
    const declarations = extractClasses(source);

    expect(declarations.map((d) => d.name)).toEqual(["Bar"]);
  });
});
