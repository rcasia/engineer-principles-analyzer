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

  test("tolerates more than one space between class and its name", () => {
    const [info] = extractClasses("class  Animal {\n  speak() {}\n}");

    expect(info?.name).toBe("Animal");
    expect(info?.headerExcerpt).toBe("class  Animal");
  });

  test("tolerates more than one space before extends", () => {
    const [info] = extractClasses("class Dog  extends Animal {\n  speak() {}\n}");

    expect(info?.name).toBe("Dog");
    expect(info?.parent).toBe("Animal");
  });

  test("tolerates more than one space after extends", () => {
    const [info] = extractClasses("class Dog extends  Animal {\n  speak() {}\n}");

    expect(info?.name).toBe("Dog");
    expect(info?.parent).toBe("Animal");
  });

  test("extracts several classes in order", () => {
    const infos = extractClasses("class A {}\nclass B extends A {}");

    expect(infos.map((info) => info.name)).toEqual(["A", "B"]);
  });

  test("skips an ambient declaration with no body", () => {
    expect(extractClasses("declare class Foo;")).toEqual([]);
  });

  test("skips an ambient declaration even when a later class has a body", () => {
    const infos = extractClasses("declare class Foo; class Bar {\n  m() {}\n}");

    expect(infos.map((info) => info.name)).toEqual(["Bar"]);
  });

  test("skips an ambient declaration followed by a stray brace", () => {
    expect(extractClasses("declare class A; }")).toEqual([]);
  });

  test("skips an ambient declaration after a stray brace", () => {
    expect(extractClasses("} declare class A;")).toEqual([]);
  });

  test("skips a truncated class followed by a stray brace", () => {
    expect(extractClasses("class NoBody }")).toEqual([]);
  });

  test("skips a class with unbalanced braces", () => {
    expect(extractClasses("class Broken {")).toEqual([]);
  });

  test("does not mistake a brace inside a string for the body end", () => {
    const [info] = extractClasses('class Foo {\n  bar() { return "a}b"; }\n}');

    expect(info?.endLine).toBe(3);
  });

  test("does not mistake a brace inside a single-quoted string for the body end", () => {
    const [info] = extractClasses("class Foo {\n  bar() { return 'a}b'; }\n}");

    expect(info?.endLine).toBe(3);
  });

  test("does not mistake a brace inside a template literal for the body end", () => {
    const [info] = extractClasses("class Foo {\n  bar() { return `a}b`; }\n}");

    expect(info?.endLine).toBe(3);
  });

  test("skips an escaped quote inside a string when finding the body end", () => {
    const [info] = extractClasses('class Foo {\n  bar() { return "a\\"}b"; }\n}');

    expect(info?.endLine).toBe(3);
  });

  test("skips an escape at the start of a string when finding the body end", () => {
    const [info] = extractClasses('class Foo {\n  bar() { return "\\}b"; }\n}');

    expect(info?.endLine).toBe(3);
  });

  test("ignores braces inside a block comment", () => {
    const [info] = extractClasses("class A {\n m() { /* x } */ return 1; }\n}");

    expect(info?.endLine).toBe(3);
    expect(
      methodBodiesOf(info?.body as string).map((method) => method.name),
    ).toEqual(["m"]);
  });

  test("reads the body past a comment that itself contains a brace", () => {
    const [info] = extractClasses("class A /* { */ { m() { return 1; } }");

    expect(info?.body).toBe(" m() { return 1; } ");
  });

  test("does not let a second block comment search run backward into the first closer", () => {
    const [info] = extractClasses(
      "class A {\n m() { /*A*//*B*/ return 1; }\n}",
    );

    expect(info?.endLine).toBe(3);
    expect(
      methodBodiesOf(info?.body as string).map((method) => method.name),
    ).toEqual(["m"]);
  });

  test("does not mistake a division slash for a line comment", () => {
    const methods = methodBodiesOf(
      extractClasses("class A { calc() { return a / b; } }")[0]?.body as string,
    );

    expect(methods.map((method) => method.name)).toEqual(["calc"]);
  });

  test("does not mistake a multiplication star for a block comment", () => {
    const methods = methodBodiesOf(
      extractClasses("class A { m() { return a * b; } }")[0]?.body as string,
    );

    expect(methods.map((method) => method.name)).toEqual(["m"]);
  });

  test("keeps scanning past a terminated line comment", () => {
    const infos = extractClasses(
      "class A { m() { return 1; } } // done\nclass B { n() { return 2; } }",
    );

    expect(infos.map((info) => info.name)).toEqual(["A", "B"]);
  });

  test("treats a line comment running to the end of input as extending to the end", () => {
    expect(extractClasses("class A { m() { return 1; } // trailing")).toEqual([]);
  });

  test("finds a class whose body closes before a trailing line comment", () => {
    const infos = extractClasses("class A { m() { return 1; } // done\n}");

    expect(infos.map((info) => info.name)).toEqual(["A"]);
  });

  test("finds a class whose body closes before a trailing block comment", () => {
    const infos = extractClasses("class A { m() { return 1; } /* x */ }");

    expect(infos.map((info) => info.name)).toEqual(["A"]);
  });

  test("treats an unterminated block comment as running to the end", () => {
    expect(extractClasses("class A { m() { return 1; } /* never ends")).toEqual([]);
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

  test("resets the header after a field initializer", () => {
    const methods = methodBodiesOf("count = 0;\nspeak() { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("skips a method with unbalanced braces", () => {
    expect(methodBodiesOf("speak() { return 1; ")).toEqual([]);
  });

  test("does not read a trailing call-like suffix as a method", () => {
    expect(methodBodiesOf("greet loudly() { cheer(); }")).toEqual([]);
  });

  test("does not read trailing words after the parameters as a method", () => {
    expect(methodBodiesOf("speak() unexpected { return 1; }")).toEqual([]);
  });

  test("reads a decorated method", () => {
    const methods = methodBodiesOf("@sealed speak() { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("reads a decorated method separated by more than one space", () => {
    const methods = methodBodiesOf("@Dec  speak() { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("reads a method with a decorator call", () => {
    const methods = methodBodiesOf("@Dec(ab) speak() { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("reads a method with a visibility modifier", () => {
    const methods = methodBodiesOf("public speak() { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("reads a getter by its property name", () => {
    const methods = methodBodiesOf("get value() { return this.x; }");

    expect(methods.map((method) => method.name)).toEqual(["value"]);
  });

  test("reads a setter by its property name", () => {
    const methods = methodBodiesOf("set value(v) { this.x = v; }");

    expect(methods.map((method) => method.name)).toEqual(["value"]);
  });

  test("reads a generic method", () => {
    const methods = methodBodiesOf("fetch<TUser>() { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["fetch"]);
  });

  test("reads a generic method separated from its type list by a space", () => {
    const methods = methodBodiesOf("fetch <T>() { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["fetch"]);
  });

  test("reads a generic method separated from its parameters by a space", () => {
    const methods = methodBodiesOf("fetch<T> () { return 1; }");

    expect(methods.map((method) => method.name)).toEqual(["fetch"]);
  });

  test("reads a method with untyped parameters", () => {
    const methods = methodBodiesOf("speak(id) { return id; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
    expect(methods[0]?.body).toBe(" return id; ");
  });

  test("reads a method with typed parameters", () => {
    const methods = methodBodiesOf("speak(id: string) { return id; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("reads a method with a spaced return type", () => {
    const methods = methodBodiesOf("speak() : User { return u; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("reads a method with an unspaced return type", () => {
    const methods = methodBodiesOf("speak():User { return u; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
  });

  test("reads a method with a multi-character return type", () => {
    const methods = methodBodiesOf("speak(): User { return u; }");

    expect(methods.map((method) => method.name)).toEqual(["speak"]);
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

  test("ignores throw inside a single-quoted string", () => {
    expect(bodyThrows(" return 'throw'; ")).toBe(false);
  });

  test("ignores throw inside a template literal", () => {
    expect(bodyThrows(" return `throw`; ")).toBe(false);
  });

  test("does not let a slash eat the throw before it", () => {
    expect(bodyThrows("throw/x")).toBe(true);
  });

  test("still finds a throw after a division", () => {
    expect(bodyThrows("a / b; throw e;")).toBe(true);
  });

  test("ignores throw inside a block comment", () => {
    expect(bodyThrows("/* throw */")).toBe(false);
  });

  test("still finds a throw separated from its target by a comment", () => {
    expect(bodyThrows("throw/*c*/x")).toBe(true);
  });

  test("ignores throw inside a comment", () => {
    expect(bodyThrows(" // throw\n return 1; ")).toBe(false);
  });

  test("does not match identifiers that merely contain throw", () => {
    expect(bodyThrows(" rethrow(x); ")).toBe(false);
  });
});
