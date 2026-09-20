# principled

Analyze a codebase against engineering principles.

```sh
npx principled
```

## Analyze one file locally

```sh
principled analyze src/server.ts
principled analyze src/server.ts --rule solid.srp --format json
cat src/server.py | principled analyze --language python --format sarif > results.sarif
```

Analysis runs on this machine with no account, no network and no
telemetry. The language comes from `--language` or, when the input is a
file, its extension — never from a network judgment — so the CLI stays
usable offline. The web product judges content with a model instead;
whenever both settle on the same language, the shared engine produces
equivalent findings. Errors never include the submitted source.

| Option | Meaning |
| ------ | ------- |
| `[file]` | File to read. A known extension names the language. Omitted (or `-`): read stdin. |
| `--language <id>` | `typescript`, `javascript`, `python`, `go`, `rust`, or `java`. Wins over the extension; required when no filename names one. |
| `--rule <id>` | Only run this rule; repeat or comma-separate for several. Default: all rules. |
| `--format human\|json\|sarif` | Output shape. Default `human`. |
| `--timing` | Include analysis duration (`durationMs` in json). |
| `--stdin` | Read stdin even when it is not a pipe. |

`json` and `sarif` carry schema version `"1"`
(`schemaVersion`, `properties["principled/schemaVersion"]`) so scripts can
detect breaking changes. SARIF follows version 2.1.0 for code-scanning
uploads. Neither shape contains user, host, or telemetry fields.

Exit status: `0` analysis completed with no violations, `1` analysis
completed with at least one violation, `2` no analysis happened (bad
flags, unreadable input, or an unevaluable subject).

See the [project README](https://github.com/rcasia/principled#readme).
