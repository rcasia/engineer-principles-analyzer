#!/usr/bin/env node
import { main } from "./main.ts";

// Executable shim only. All behaviour lives in main(), which is why this file
// is excluded from mutation testing in stryker.config.json.
process.exitCode = await main(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
