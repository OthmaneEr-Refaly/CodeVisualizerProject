import { ClassDeclaration, Decorator, Project, MethodDeclaration } from "ts-morph";
import { EntryPoint, ScanResult, ScanWarning } from "./types";

const HTTP_DECORATORS = ["Get", "Post", "Put", "Delete", "Patch"];

/**
 * Stage 2: scan for entry points.
 * Walks every class in the project looking for @Controller, then every
 * method inside looking for an HTTP verb decorator (@Get, @Post, etc).
 * Also picks up @UseGuards at both class and method level — NestJS runs
 * class-level guards first, then method-level ones, so we preserve that order.
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
        const classGuards = readGuards(cls.getDecorator("UseGuards"));

        for (const method of cls.getMethods()) {
          const httpDec = HTTP_DECORATORS
            .map((name) => method.getDecorator(name))
            .find(Boolean);

          if (!httpDec) continue;

          const routePath = readStringArg(httpDec.getArguments()[0]) ?? "";
          const methodGuardDec = method.getDecorator("UseGuards");
          const methodGuards = readGuards(methodGuardDec);

          entryPoints.push({
            httpMethod: httpDec.getName().toUpperCase(),
            path: joinPath(basePath, routePath),
            controllerName,
            methodName: method.getName(),
            filePath: file.getFilePath(),
            line: getSafeLine(method),
            guards: dedupe([...classGuards, ...methodGuards]),
            guardsSnippet: buildGuardsSnippet(cls, methodGuardDec),
            middleware: [],
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

/** Reads guard class names from a @UseGuards(...) decorator's arguments. */
function readGuards(dec: Decorator | undefined): string[] {
  if (!dec) return [];
  // Arguments are identifiers like `AuthGuard`, not string literals — no quote-stripping needed.
  return dec.getArguments().map((arg) => arg.getText());
}

function dedupe(names: string[]): string[] {
  return Array.from(new Set(names));
}

/** Combines the class-level and method-level @UseGuards source text, for display when a guard node is clicked. */
function buildGuardsSnippet(cls: ClassDeclaration, methodGuardDec: Decorator | undefined): string | undefined {
  const parts: string[] = [];
  const classGuardDec = cls.getDecorator("UseGuards");
  if (classGuardDec) parts.push(classGuardDec.getText());
  if (methodGuardDec) parts.push(methodGuardDec.getText());
  return parts.length > 0 ? parts.join("\n") : undefined;
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
