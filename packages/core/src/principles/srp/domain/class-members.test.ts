import { describe, expect, test } from "bun:test";
import { extractMethodNames } from "./class-members.ts";

describe("extractMethodNames", () => {
  test("returns an empty array for an empty class body", () => {
    expect(extractMethodNames("", "typescript", "")).toEqual([]);
  });

  test("finds a single plain method", () => {
    expect(extractMethodNames("foo() {}", "typescript", "")).toEqual(["foo"]);
  });

  test("finds every method in the body, in source order", () => {
    const body = "foo() {}\n  bar() {}\n  baz() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo", "bar", "baz"]);
  });

  test("excludes the constructor", () => {
    expect(extractMethodNames("constructor() {}\n  foo() {}", "typescript", "")).toEqual([
      "foo",
    ]);
  });

  test("strips access modifiers, async and static from the signature", () => {
    const body = "public async foo() {}\n  private static bar() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo", "bar"]);
  });

  test("matches a getter and a setter by their underlying name", () => {
    const body = "get value() {}\n  set value(v) {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["value", "value"]);
  });

  test("matches a method with a return type annotation", () => {
    expect(extractMethodNames("foo(): number {}", "typescript", "")).toEqual(["foo"]);
  });

  test("matches a generic method", () => {
    expect(extractMethodNames("foo<T>(value: T): T {}", "typescript", "")).toEqual(["foo"]);
  });

  test("matches a decorated method", () => {
    expect(extractMethodNames('@Input()\n  foo() {}', "typescript", "")).toEqual(["foo"]);
  });

  test("does not treat a field declaration as a method", () => {
    expect(extractMethodNames("count: number;\n  foo() {}", "typescript", "")).toEqual(["foo"]);
  });

  test("does not treat an object-valued field initializer as a method", () => {
    const body = 'config = { a: 1 };\n  foo() {}';
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not treat an arrow-function class field as a method", () => {
    const body = "onClick = () => { doSomething(); };\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not descend into a method's own body for nested calls", () => {
    const body = "foo() {\n    items.forEach((item) => { use(item); });\n  }";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not mistake an if-statement for a method", () => {
    const body = "foo() {\n    if (this.ready) {\n      return;\n    }\n  }";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not mistake a for-loop for a method", () => {
    const body = "foo() {\n    for (let i = 0; i < 1; i += 1) {}\n  }";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not mistake a switch statement for a method", () => {
    const body = "foo() {\n    switch (this.state) {\n      default: break;\n    }\n  }";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not mistake a while-loop for a method", () => {
    const body = "foo() {\n    while (this.ready) {}\n  }";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not mistake a catch clause for a method", () => {
    const body = "foo() {\n    try {} catch (error) {}\n  }";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("ignores a brace inside a string within the class body", () => {
    const body = 'foo() { return "}"; }\n  bar() {}';
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo", "bar"]);
  });

  test("ignores a method-shaped comment", () => {
    const body = "// notAMethod() {}\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not let a leading comment corrupt the following method's header", () => {
    const body = "// a note about foo\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not let a block comment inside the header corrupt matching", () => {
    const body = "foo(/* the id */ id) {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a bare decorator with no arguments", () => {
    const body = "@Input\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a decorator whose arguments contain real content", () => {
    const body = "@Input('name')\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a dotted decorator name", () => {
    const body = "@Component.Input()\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches more than one modifier separated by more than one space", () => {
    const body = "public  static  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches three modifiers separated by more than one space", () => {
    const body = "public  static  readonly  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a getter separated from its name by more than one space", () => {
    const body = "get  value() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["value"]);
  });

  test("matches a generator method", () => {
    const body = "*foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a generic method with a constrained type parameter", () => {
    const body = "foo<T extends object>(value: T): T {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not match a header with unrecognised content trailing the parameter list", () => {
    // No ":" for a return-type clause to consume "unexpected", so a
    // correct signature match must fail outright rather than partially
    // matching up to the parameter list and ignoring the rest.
    const body = "foo() unexpected {}\n  bar() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["bar"]);
  });

  test("matches a header even with a space before its generic parameter list", () => {
    const body = "foo <T>(value: T) {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a header even with a space between its generics and its parameter list", () => {
    const body = "foo<T>  (value: T) {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a header even with extra space before the return-type colon", () => {
    const body = "foo()  : number {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a return type with no space after the colon", () => {
    const body = "foo():number {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("matches a return type containing spaces, such as a union", () => {
    const body = "foo(): number | null {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not require every decorator to be followed by exactly one whitespace character", () => {
    // A decorator group with a blank line before the next decorator: any
    // amount of whitespace between decorators must be tolerated, not just
    // exactly one character.
    const body = "@A()\n\n  @B()\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("stops cleanly, without looping, when a method body never closes", () => {
    const body = "foo() { unterminated";
    expect(extractMethodNames(body, "typescript", "")).toEqual(["foo"]);
  });

  test("does not treat a preceding unterminated field assignment as part of the next method's header", () => {
    // Real (anchored) matching only recognises "foo" as a method when the
    // *entire* preceding statement conforms to a signature; a dangling,
    // semicolon-less field assignment before it must not be silently
    // ignored by matching only a trailing fragment of the header text.
    const body = "count = 0\n  foo() {}";
    expect(extractMethodNames(body, "typescript", "")).toEqual([]);
  });

  test("matches a Java method with a return type", () => {
    expect(extractMethodNames("public void save(User user) {}", "typescript", "")).toEqual([
      "save",
    ]);
  });

  test("matches a Java method with a primitive return type and modifiers", () => {
    expect(extractMethodNames("private static int calculate() {}", "typescript", "")).toEqual([
      "calculate",
    ]);
  });

  test("matches a Java method declaring a throws clause", () => {
    expect(
      extractMethodNames("public void save() throws IOException {}", "typescript", ""),
    ).toEqual(["save"]);
  });

  test("matches a method whose name merely starts with get", () => {
    expect(extractMethodNames("getvalue() {}", "typescript", "")).toEqual(["getvalue"]);
  });

  test("matches a Java generic method with several type parameters", () => {
    expect(extractMethodNames("public <T, U> void put(T key, U value) {}", "typescript", "")).toEqual([
      "put",
    ]);
  });

  test("matches a Java generic method with no space after its type parameter list", () => {
    expect(extractMethodNames("public <T>void foo(T value) {}", "typescript", "")).toEqual([
      "foo",
    ]);
  });

  test("matches a Java method whose generic return type holds a type argument", () => {
    expect(extractMethodNames("List<string> foo() {}", "typescript", "")).toEqual(["foo"]);
  });

  test("matches a Java method with more than one space after its return type", () => {
    expect(extractMethodNames("void  save() {}", "typescript", "")).toEqual(["save"]);
  });

  test("matches a Java method with more than one space around its throws keyword", () => {
    expect(extractMethodNames("public void save()  throws  IOException {}", "typescript", "")).toEqual([
      "save",
    ]);
  });

  test("matches a Java method declaring several thrown types", () => {
    expect(
      extractMethodNames("public void save() throws IOException, SQLException {}", "typescript", ""),
    ).toEqual(["save"]);
  });

  test("matches the Java entry point with an array parameter", () => {
    expect(
      extractMethodNames("public static void main(String[] args) {}", "typescript", ""),
    ).toEqual(["main"]);
  });

  test("excludes a Java constructor spelled as the class name", () => {
    const body = "public UserManager() {}\n  public void save() {}";
    expect(extractMethodNames(body, "java", "UserManager")).toEqual(["save"]);
  });

  test("excludes a method named __init__ without a language", () => {
    expect(extractMethodNames("__init__() {}\n  foo() {}", "typescript", "")).toEqual(["foo"]);
  });

  test("excludes a same-named method when the class name is given", () => {
    expect(extractMethodNames("Foo() {}", "", "Foo")).toEqual([]);
  });

  test("still rejects trailing content after the parameter list", () => {
    expect(extractMethodNames("public void save() unexpected {}", "typescript", "")).toEqual([]);
  });

  describe("python def lines", () => {
    test("finds every def in the body", () => {
      const body = "    def save(self):\n        pass\n    def load(self):\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["save", "load"]);
    });

    test("is selected case-insensitively", () => {
      expect(extractMethodNames("    def save(self):\n", "Python", "")).toEqual([
        "save",
      ]);
    });

  test("finds an async def separated from its name by more than one space", () => {
      const body = "    async  def fetch(self, url):\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["fetch"]);
    });

    test("finds a def separated from its name by more than one space", () => {
      const body = "    def  save(self):\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["save"]);
    });

    test("finds a def with a space before its parameter list", () => {
      const body = "    def save (self):\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["save"]);
    });

    test("ignores a def inside a comment line", () => {
      const body = "    # def fake(self):\n        pass\n    def save(self):\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["save"]);
    });

    test("excludes a def literally named constructor", () => {
      const body =
        "    def constructor(self):\n        pass\n    def save(self):\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["save"]);
    });

    test("reads python despite surrounding whitespace in the language name", () => {
      expect(extractMethodNames("    def save(self):\n", " python ", "")).toEqual([
        "save",
      ]);
    });

    test("excludes the __init__ constructor", () => {
      const body = "    def __init__(self):\n        pass\n    def save(self):\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["save"]);
    });

    test("excludes a def nested inside another method", () => {
      const body =
        "    def save(self):\n        def helper():\n            pass\n        pass\n";
      expect(extractMethodNames(body, "python", "")).toEqual(["save"]);
    });

    test("excludes a def named after the class", () => {
      const body = "    def Thing(self):\n        pass\n    def save(self):\n        pass\n";
      expect(extractMethodNames(body, "python", "Thing")).toEqual(["save"]);
    });

    test("returns an empty array when the body defines nothing", () => {
      expect(extractMethodNames("    x = 1\n", "python", "")).toEqual([]);
    });
  });
});
