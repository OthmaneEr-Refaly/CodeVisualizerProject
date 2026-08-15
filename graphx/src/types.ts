/**
 * Shared types for the graphx pipeline. Every stage speaks these types
 * and nothing else — this is what lets each stage be tested in isolation.
 */

export interface EntryPoint {
  httpMethod: string; // "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  path: string; // full route path, e.g. "users/:id"
  controllerName: string;
  methodName: string;
  filePath: string;
  line: number;
  /** Names from @UseGuards, combining class-level (applies to all routes) + method-level. Empty if none. */
  guards: string[];
  /** Raw @UseGuards decorator text(s), for display when a guard node is clicked. */
  guardsSnippet?: string;
  /** Middleware class names bound to this route via a module's configure(). Empty if none. */
  middleware: string[];
  /** Raw consumer.apply(...).forRoutes(...) source text(s), for display when a middleware node is clicked. */
  middlewareSnippet?: string;
}

/**
 * One `consumer.apply(X, Y).forRoutes(pattern)` binding found inside a
 * NestModule's configure() method. routePatterns are either quoted path
 * strings ('users') or controller class names (UserController) — either
 * form NestJS accepts in forRoutes(...).
 */
export interface MiddlewareBinding {
  middlewareNames: string[];
  routePatterns: string[];
  filePath: string;
  line: number;
  snippet: string;
}

export interface ScanResult {
  entryPoints: EntryPoint[];
  /** Non-fatal problems found while scanning — a broken file shouldn't kill the whole run */
  warnings: ScanWarning[];
}

export interface ScanWarning {
  filePath: string;
  message: string;
}

/** Base class for all typed errors thrown by graphx stages */
export class GraphxError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly filePath?: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class EntryPointScanError extends GraphxError {
  constructor(message: string, filePath?: string) {
    super(message, "entryScanner", filePath);
  }
}

// --- Graph output (stage 3: call-graph walker) ---

export type NodeKind = "entry" | "middleware" | "guard" | "controller" | "service" | "external";
export type EdgeKind = "triggers" | "calls";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  filePath?: string;
  line?: number;
  snippet?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface WalkResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: ScanWarning[];
}
