import { Decorator, Project, MethodDeclaration } from "ts-morph";
import { EntryPoint, ScanResult, ScanWarning } from "./types";

const HTTP_DECORATORS = ["Get", "Post", "Put", "Delete", "Patch"];

/**
 * Stage 2: scan for entry points.
 * Walks every class in the project looking for @Controller, then every
 * method inside looking for an HTTP verb decorator (@Get, @Post, etc).
 * Also picks up @UseGuards, @UseInterceptors, and @UsePipes at both class
 * and method level — NestJS runs class-level bindings first, then
 * method-level ones, so we preserve that order for each.
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

        const classGuards = readDecoratorArgs(cls.getDecorator("UseGuards"));
        const classInterceptors = readDecoratorArgs(cls.getDecorator("UseInterceptors"));
        const classPipes = readDecoratorArgs(cls.getDecorator("UsePipes"));

        for (const method of cls.getMethods()) {
          const httpDec = HTTP_DECORATORS
            .map((name) => method.getDecorator(name))
            .find(Boolean);

          if (!httpDec) continue;

          const routePath = readStringArg(httpDec.getArguments()[0]) ?? "";

          const methodGuardDec = method.getDecorator("UseGuards");
          const methodInterceptorDec = method.getDecorator("UseInterceptors");
          const methodPipeDec = method.getDecorator("UsePipes");

          entryPoints.push({
            httpMethod: httpDec.getName().toUpperCase(),
            path: joinPath(basePath, routePath),
            controllerName,
            methodName: method.getName(),
            filePath: file.getFilePath(),
            line: getSafeLine(method),
            guards: dedupe([...classGuards, ...readDecoratorArgs(methodGuardDec)]),
            guardsSnippet: combineSnippets(cls.getDecorator("UseGuards"), methodGuardDec),
            middleware: [],
            interceptors: dedupe([...classInterceptors, ...readDecoratorArgs(methodInterceptorDec)]),
            interceptorsSnippet: combineSnippets(cls.getDecorator("UseInterceptors"), methodInterceptorDec),
            pipes: dedupe([...classPipes, ...readDecoratorArgs(methodPipeDec)]),
            pipesSnippet: combineSnippets(cls.getDecorator("UsePipes"), methodPipeDec),
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

/** Reads argument names from a decorator like @UseGuards(...) / @UseInterceptors(...) / @UsePipes(...). */
function readDecoratorArgs(dec: Decorator | undefined): string[] {
  if (!dec) return [];
  // Arguments are identifiers like `AuthGuard`, not string literals — no quote-stripping needed.
  return dec.getArguments().map((arg) => arg.getText());
}

function dedupe(names: string[]): string[] {
  return Array.from(new Set(names));
}

/** Combines the class-level and method-level decorator source text (same decorator name), for display when that node is clicked. */
function combineSnippets(classDec: Decorator | undefined, methodDec: Decorator | undefined): string | undefined {
  const parts: string[] = [];
  if (classDec) parts.push(classDec.getText());
  if (methodDec) parts.push(methodDec.getText());
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
