#!/usr/bin/env bun
import { main } from "./main.ts";

// Executable shim only. All behaviour lives in main(), which is why this file
// is excluded from mutation testing in stryker.config.json.
await main(console.log);
