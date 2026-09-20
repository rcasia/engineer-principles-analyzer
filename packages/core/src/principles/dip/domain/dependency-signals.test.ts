import { describe, expect, test } from "bun:test";
import {
  countDependencySignals,
  locateFirstSignal,
  MAX_EXCERPT_LENGTH,
  stripNoise,
} from "./dependency-signals.ts";

describe("stripNoise", () => {
  test("leaves plain code untouched", () => {
    expect(stripNoise('import fs from "node:fs";')).toBe('import fs from "node:fs";');
  });

  test("blanks strings so their contents never count", () => {
    expect(stripNoise('const s = "pg";')).toBe("const s =     ;");
  });

  test("blanks line comments but keeps the newline", () => {
    expect(stripNoise('import x from "pg"; // database\nfoo();')).toBe(
      'import x from "pg";            \nfoo();',
    );
  });

  test("blanks block comments but keeps newlines inside them", () => {
    expect(stripNoise('a(); /* require("pg") */ b();')).toBe("a();                     b();");
  });

  test("blanks a fake import hidden inside a string", () => {
    expect(stripNoise('const s = "import foo from \'pg\'";')).toBe(
      "const s =                       ;",
    );
  });
});

describe("countDependencySignals", () => {
  test("counts zero signals in decoupled code", () => {
    expect(
      countDependencySignals('import { format } from "./format";\nconst m = new Map();'),
    ).toEqual({ infraImports: 0, concreteInstantiations: 0, total: 0 });
  });

  test("counts an infrastructure import", () => {
    expect(countDependencySignals('import fs from "node:fs";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts require and dynamic import forms", () => {
    const source = 'const pg = require("pg");\nconst redis = await import("ioredis");';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 2,
      concreteInstantiations: 0,
      total: 2,
    });
  });

  test("counts scoped packages by prefix", () => {
    expect(
      countDependencySignals('import { S3 } from "@aws-sdk/client-s3";'),
    ).toEqual({ infraImports: 1, concreteInstantiations: 0, total: 1 });
  });

  test("ignores relative imports, even infra-sounding ones", () => {
    expect(countDependencySignals('import { pool } from "./pg";')).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("ignores commented-out imports", () => {
    expect(countDependencySignals('// import fs from "node:fs";\nconst x = 1;')).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("ignores a fake import and instantiation hidden inside strings", () => {
    const source = 'const a = "import foo from \'pg\'";\nconst b = "new Pool()";';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("counts a concrete instantiation by suffix", () => {
    expect(countDependencySignals("const pool = new Pool();")).toEqual({
      infraImports: 0,
      concreteInstantiations: 1,
      total: 1,
    });
  });

  test("counts an instantiation of a name imported from infrastructure", () => {
    const source = 'import { Db } from "mongodb";\nconst db = new Db(url);';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("does not count ordinary instantiations", () => {
    expect(
      countDependencySignals("const m = new Map();\nconst e = new Error('x');"),
    ).toEqual({ infraImports: 0, concreteInstantiations: 0, total: 0 });
  });

  test("sums both groups", () => {
    const source = [
      'import fs from "node:fs";',
      'import { Pool } from "pg";',
      "const pool = new Pool();",
    ].join("\n");

    expect(countDependencySignals(source)).toEqual({
      infraImports: 2,
      concreteInstantiations: 1,
      total: 3,
    });
  });
});

describe("locateFirstSignal", () => {
  test("returns undefined when there is no signal", () => {
    expect(locateFirstSignal('import { format } from "./format";')).toBeUndefined();
  });

  test("points at the first infrastructure import, skipping local imports", () => {
    const source = 'import { format } from "./format";\nimport fs from "node:fs";';

    expect(locateFirstSignal(source)).toEqual({
      startLine: 2,
      excerpt: 'import fs from "node:fs";',
    });
  });

  test("points at a concrete instantiation", () => {
    expect(locateFirstSignal("const pool = new Pool();")).toEqual({
      startLine: 1,
      excerpt: "const pool = new Pool();",
    });
  });

  test("caps the excerpt at MAX_EXCERPT_LENGTH characters", () => {
    expect(MAX_EXCERPT_LENGTH).toBe(120);

    const longLine = `import { ${"a".repeat(200)} } from "pg";`;
    const found = locateFirstSignal(longLine);

    expect(found?.startLine).toBe(1);
    expect(found?.excerpt).toBe(longLine.slice(0, 120));
    expect(found?.excerpt.length).toBe(120);
  });
});
