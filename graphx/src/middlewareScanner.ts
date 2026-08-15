import { Project, SyntaxKind } from "ts-morph";
import { EntryPoint, MiddlewareBinding, ScanWarning } from "./types";

/**
 * Stage 2b: scan for middleware bindings.
 * Middleware isn't a decorator on the route like guards are — it's registered
 * separately, usually in a module's `configure(consumer: MiddlewareConsumer)`
 * method: `consumer.apply(LoggerMiddleware).forRoutes('users')`. This walks
 * every class with a `configure` method and pulls out those bindings.
 *
 * We work off the call expression's own source text rather than a full
 * property-access chain walk — NestJS's builder pattern here
 * (`apply().exclude().forRoutes()`, arbitrary chaining) makes a text-scoped
 * regex on just that one call expression simpler and just as reliable as a
 * deeper AST walk for what this needs to extract.
 */
export function scanMiddleware(project: Project): { bindings: MiddlewareBinding[]; warnings: ScanWarning[] } {
  const bindings: MiddlewareBinding[] = [];
  const warnings: ScanWarning[] = [];

  for (const file of project.getSourceFiles()) {
    try {
      for (const cls of file.getClasses()) {
        const configureMethod = cls.getMethod("configure");
        if (!configureMethod) continue;

        const body = configureMethod.getBody();
        if (!body) continue;

        const forRoutesCalls = body
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .filter((call) => {
            const expr = call.getExpression();
            return (
              expr.getKind() === SyntaxKind.PropertyAccessExpression &&
              expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === "forRoutes"
            );
          });

        for (const call of forRoutesCalls) {
          const text = call.getText();
          const middlewareNames = extractArgs(text, "apply");
          const routePatterns = extractArgs(text, "forRoutes");

          if (middlewareNames.length === 0 || routePatterns.length === 0) {
            warnings.push({
              filePath: file.getFilePath(),
              message: `Could not parse a middleware binding: ${text.slice(0, 80)}`,
            });
            continue;
          }

          bindings.push({
            middlewareNames,
            routePatterns,
            filePath: file.getFilePath(),
            line: call.getStartLineNumber(),
            snippet: text,
          });
        }
      }
    } catch (err) {
      warnings.push({
        filePath: file.getFilePath(),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { bindings, warnings };
}

/** Pulls the comma-separated arguments out of `.methodName(...)` within a call chain's text. */
function extractArgs(callText: string, methodName: string): string[] {
  const match = callText.match(new RegExp(`\\.${methodName}\\(([^)]*)\\)`));
  if (!match || !match[1].trim()) return [];

  return match[1]
    .split(",")
    .map((arg) => arg.trim().replace(/^['"`]|['"`]$/g, ""))
    .filter(Boolean);
}

/**
 * Attaches middleware to each entry point whose route matches a binding's
 * pattern — either a quoted path prefix ('users') or a controller class name
 * (UserController). Mutates nothing; returns new EntryPoint objects.
 */
export function attachMiddleware(
  entryPoints: EntryPoint[],
  bindings: MiddlewareBinding[]
): EntryPoint[] {
  return entryPoints.map((entry) => {
    const matches = bindings.filter((b) => bindingMatchesEntry(b, entry));
    if (matches.length === 0) return entry;

    const names = Array.from(new Set(matches.flatMap((b) => b.middlewareNames)));
    const snippet = matches.map((b) => b.snippet).join("\n");

    return { ...entry, middleware: names, middlewareSnippet: snippet };
  });
}

function bindingMatchesEntry(binding: MiddlewareBinding, entry: EntryPoint): boolean {
  return binding.routePatterns.some((pattern) => {
    // A controller-name pattern, e.g. forRoutes(UserController)
    if (pattern === entry.controllerName) return true;

    // A path pattern, e.g. forRoutes('users') — matches "users" and "users/:id"
    const normalizedPattern = pattern.replace(/^\/+|\/+$/g, "");
    const normalizedPath = entry.path.replace(/^\/+|\/+$/g, "");
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(normalizedPattern + "/");
  });
}
