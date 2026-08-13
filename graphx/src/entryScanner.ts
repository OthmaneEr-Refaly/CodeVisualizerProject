import { Project, MethodDeclaration } from "ts-morph";
import { EntryPoint, ScanResult, ScanWarning } from "./types";

const HTTP_DECORATORS = ["Get", "Post", "Put", "Delete", "Patch"];

/**
 * Stage 2: scan for entry points.
 * Walks every class in the project looking for @Controller, then every
 * method inside looking for an HTTP verb decorator (@Get, @Post, etc).
 *
 * Design choice: a problem in one file (e.g. a decorator we don't recognise,
 * or a malformed argument) becomes a warning attached to that file, not a
 * thrown error that kills the whole scan. A codebase with one weird file
 * should still produce results for the other 200 files.
 */
export function scanEntryPoints(project: Project): ScanResult {
  const entryPoints: EntryPoint[] = [];
  const warnings: ScanWarning[] = [];

  for (const file of project.getSourceFiles()) {
    try {
      for (const cls of file.getClasses()) {
        const controllerDec = cls.getDecorator("Controller");
        if (!controllerDec) continue;

        const basePath = readStringArg(controllerDec.getArguments()[0]) ?? "";
        const controllerName = cls.getName() ?? "AnonymousController";

        for (const method of cls.getMethods()) {
          const httpDec = HTTP_DECORATORS
            .map((name) => method.getDecorator(name))
            .find(Boolean);

          if (!httpDec) continue;

          const routePath = readStringArg(httpDec.getArguments()[0]) ?? "";

          entryPoints.push({
            httpMethod: httpDec.getName().toUpperCase(),
            path: joinPath(basePath, routePath),
            controllerName,
            methodName: method.getName(),
            filePath: file.getFilePath(),
            line: getSafeLine(method),
          });
        }
      }
    } catch (err) {
      // A single malformed file shouldn't abort the whole scan.
      warnings.push({
        filePath: file.getFilePath(),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { entryPoints, warnings };
}

function readStringArg(arg: unknown): string | undefined {
  if (!arg) return undefined;
  // Decorator arguments are string literals like 'users' — strip the quotes.
  const text = (arg as { getText: () => string }).getText();
  return text.replace(/^['"`]|['"`]$/g, "");
}

function joinPath(base: string, route: string): string {
  return [base, route].filter(Boolean).join("/").replace(/\/+/g, "/");
}

function getSafeLine(method: MethodDeclaration): number {
  try {
    return method.getStartLineNumber();
  } catch {
    return -1;
  }
}
