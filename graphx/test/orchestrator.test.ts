import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { analyze, GRAPH_SCHEMA_VERSION } from "../src/orchestrator";
import { GraphxError } from "../src/types";

const FIXTURE_DIR = path.join(__dirname, "fixtures/app");
let tmpOutDir: string;

afterEach(() => {
  if (tmpOutDir && fs.existsSync(tmpOutDir)) {
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
  }
});

describe("analyze (orchestrator)", () => {
  it("runs the full pipeline and writes a versioned graph.json", () => {
    tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "graphx-test-"));

    const summary = analyze(FIXTURE_DIR, { outDir: tmpOutDir, globPattern: "*.ts" });

    expect(summary.entryPointCount).toBe(2);
    expect(summary.nodeCount).toBeGreaterThan(0);
    expect(summary.edgeCount).toBeGreaterThan(0);
    expect(summary.warnings).toEqual([]);
    expect(summary.outPath).toBe(path.join(tmpOutDir, "graph.json"));

    const written = JSON.parse(fs.readFileSync(summary.outPath!, "utf-8"));
    expect(written.schemaVersion).toBe(GRAPH_SCHEMA_VERSION);
    expect(written.entryPoints).toHaveLength(2);
    expect(written.nodes.length).toBe(summary.nodeCount);
    expect(written.edges.length).toBe(summary.edgeCount);
    expect(typeof written.generatedAt).toBe("string");
  });

  it("does not write anything to disk in dry-run mode", () => {
    tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "graphx-test-"));

    const summary = analyze(FIXTURE_DIR, {
      outDir: tmpOutDir,
      globPattern: "*.ts",
      dryRun: true,
    });

    expect(summary.entryPointCount).toBe(2);
    expect(summary.outPath).toBeUndefined();
    expect(fs.existsSync(path.join(tmpOutDir, "graph.json"))).toBe(false);
  });

  it("throws a typed GraphxError for a nonexistent project path", () => {
    tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "graphx-test-"));

    expect(() =>
      analyze("/nonexistent/path", { outDir: tmpOutDir, globPattern: "*.ts" })
    ).toThrow(GraphxError);
  });
});
