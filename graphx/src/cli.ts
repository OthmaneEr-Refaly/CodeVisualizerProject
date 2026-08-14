#!/usr/bin/env node
import path from "node:path";
import { exec } from "node:child_process";
import { analyze } from "./orchestrator";
import { writeStandaloneViewer } from "./viewerGenerator";
import { GraphxError } from "./types";

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== "analyze" || args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const rootDir = args[1];
  const dryRun = args.includes("--dry-run");
  const shouldOpen = args.includes("--open");
  const outFlagIndex = args.indexOf("--out");
  const outDir = outFlagIndex !== -1 ? args[outFlagIndex + 1] : undefined;
  const globFlagIndex = args.indexOf("--glob");
  const globPattern = globFlagIndex !== -1 ? args[globFlagIndex + 1] : undefined;

  if (shouldOpen && dryRun) {
    console.error("\n--open and --dry-run can't be used together — dry-run writes nothing to open.");
    process.exit(1);
  }

  try {
    const summary = analyze(rootDir, { dryRun, outDir, globPattern });

    console.log(`\ngraphx analyze: ${rootDir}`);
    console.log(`  entry points found : ${summary.entryPointCount}`);
    console.log(`  graph nodes        : ${summary.nodeCount}`);
    console.log(`  graph edges        : ${summary.edgeCount}`);

    if (summary.warnings.length > 0) {
      console.log(`  warnings           : ${summary.warnings.length}`);
      for (const w of summary.warnings) {
        console.log(`    - [${w.filePath}] ${w.message}`);
      }
    }

    if (dryRun) {
      console.log(`\nDry run — nothing written to disk.`);
      return;
    }

    console.log(`\nWrote ${summary.outPath}`);

    if (shouldOpen && summary.outPath) {
      const graphData = JSON.parse(require("node:fs").readFileSync(summary.outPath, "utf-8"));
      const templatePath = path.join(__dirname, "..", "viewer", "index.html");
      const viewerOutPath = path.join(path.dirname(summary.outPath), "graph-viewer.html");

      writeStandaloneViewer(templatePath, graphData, viewerOutPath);
      console.log(`Wrote ${viewerOutPath}`);
      openInBrowser(viewerOutPath);
    }
  } catch (err) {
    if (err instanceof GraphxError) {
      console.error(`\ngraphx failed during "${err.stage}"${err.filePath ? ` (${err.filePath})` : ""}:`);
      console.error(`  ${err.message}`);
    } else {
      console.error(`\ngraphx failed unexpectedly:`);
      console.error(err);
    }
    process.exit(1);
  }
}

function openInBrowser(filePath: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open "${filePath}"`
      : process.platform === "win32"
      ? `start "" "${filePath}"`
      : `xdg-open "${filePath}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not auto-open a browser. Open this file manually:\n  ${filePath}`);
    }
  });
}

function printUsage() {
  console.log(`
Usage:
  graphx analyze <path> [--dry-run] [--out <dir>] [--glob <pattern>] [--open]

  <path>       Path to the project root to analyze (folder containing src/)
  --dry-run    Run the analysis but don't write graph.json
  --out <dir>  Where to write output (default: ./graphx-output)
  --glob <p>   Source file glob relative to <path> (default: src/**/*.ts)
  --open       Generate a standalone viewer with the graph pre-loaded and open it
`);
}

main();
