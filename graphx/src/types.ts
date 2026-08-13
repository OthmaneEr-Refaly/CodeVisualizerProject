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

export type NodeKind = "entry" | "controller" | "service" | "external";
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
