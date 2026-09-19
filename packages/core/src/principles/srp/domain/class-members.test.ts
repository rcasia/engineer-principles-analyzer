import { describe, expect, test } from "bun:test";
import { extractMethodNames } from "./class-members.ts";

describe("extractMethodNames", () => {
  test("returns an empty array for an empty class body", () => {
    expect(extractMethodNames("")).toEqual([]);
  });

  test("finds a single plain method", () => {
    expect(extractMethodNames("foo() {}")).toEqual(["foo"]);
  });

  test("finds every method in the body, in source order", () => {
    const body = "foo() {}\n  bar() {}\n  baz() {}";
    expect(extractMethodNames(body)).toEqual(["foo", "bar", "baz"]);
  });

  test("excludes the constructor", () => {
    expect(extractMethodNames("constructor() {}\n  foo() {}")).toEqual([
      "foo",
    ]);
  });

  test("strips access modifiers, async and static from the signature", () => {
    const body = "public async foo() {}\n  private static bar() {}";
    expect(extractMethodNames(body)).toEqual(["foo", "bar"]);
  });

  test("matches a getter and a setter by their underlying name", () => {
    const body = "get value() {}\n  set value(v) {}";
    expect(extractMethodNames(body)).toEqual(["value", "value"]);
  });

  test("matches a method with a return type annotation", () => {
    expect(extractMethodNames("foo(): number {}")).toEqual(["foo"]);
  });

  test("matches a generic method", () => {
    expect(extractMethodNames("foo<T>(value: T): T {}")).toEqual(["foo"]);
  });

  test("matches a decorated method", () => {
    expect(extractMethodNames('@Input()\n  foo() {}')).toEqual(["foo"]);
  });

  test("does not treat a field declaration as a method", () => {
    expect(extractMethodNames("count: number;\n  foo() {}")).toEqual(["foo"]);
  });

  test("does not treat an object-valued field initializer as a method", () => {
    const body = 'config = { a: 1 };\n  foo() {}';
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not treat an arrow-function class field as a method", () => {
    const body = "onClick = () => { doSomething(); };\n  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not descend into a method's own body for nested calls", () => {
    const body = "foo() {\n    items.forEach((item) => { use(item); });\n  }";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not mistake an if-statement for a method", () => {
    const body = "foo() {\n    if (this.ready) {\n      return;\n    }\n  }";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not mistake a for-loop for a method", () => {
    const body = "foo() {\n    for (let i = 0; i < 1; i += 1) {}\n  }";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not mistake a switch statement for a method", () => {
    const body = "foo() {\n    switch (this.state) {\n      default: break;\n    }\n  }";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not mistake a while-loop for a method", () => {
    const body = "foo() {\n    while (this.ready) {}\n  }";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not mistake a catch clause for a method", () => {
    const body = "foo() {\n    try {} catch (error) {}\n  }";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("ignores a brace inside a string within the class body", () => {
    const body = 'foo() { return "}"; }\n  bar() {}';
    expect(extractMethodNames(body)).toEqual(["foo", "bar"]);
  });

  test("ignores a method-shaped comment", () => {
    const body = "// notAMethod() {}\n  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not let a leading comment corrupt the following method's header", () => {
    const body = "// a note about foo\n  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not let a block comment inside the header corrupt matching", () => {
    const body = "foo(/* the id */ id) {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a bare decorator with no arguments", () => {
    const body = "@Input\n  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a decorator whose arguments contain real content", () => {
    const body = "@Input('name')\n  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a dotted decorator name", () => {
    const body = "@Component.Input()\n  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches more than one modifier separated by more than one space", () => {
    const body = "public  static  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a getter separated from its name by more than one space", () => {
    const body = "get  value() {}";
    expect(extractMethodNames(body)).toEqual(["value"]);
  });

  test("matches a generator method", () => {
    const body = "*foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a generic method with a constrained type parameter", () => {
    const body = "foo<T extends object>(value: T): T {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not match a header with unrecognised content trailing the parameter list", () => {
    // No ":" for a return-type clause to consume "unexpected", so a
    // correct signature match must fail outright rather than partially
    // matching up to the parameter list and ignoring the rest.
    const body = "foo() unexpected {}\n  bar() {}";
    expect(extractMethodNames(body)).toEqual(["bar"]);
  });

  test("matches a header even with a space before its generic parameter list", () => {
    const body = "foo <T>(value: T) {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a header even with a space between its generics and its parameter list", () => {
    const body = "foo<T>  (value: T) {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a header even with extra space before the return-type colon", () => {
    const body = "foo()  : number {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a return type with no space after the colon", () => {
    const body = "foo():number {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("matches a return type containing spaces, such as a union", () => {
    const body = "foo(): number | null {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not require every decorator to be followed by exactly one whitespace character", () => {
    // A decorator group with a blank line before the next decorator: any
    // amount of whitespace between decorators must be tolerated, not just
    // exactly one character.
    const body = "@A()\n\n  @B()\n  foo() {}";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("stops cleanly, without looping, when a method body never closes", () => {
    const body = "foo() { unterminated";
    expect(extractMethodNames(body)).toEqual(["foo"]);
  });

  test("does not treat a preceding unterminated field assignment as part of the next method's header", () => {
    // Real (anchored) matching only recognises "foo" as a method when the
    // *entire* preceding statement conforms to a signature; a dangling,
    // semicolon-less field assignment before it must not be silently
    // ignored by matching only a trailing fragment of the header text.
    const body = "count = 0\n  foo() {}";
    expect(extractMethodNames(body)).toEqual([]);
  });
});
