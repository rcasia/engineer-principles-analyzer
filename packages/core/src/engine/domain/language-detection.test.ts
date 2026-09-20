import { describe, expect, test } from "bun:test";
import {
  detectLanguage,
  languageForFilename,
  languageForSource,
} from "./language-detection.ts";

describe("languageForFilename", () => {
  test.each([
    ["main.ts", "typescript"],
    ["component.tsx", "typescript"],
    ["module.mts", "typescript"],
    ["legacy.cts", "typescript"],
    ["app.js", "javascript"],
    ["view.jsx", "javascript"],
    ["bundle.mjs", "javascript"],
    ["legacy.cjs", "javascript"],
    ["script.py", "python"],
    ["tool.pyw", "python"],
    ["main.go", "go"],
    ["lib.rs", "rust"],
    ["Main.java", "java"],
  ])("maps %p to %p", (filename, expected) => {
    expect(languageForFilename(filename)).toBe(expected);
  });

  test("matches extensions case-insensitively", () => {
    expect(languageForFilename("Main.TS")).toBe("typescript");
    expect(languageForFilename("APP.PY")).toBe("python");
  });

  test("ignores directory prefixes", () => {
    expect(languageForFilename("src/app/main.go")).toBe("go");
    expect(languageForFilename("src\\app\\lib.rs")).toBe("rust");
  });

  test("only the final extension counts", () => {
    expect(languageForFilename("archive.tar.gz")).toBe(undefined);
  });

  test.each([[".gitignore"], [".py"], ["Makefile"], [""], ["trailing."]])(
    "returns undefined for %p, which has no usable extension",
    (filename) => {
      expect(languageForFilename(filename)).toBe(undefined);
    },
  );

  test("returns undefined for an unknown extension", () => {
    expect(languageForFilename("notes.txt")).toBe(undefined);
  });
});

describe("languageForSource", () => {
  test.each([
    ["public class Main {}", "java"],
    ["System.out.println(\"hi\");", "java"],
    ["import java.util.List;", "java"],
    ["package main", "go"],
    ["func main() {", "go"],
    ["fmt.Println(x)", "go"],
    ["println!(\"hi\");", "rust"],
    ["let mut count = 0;", "rust"],
    ["fn main() {", "rust"],
    ["def greet(name):", "python"],
    ["print(\"hello\")", "python"],
    ["if __name__ == \"__main__\":", "python"],
    ["    elif done:", "python"],
    ["interface User {", "typescript"],
    ["type Id = string;", "typescript"],
    ["function f(name: string) {", "typescript"],
    ["readonly count = 1;", "typescript"],
    ["export interface Shape {", "typescript"],
    ["console.log(\"hi\");", "javascript"],
    ["const x = require(\"fs\");", "javascript"],
    ["module.exports = x;", "javascript"],
    ["function greet(name) {", "javascript"],
  ])("detects %p as %p", (source, expected) => {
    expect(languageForSource(source)).toBe(expected);
  });

  test("is case-sensitive: uppercase java keywords do not match", () => {
    expect(languageForSource("PUBLIC CLASS Main {}")).toBe(undefined);
  });

  test.each([
    ["public  class  Main {}", "java"],
    ["import  java.util.List;", "java"],
    ["package  main", "go"],
    ["func  main() {", "go"],
    ["func main () {", "go"],
    ["let  mut  count = 0;", "rust"],
    ["fn  main() {", "rust"],
    ["fn main () {", "rust"],
    [`println! ("hi");`, "rust"],
    ["def  greet(name):", "python"],
    ["  def greet(name):", "python"],
    ["def greet (name):", "python"],
    [`print ("hello")`, "python"],
    [`if  __name__ == "__main__":`, "python"],
    [`if __name__=="__main__":`, "python"],
    ["interface  User {", "typescript"],
    ["type  Id= string;", "typescript"],
    ["f(x:  string) {", "typescript"],
    ["export  interface {", "typescript"],
    [`console.log ("hi");`, "javascript"],
    [`const x = require ("fs");`, "javascript"],
    ["function  greet(name) {", "javascript"],
    ["function greet (name) {", "javascript"],
  ])("still detects %p as %p when spacing varies", (source, expected) => {
    expect(languageForSource(source)).toBe(expected);
  });

  test.each([["call package main"], ["call def foo(x):"], ["done elif waiting:"]])(
    "does not match %p, whose signal starts mid-line",
    (source) => {
      expect(languageForSource(source)).toBe(undefined);
    },
  );

  test("returns undefined for an empty source", () => {
    expect(languageForSource("")).toBe(undefined);
  });

  test("returns undefined for ambiguous code with no distinctive signal", () => {
    expect(languageForSource("class Foo {}")).toBe(undefined);
    expect(languageForSource("hello world")).toBe(undefined);
  });

  test("prefers java over typescript when both match", () => {
    expect(
      languageForSource("public class Main {}\ninterface Shape {"),
    ).toBe("java");
  });

  test("prefers go over python when both match", () => {
    expect(languageForSource("package main\ndef greet(name):")).toBe("go");
  });

  test("prefers rust over python when both match", () => {
    expect(languageForSource("fn main() {\n    print(\"hi\")\n}")).toBe("rust");
  });

  test("prefers python over typescript when both match", () => {
    expect(languageForSource("def f(x):\n    y: string = x")).toBe("python");
  });

  test("prefers typescript over javascript when both match", () => {
    expect(
      languageForSource("interface Shape {}\nconsole.log(x);"),
    ).toBe("typescript");
  });
});

describe("detectLanguage", () => {
  test("prefers the filename extension over conflicting content", () => {
    expect(detectLanguage("public class Main {}", "app.py")).toBe("python");
  });

  test("falls back to content when no filename is given", () => {
    expect(detectLanguage("package main")).toBe("go");
    expect(detectLanguage("package main", undefined)).toBe("go");
  });

  test.each([[""], ["   "]])(
    "treats %p as no filename and falls back to content",
    (filenameHint) => {
      expect(detectLanguage("package main", filenameHint)).toBe("go");
    },
  );

  test("falls back to content when the extension is unknown", () => {
    expect(detectLanguage("package main", "notes.txt")).toBe("go");
  });

  test("detects from the filename even when the source is empty", () => {
    expect(detectLanguage("", "main.py")).toBe("python");
  });

  test("returns undefined when neither filename nor content is recognised", () => {
    expect(detectLanguage("hello world", "notes.txt")).toBe(undefined);
    expect(detectLanguage("hello world")).toBe(undefined);
  });
});
