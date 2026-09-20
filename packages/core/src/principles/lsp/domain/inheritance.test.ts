import { describe, expect, test } from "bun:test";
import {
  bodyThrows,
  extractClasses,
  methodBodiesOf,
} from "./inheritance.ts";

describe("extractClasses", () => {
  test("returns an empty list when there is no class", () => {
    expect(extractClasses("export function add(a, b) { return a + b; }")).toEqual([]);
  });

  test("extracts a plain class with no parent", () => {
    const [info] = extractClasses("class Animal {\n  speak() {}\n}");

    expect(info?.name).toBe("Animal");
    expect(info?.parent).toBeUndefined();
    expect(info?.startLine).toBe(1);
    expect(info?.endLine).toBe(3);
    expect(info?.headerExcerpt).toBe("class Animal");
  });

  test("extracts the extends target of a subclass", () => {
    const [info] = extractClasses("class Dog extends Animal {\n  speak() {}\n}");

    expect(info?.name).toBe("Dog");
    expect(info?.parent).toBe("Animal");
    expect(info?.headerExcerpt).toBe("class Dog extends Animal");
  });

  test("extracts several classes in order", () => {
    const infos = extractClasses("class A {}\nclass B extends A {}");

    expect(infos.map((info) => info.name)).toEqual(["A", "B"]);
  });

  test("skips an ambient declaration with no body", () => {
    expect(extractClasses("declare class Foo;")).toEqual([]);
  });

  test("skips a class with unbalanced braces", () => {
    expect(extractClasses("class Broken {")).toEqual([]);
  });

  test("does not mistake a brace inside a string for the body end", () => {
    const [info] = extractClasses('class Foo {\n  bar() { return "}"; }\n}');

    expect(info?.endLine).toBe(3);
  });
});

describe("methodBodiesOf", () => {
  test("returns method names with their bodies", () => {
    const methods = methodBodiesOf("speak() { return 1; }\nfly() { return 2; }");

    expect(methods.map((method) => method.name)).toEqual(["speak", "fly"]);
    expect(methods[0]?.body).toBe(" return 1; ");
  });

  test("excludes the constructor", () => {
    const methods = methodBodiesOf(
      "constructor() { this.x = 1; }\nspeak() { return 1; }",
    );

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("does not read a nested callback as a second method", () => {
    const methods = methodBodiesOf(
      "speak() { items.forEach(function each(item) { talk(item); }); }",
    );

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("does not match class-field arrow functions", () => {
    expect(methodBodiesOf("onClick = () => { fire(); }")).toEqual([]);
  });
});

describe("bodyThrows", () => {
  test("finds a plain throw", () => {
    expect(bodyThrows(" throw new Error('nope'); ")).toBe(true);
  });

  test("is false without a throw", () => {
    expect(bodyThrows(" return 1; ")).toBe(false);
  });

  test("ignores throw inside a string", () => {
    expect(bodyThrows(' return "throw"; ')).toBe(false);
  });

  test("ignores throw inside a comment", () => {
    expect(bodyThrows(" // throw\n return 1; ")).toBe(false);
  });

  test("does not match identifiers that merely contain throw", () => {
    expect(bodyThrows(" rethrow(x); ")).toBe(false);
  });
});
