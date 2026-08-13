import {
  ClassDeclaration,
  MethodDeclaration,
  Project,
  PropertyAccessExpression,
  SyntaxKind,
} from "ts-morph";
import { EntryPoint, GraphEdge, GraphNode, ScanWarning, WalkResult } from "./types";

const MAX_DEPTH = 5;
const SNIPPET_MAX_CHARS = 300;

/**
 * Stage 3: walk the call graph.
 * Starting from each entry point, follows `this.someService.someMethod()` calls
 * by resolving `someService` back through the class's constructor parameters
 * (NestJS-style DI), then recurses into that method up to MAX_DEPTH.
 *
 * Same rule as the scanner: a call we can't resolve becomes a warning, not a
 * crash. Most real codebases have calls we simply won't understand statically
 * (dynamic dispatch, external libs) — that's expected, not a bug.
 */
export function walkCallGraph(project: Project, entryPoints: EntryPoint[]): WalkResult {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const warnings: ScanWarning[] = [];
  const visitedMethodIds = new Set<string>();

  for (const entry of entryPoints) {
    const file = project.getSourceFile(entry.filePath);
    const cls = file?.getClass(entry.controllerName);
    const method = cls?.getMethod(entry.methodName);

    if (!file || !cls || !method) {
      warnings.push({
        filePath: entry.filePath,
        message: `Could not re-locate ${entry.controllerName}.${entry.methodName} for walking`,
      });
      continue;
    }

    const entryNodeId = `entry:${entry.httpMethod}:${entry.path}`;
    nodes.set(entryNodeId, {
      id: entryNodeId,
      label: `${entry.httpMethod} /${entry.path}`,
      kind: "entry",
    });

    const controllerNodeId = walkMethod(cls, method, "controller", 0);
    if (controllerNodeId) {
      edges.push({ from: entryNodeId, to: controllerNodeId, kind: "triggers" });
    }
  }

  return { nodes: Array.from(nodes.values()), edges, warnings };

  /** Returns the node id for this method, after adding it + recursing into what it calls. */
  function walkMethod(
    cls: ClassDeclaration,
    method: MethodDeclaration,
    kind: "controller" | "service",
    depth: number
  ): string | undefined {
    const className = cls.getName() ?? "Unknown";
    const methodName = method.getName();
    const nodeId = `${className}.${methodName}`;

    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        label: nodeId,
        kind,
        filePath: method.getSourceFile().getFilePath(),
        line: safeLine(method),
        snippet: method.getText().slice(0, SNIPPET_MAX_CHARS),
      });
    }

    // Cycle / re-visit guard — a method can be reached from multiple paths,
    // but we only need to expand its own outgoing calls once.
    if (visitedMethodIds.has(nodeId) || depth >= MAX_DEPTH) {
      return nodeId;
    }
    visitedMethodIds.add(nodeId);

    for (const call of findServiceCalls(method)) {
      try {
        const target = resolveCall(cls, call);
        if (!target) continue;

        const targetNodeId = walkMethod(target.cls, target.method, "service", depth + 1);
        if (targetNodeId) {
          edges.push({ from: nodeId, to: targetNodeId, kind: "calls" });
        }
      } catch (err) {
        warnings.push({
          filePath: method.getSourceFile().getFilePath(),
          message: `Could not resolve a call inside ${nodeId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }
    }

    return nodeId;
  }
}

/** Finds every `this.<field>.<method>(...)` call expression inside a method body. */
function findServiceCalls(method: MethodDeclaration): PropertyAccessExpression[] {
  const body = method.getBody();
  if (!body) return [];

  return body
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression())
    .filter((expr): expr is PropertyAccessExpression =>
      expr.getKind() === SyntaxKind.PropertyAccessExpression
    )
    .filter((pae) => {
      const objExpr = pae.getExpression();
      return (
        objExpr.getKind() === SyntaxKind.PropertyAccessExpression &&
        (objExpr as PropertyAccessExpression).getExpression().getKind() ===
          SyntaxKind.ThisKeyword
      );
    });
}

/** Resolves `this.<field>.<method>` back to the field's class and that method's declaration. */
function resolveCall(
  containingClass: ClassDeclaration,
  callee: PropertyAccessExpression
): { cls: ClassDeclaration; method: MethodDeclaration } | undefined {
  const methodName = callee.getName();
  const fieldAccess = callee.getExpression() as PropertyAccessExpression;
  const fieldName = fieldAccess.getName();

  // NestJS constructor injection: `constructor(private readonly userService: UserService)`
  const ctor = containingClass.getConstructors()[0];
  const param = ctor?.getParameters().find((p) => p.getName() === fieldName);
  if (!param) return undefined;

  const typeSymbol = param.getType().getSymbol();
  const targetClassDecl = typeSymbol
    ?.getDeclarations()
    .find((d) => d.getKind() === SyntaxKind.ClassDeclaration) as ClassDeclaration | undefined;
  if (!targetClassDecl) return undefined;

  const targetMethod = targetClassDecl.getMethod(methodName);
  if (!targetMethod) return undefined;

  return { cls: targetClassDecl, method: targetMethod };
}

function safeLine(method: MethodDeclaration): number {
  try {
    return method.getStartLineNumber();
  } catch {
    return -1;
  }
}
