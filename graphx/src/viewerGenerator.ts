import fs from "node:fs";

/**
 * Builds a self-contained viewer HTML string with the graph data baked in.
 * Kept as a pure string-in/string-out function (given the template content,
 * not a path) so it's trivial to unit test without touching the filesystem.
 */
export function buildStandaloneViewerHtml(templateHtml: string, graphData: unknown): string {
  const marker = "<!-- GRAPHX_DATA_INJECTION_POINT -->";
  if (!templateHtml.includes(marker)) {
    throw new Error(
      "viewer template is missing the GRAPHX_DATA_INJECTION_POINT marker — cannot embed graph data"
    );
  }

  // A code snippet from the analyzed project could itself contain the literal
  // text "</script>" — without escaping, that would terminate our injected
  // script tag early and corrupt the page. This is the standard fix.
  const safeJson = JSON.stringify(graphData).replace(/<\/script/gi, "<\\/script");
  const dataScript = `<script>window.__GRAPHX_DATA__ = ${safeJson};</script>`;
  return templateHtml.replace(marker, dataScript);
}

/** Convenience wrapper: reads the template from disk and writes the standalone viewer to outFile. */
export function writeStandaloneViewer(
  templatePath: string,
  graphData: unknown,
  outFile: string
): void {
  const template = fs.readFileSync(templatePath, "utf-8");
  const html = buildStandaloneViewerHtml(template, graphData);
  fs.writeFileSync(outFile, html);
}
