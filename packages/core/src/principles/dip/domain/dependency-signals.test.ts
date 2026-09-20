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

  test("blanks single-quoted strings too", () => {
    expect(stripNoise("const s = 'pg';")).toBe("const s =     ;");
  });

  test("blanks template literals too", () => {
    expect(stripNoise("const s = `pg`;")).toBe("const s =     ;");
  });

  test("skips an escaped quote inside a string", () => {
    expect(stripNoise('const s = "a\\"b";')).toBe("const s =       ;");
  });

  test("skips an escaped backtick inside a template literal", () => {
    expect(stripNoise("const s = `a\\`b`;")).toBe("const s =       ;");
  });

  test("skips an escape at the start of a string", () => {
    expect(stripNoise('const s = "\\}b";')).toBe("const s =      ;");
  });

  test("does not mistake a division slash for a comment opener", () => {
    expect(stripNoise("a / b")).toBe("a / b");
  });

  test("does not mistake a multiplication star for a block comment", () => {
    expect(stripNoise("a * b")).toBe("a * b");
  });

  test("an unterminated line comment blanks to the end of input", () => {
    expect(stripNoise("a(); // tail")).toBe("a();        ");
  });

  test("an unterminated block comment blanks to the end of input", () => {
    expect(stripNoise("a(); /* blk")).toBe("a();       ");
  });

  test("does not let a second block comment search run backward into the first closer", () => {
    expect(stripNoise("/*A*//*B*/x")).toBe("          x");
  });

  test("keeps a require specifier followed by a space before the paren", () => {
    expect(stripNoise('const pg = require ("pg");')).toBe(
      'const pg = require ("pg");',
    );
  });

  test("keeps a dynamic import specifier followed by a space before the paren", () => {
    expect(stripNoise('const m = await import ("pg");')).toBe(
      'const m = await import ("pg");',
    );
  });

  test("blanks a string that merely follows an import", () => {
    expect(stripNoise('import x from "pg";\nconst s = "oops";')).toBe(
      "import x from \"pg\";\nconst s =       ;",
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

  test("reads every listed infrastructure module as coupling", () => {
    const specifiers = [
      "fs",
      "node:fs",
      "net",
      "node:net",
      "http",
      "node:http",
      "https",
      "node:https",
      "http2",
      "child_process",
      "node:child_process",
      "cluster",
      "dgram",
      "dns",
      "tls",
      "worker_threads",
      "aws-sdk",
      "@aws-sdk/client-s3",
      "pg",
      "pg-pool",
      "mysql",
      "mysql2",
      "mariadb",
      "sqlite3",
      "better-sqlite3",
      "redis",
      "ioredis",
      "mongodb",
      "mongoose",
      "typeorm",
      "sequelize",
      "knex",
      "prisma",
      "@prisma/client",
      "axios",
      "node-fetch",
      "undici",
      "amqplib",
      "kafkajs",
      "@elastic/elasticsearch",
      "nodemailer",
    ];

    for (const specifier of specifiers) {
      expect(
        countDependencySignals(`import x from "${specifier}";`).infraImports,
      ).toBe(1);
    }
  });

  test("reads the bare @aws-sdk scope without a trailing slash", () => {
    expect(countDependencySignals('import x from "@aws-sdk";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("reads an infrastructure subpath as coupling", () => {
    expect(countDependencySignals('import x from "pg/pool";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("does not read a module that merely starts like an entry", () => {
    expect(countDependencySignals('import x from "pgx";')).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("does not read an unknown module as coupling", () => {
    expect(countDependencySignals('import x from "lodash";')).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("does not read a scope that merely starts like the aws prefix", () => {
    expect(countDependencySignals('import x from "@aws-sdkclient";')).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("does not read a blank specifier as coupling", () => {
    expect(countDependencySignals('import x from "   ";')).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("counts a side-effect import", () => {
    expect(countDependencySignals('import "pg";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts a side-effect import separated by more than one space", () => {
    expect(countDependencySignals('import  "pg";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts an import separated from its specifier by more than one space", () => {
    expect(countDependencySignals('import fs from  "pg";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts a re-export from infrastructure", () => {
    expect(countDependencySignals('export { X } from "pg";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts a re-export separated from its specifier by more than one space", () => {
    expect(countDependencySignals('export { X } from  "pg";')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts a require with a space before the paren", () => {
    expect(countDependencySignals('const pg = require( "pg");')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts a require with a space before the closing paren", () => {
    expect(countDependencySignals('const pg = require("pg" );')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts a dynamic import with a space after the paren", () => {
    expect(countDependencySignals('const m = await import( "pg");')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts a dynamic import with a space before the closing paren", () => {
    expect(countDependencySignals('const m = await import("pg" );')).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("counts an instantiation separated from new by more than one space", () => {
    expect(countDependencySignals("const pool = new  Pool();")).toEqual({
      infraImports: 0,
      concreteInstantiations: 1,
      total: 1,
    });
  });

  test("counts an instantiation whose name merely ends with a suffix", () => {
    expect(countDependencySignals("const pool = new MyPool();")).toEqual({
      infraImports: 0,
      concreteInstantiations: 1,
      total: 1,
    });
  });

  test("counts a default import and the instantiation of its binding", () => {
    const source = 'import Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a default import separated by more than one space", () => {
    const source = 'import  Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a default import with no space before the named bindings", () => {
    const source = 'import Foo,{A} from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("registers the binding of a default import with no space before from", () => {
    const source = 'import Foo,from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 0,
      concreteInstantiations: 1,
      total: 1,
    });
  });

  test("counts a default import with a multi-character named binding", () => {
    const source = 'import Foo, {AB} from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a default import separated from its specifier by more than one space", () => {
    const source = 'import Foo from  "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("does not read a garbled default binding as a name", () => {
    const source = 'import Foo Bar from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("does not read a garbled trailing binding as a name", () => {
    const source = 'import Foo, Bar from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("does not read a garbled comma binding as a name", () => {
    const source = 'import Foo,Bar from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("reads a specifier separated from from by a comment", () => {
    const source = 'import Foo from/*c*/"pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts an aliased named import under its local name", () => {
    const source = 'import { X as  Y } from "pg";\nconst y = new Y();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("registers the binding of a named import with no space after import", () => {
    const source = 'import{Db} from "mongodb";\nconst db = new Db(url);';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 0,
      concreteInstantiations: 1,
      total: 1,
    });
  });

  test("registers the binding of a named import with no space before from", () => {
    const source = 'import { Db }from "mongodb";\nconst db = new Db(url);';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 0,
      concreteInstantiations: 1,
      total: 1,
    });
  });

  test("counts a named import separated from from by more than one space", () => {
    const source = 'import { Db }  from "mongodb";\nconst db = new Db(url);';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a named import separated from its specifier by more than one space", () => {
    const source = 'import { Db } from  "mongodb";\nconst db = new Db(url);';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a namespace import and the instantiation of its binding", () => {
    const source = 'import * as Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a namespace import separated by more than one space after import", () => {
    const source = 'import  * as Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a namespace import separated by more than one space after the star", () => {
    const source = 'import *  as Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a namespace import separated by more than one space after as", () => {
    const source = 'import * as  Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a namespace import separated by more than one space before from", () => {
    const source = 'import * as Foo  from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("counts a namespace import separated from its specifier by more than one space", () => {
    const source = 'import * as Foo from  "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("reads a namespace specifier separated from from by a comment", () => {
    const source = 'import * as Foo from/*c*/"pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("does not read a doubled star as a namespace binding", () => {
    const source = 'import ** as Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("does not read a garbled namespace binding as a name", () => {
    const source = 'import *Xas Foo from "pg";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("does not count a named import from a local module", () => {
    const source = 'import { Db } from "./local";\nconst db = new Db(url);';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("does not count a default import from a local module", () => {
    const source = 'import Foo from "./local";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
    });
  });

  test("does not count a namespace import from a local module", () => {
    const source = 'import * as Foo from "./local";\nconst f = new Foo();';

    expect(countDependencySignals(source)).toEqual({
      infraImports: 0,
      concreteInstantiations: 0,
      total: 0,
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

  test("trims the excerpt of a signal line", () => {
    expect(locateFirstSignal('  import fs from "node:fs";  ')).toEqual({
      startLine: 1,
      excerpt: 'import fs from "node:fs";',
    });
  });

  test("returns undefined for an ordinary instantiation", () => {
    expect(locateFirstSignal("const m = new Map();")).toBeUndefined();
  });

  test("points at a line mixing infrastructure and local imports", () => {
    const source = 'import fs from "node:fs"; import { y } from "./y";';

    expect(locateFirstSignal(source)).toEqual({ startLine: 1, excerpt: source });
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
