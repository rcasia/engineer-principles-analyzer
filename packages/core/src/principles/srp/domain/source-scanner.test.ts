import { describe, expect, test } from "bun:test";
import {
  findMatchingBrace,
  findNextUnquotedBrace,
  lineOf,
  nextSignificantIndex,
  stripComments,
} from "./source-scanner.ts";

describe("nextSignificantIndex", () => {
  test("advances by one past a plain character", () => {
    expect(nextSignificantIndex("abc", 0)).toBe(1);
  });

  test("skips a double-quoted string, including an escaped quote inside it", () => {
    const code = '"a\\"b"c';
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe('"a\\"b"');
    expect(code[result]).toBe("c");
  });

  test("skips a single-quoted string", () => {
    const code = "'{'x";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("'{'");
    expect(code[result]).toBe("x");
  });

  test("returns the string length for an unterminated double-quoted string", () => {
    const code = '"unterminated';
    expect(nextSignificantIndex(code, 0)).toBe(code.length);
  });

  test("skips a template literal with no interpolation", () => {
    const code = "`{}`x";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`{}`");
    expect(code[result]).toBe("x");
  });

  test("skips a template literal whose interpolation itself contains braces", () => {
    const code = "`a${ { x: 1 } }b`x";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`a${ { x: 1 } }b`");
    expect(code[result]).toBe("x");
  });

  test("returns the string length for an unterminated template literal", () => {
    const code = "`unterminated";
    expect(nextSignificantIndex(code, 0)).toBe(code.length);
  });

  test("skips a line comment up to but not past the newline", () => {
    const code = "// { comment }\nx";
    const result = nextSignificantIndex(code, 0);
    expect(code[result]).toBe("\n");
  });

  test("treats a line comment with no trailing newline as running to the end", () => {
    const code = "// comment";
    expect(nextSignificantIndex(code, 0)).toBe(code.length);
  });

  test("skips a block comment", () => {
    const code = "/* { comment } */x";
    const result = nextSignificantIndex(code, 0);
    expect(code[result]).toBe("x");
    expect(code.slice(0, result)).toBe("/* { comment } */");
  });

  test("treats an unterminated block comment as running to the end", () => {
    const code = "/* unterminated";
    expect(nextSignificantIndex(code, 0)).toBe(code.length);
  });

  test("does not let a second block comment's search be misled by the first comment's closer", () => {
    // "/*A*/" ends right where "/*B*/" begins: a search that looked
    // backward from the second comment's start would immediately find the
    // first comment's own "*/" and (wrongly) end the second comment before
    // it began.
    const code = "/*A*//*B*/x";
    const afterFirst = nextSignificantIndex(code, 0);
    expect(code.slice(0, afterFirst)).toBe("/*A*/");

    const afterSecond = nextSignificantIndex(code, afterFirst);
    expect(code.slice(afterFirst, afterSecond)).toBe("/*B*/");
    expect(code[afterSecond]).toBe("x");
  });

  test("skips an escaped backtick inside a template literal rather than treating it as the closer", () => {
    const code = "`a\\`b`c";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`a\\`b`");
    expect(code[result]).toBe("c");
  });

  test("does not treat a single slash as the start of a comment", () => {
    const code = "a / b";
    expect(nextSignificantIndex(code, 2)).toBe(3);
  });

  test("does not treat a star following a non-slash as a block comment", () => {
    // Only "/" can open a block comment: the "*" at index 1 must not send
    // index 0 down the block-comment path even though a "*/" exists later.
    const code = "a*/ b";
    expect(nextSignificantIndex(code, 0)).toBe(1);
  });

  test("does not treat a dollar not followed by an opening brace as interpolation", () => {
    const code = "`a$b`c";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`a$b`");
    expect(code[result]).toBe("c");
  });

  test("does not treat an opening brace preceded by a non-dollar as interpolation", () => {
    const code = "`a{b`c";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`a{b`");
    expect(code[result]).toBe("c");
  });

  test("does not mistake a star for an interpolation opener", () => {
    const code = "`a{$b`c";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`a{$b`");
    expect(code[result]).toBe("c");
  });

  test("tracks interpolation through a nested template literal", () => {
    // The backticks inside "${ ... }" belong to the nested template: only
    // the final backtick, at interpolation depth zero, closes the outer one.
    const code = "`${`a`}b`c";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`${`a`}b`");
    expect(code[result]).toBe("c");
  });

  test("still closes interpolation tracking on its brace, not on a stray backtick", () => {
    // A backtick while interpolation depth is above zero must not close the
    // template early: the "}" has to bring the depth back down first.
    const code = "`${a`b`}`c";
    const result = nextSignificantIndex(code, 0);
    expect(code.slice(0, result)).toBe("`${a`b`}`");
    expect(code[result]).toBe("c");
  });
});

describe("findNextUnquotedBrace", () => {
  test("finds a brace that follows immediately", () => {
    expect(findNextUnquotedBrace("{}", 0)).toBe(0);
  });

  test("skips over a string containing a brace to find the real one", () => {
    const code = '"{" {}';
    expect(findNextUnquotedBrace(code, 0)).toBe(code.indexOf("{}"));
  });

  test("skips over a comment containing a brace to find the real one", () => {
    const code = "// { \n {}";
    expect(findNextUnquotedBrace(code, 0)).toBe(code.indexOf("{}"));
  });

  test("returns -1 when no brace exists", () => {
    expect(findNextUnquotedBrace("no braces here", 0)).toBe(-1);
  });
});

describe("findMatchingBrace", () => {
  test("matches an immediately-closing brace", () => {
    const code = "{}";
    expect(findMatchingBrace(code, 0)).toBe(1);
  });

  test("skips nested braces to find the correct match", () => {
    const code = "{ { } }";
    expect(findMatchingBrace(code, 0)).toBe(6);
  });

  test("ignores braces inside a string literal", () => {
    const code = '{ "}" }';
    expect(findMatchingBrace(code, 0)).toBe(6);
  });

  test("ignores braces inside a line comment", () => {
    const code = "{ // }\n}";
    expect(findMatchingBrace(code, 0)).toBe(7);
  });

  test("ignores braces inside a block comment", () => {
    const code = "{ /* } */ }";
    expect(findMatchingBrace(code, 0)).toBe(10);
  });

  test("returns -1 when the brace never closes", () => {
    const code = "{ still open";
    expect(findMatchingBrace(code, 0)).toBe(-1);
  });
});

describe("stripComments", () => {
  test("returns the text unchanged when there is nothing to strip", () => {
    expect(stripComments("foo()", 0, 5)).toBe("foo()");
  });

  test("removes a leading line comment", () => {
    const code = "// note\nfoo()";
    expect(stripComments(code, 0, code.length)).toBe("\nfoo()");
  });

  test("removes a block comment in the middle of the range", () => {
    const code = "foo(/* skip */)";
    expect(stripComments(code, 0, code.length)).toBe("foo()");
  });

  test("preserves a double-quoted string literal's contents, including comment-like text", () => {
    const code = 'foo("// not a comment")';
    expect(stripComments(code, 0, code.length)).toBe(code);
  });

  test("preserves a single-quoted string literal's contents, including comment-like text", () => {
    const code = "foo('// not a comment')";
    expect(stripComments(code, 0, code.length)).toBe(code);
  });

  test("preserves a template literal's contents, including comment-like text", () => {
    const code = "foo(`/* not a comment */`)";
    expect(stripComments(code, 0, code.length)).toBe(code);
  });

  test("preserves a lone slash that is not the start of a comment", () => {
    const code = "a/b";
    expect(stripComments(code, 0, code.length)).toBe("a/b");
  });

  test("only strips within the given [start, end) range", () => {
    const code = "// keep me\nfoo() // strip me";
    const fooStart = code.indexOf("foo");
    expect(stripComments(code, fooStart, code.length)).toBe("foo() ");
  });
});

describe("lineOf", () => {
  test("returns 1 for the first line", () => {
    expect(lineOf("abc", 0)).toBe(1);
  });

  test("counts newlines before the index", () => {
    expect(lineOf("a\nb\nc", 4)).toBe(3);
  });

  test("does not count a newline at or after the index", () => {
    expect(lineOf("a\nb", 1)).toBe(1);
  });
});
