# graphx

A static analysis CLI that traces execution flow through a NestJS codebase —
from an HTTP entry point (`@Get`, `@Post`, etc.) through the controller and
service methods it calls — and renders it as a clickable flow diagram.

No running app required. graphx only *reads* your source files; it never
executes your code and never writes into your project. Output always goes to
a separate folder, so nothing here is ever destructive — delete the output
folder and you're back to zero.

## Quick start

```bash
npm install
npm run build

# Analyze a NestJS project and open the result in your browser
node dist/cli.js analyze ../path/to/your-nestjs-app --open
```

By default, graphx scans `src/**/*.ts` under the path you give it — a
standard NestJS layout. If your files live somewhere else, point at it with
`--glob`:

```bash
node dist/cli.js analyze ../your-app --glob "**/*.ts" --open
```

## CLI reference

```
graphx analyze <path> [--dry-run] [--out <dir>] [--glob <pattern>] [--open]

  <path>       Path to the project root to analyze (folder containing src/)
  --dry-run    Run the analysis but don't write anything to disk
  --out <dir>  Where to write output (default: <path>/graphx-output)
  --glob <p>   Source file glob relative to <path> (default: src/**/*.ts)
  --open       Generate a standalone viewer with the graph pre-loaded and open it
```

Without `--open`, graphx writes `graph.json` to the output folder. Open
`viewer/index.html` directly in a browser (no server needed) and use the
"Choose File" button to load it manually.

## How it works

```
parser.ts        → loads your project's source files into an AST (ts-morph)
entryScanner.ts   → finds every @Controller class + @Get/@Post/etc. method
callWalker.ts     → follows this.service.method() calls via constructor
                    injection, up to a depth limit, building nodes + edges
orchestrator.ts   → wires the above together, writes graph.json
viewer/index.html → static page that renders the graph as clickable cards
```

A card's kind is one of: `entry` (an HTTP route), `controller`, `service`,
or `external`. Clicking a card shows its file, line number, and the actual
code snippet captured for that method.

## Known limitations (v1)

- **Guards and middleware aren't traced.** Only the controller → service
  call chain is followed; `@UseGuards()`, custom middleware, and interceptors
  don't appear in the graph yet.
- **Static only — nothing is actually run.** graphx can't tell you what a
  method *does* at runtime (real request bodies, which `if` branch actually
  fires). It only shows what calls what, based on the code as written.
- **Constructor injection only.** Calls resolved through property injection,
  factory providers, or dynamic dispatch generally won't be followed.
- **Depth-limited.** Call chains stop expanding after 5 hops to avoid runaway
  graphs on deeply nested codebases.

A call graphx can't resolve becomes a warning in the CLI output, not a
crash — the rest of the graph still gets built.

## Development

```bash
npm test          # run the test suite (vitest, against a fixture NestJS app)
npm run test:watch
npx tsc --noEmit  # type check
```

Tests run against a small fixture app checked into `test/fixtures/app/` —
never against your own code. CI (`.github/workflows/test.yml`) runs the full
suite, a type check, a build, and a smoke-test analysis on every push, on
Node 20 and 22.
