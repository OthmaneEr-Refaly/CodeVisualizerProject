import fs from "node:fs";
import path from "node:path";
import { loadProject } from "./parser";
import { scanEntryPoints } from "./entryScanner";
import { scanMiddleware, attachMiddleware } from "./middlewareScanner";
import { walkCallGraph } from "./callWalker";
import { GraphxError, ScanWarning } from "./types";

export const GRAPH_SCHEMA_VERSION = 1;

export interface AnalyzeOptions {
  /** If true, run the full analysis but don't write anything to disk. */
  dryRun?: boolean;
  /** Where to write graph.json. Defaults to ./graphx-output relative to cwd. */
  outDir?: string;
  globPattern?: string;
}

export interface AnalyzeSummary {
  entryPointCount: number;
  nodeCount: number;
  edgeCount: number;
  warnings: ScanWarning[];
  /** Set only when the file was actually written (i.e. not a dry run). */
  outPath?: string;
}

/**
 * Stage 4: orchestrate.
 * Runs parse -> scan entry points -> walk call graph, in that order, and
 * (unless dryRun) writes the combined result to graphx-output/graph.json.
 *
 * Design choices carried over from the roadmap:
 * - Never touches the target codebase — only ever reads it. All output goes
 *   to a separate directory, so deleting outDir fully resets state.
 * - schemaVersion is stamped on every output file, so a future viewer or a
 *   v2 runtime-capture feature can tell old output apart from new.
 */
export function analyze(rootDir: string, options: AnalyzeOptions = {}): AnalyzeSummary {
  const outDir = options.outDir ?? path.join(process.cwd(), "graphx-output");

  let project;
  try {
    project = loadProject(rootDir, options.globPattern);
  } catch (err) {
    throw new GraphxError(
      err instanceof Error ? err.message : String(err),
      "orchestrator:loadProject",
      rootDir
    );
  }

  const scanResult = scanEntryPoints(project);
  const middlewareResult = scanMiddleware(project);
  const entryPointsWithMiddleware = attachMiddleware(scanResult.entryPoints, middlewareResult.bindings);
  const walkResult = walkCallGraph(project, entryPointsWithMiddleware);

  const allWarnings = [...scanResult.warnings, ...middlewareResult.warnings, ...walkResult.warnings];

  const output = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    entryPoints: entryPointsWithMiddleware,
    nodes: walkResult.nodes,
    edges: walkResult.edges,
    warnings: allWarnings,
  };

  const summary: AnalyzeSummary = {
    entryPointCount: entryPointsWithMiddleware.length,
    nodeCount: walkResult.nodes.length,
    edgeCount: walkResult.edges.length,
    warnings: allWarnings,
  };

  if (options.dryRun) {
    return summary;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "graph.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

  summary.outPath = outPath;
  return summary;
}
