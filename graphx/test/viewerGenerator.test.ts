import { describe, it, expect } from "vitest";
import { buildStandaloneViewerHtml } from "../src/viewerGenerator";

describe("buildStandaloneViewerHtml", () => {
  it("embeds the graph data as a script tag at the injection point", () => {
    const template = `<html><body>\n<!-- GRAPHX_DATA_INJECTION_POINT -->\n<div>rest of page</div></body></html>`;
    const graph = { nodes: [{ id: "a" }], edges: [] };

    const result = buildStandaloneViewerHtml(template, graph);

    expect(result).toContain("window.__GRAPHX_DATA__ =");
    expect(result).toContain(`"id":"a"`);
    expect(result).toContain("<div>rest of page</div>"); // rest of template untouched
    expect(result).not.toContain("GRAPHX_DATA_INJECTION_POINT"); // marker consumed
  });

  it("throws a clear error if the template has no injection marker", () => {
    const brokenTemplate = `<html><body>no marker here</body></html>`;
    expect(() => buildStandaloneViewerHtml(brokenTemplate, {})).toThrow(
      /missing the GRAPHX_DATA_INJECTION_POINT marker/
    );
  });

  it("escapes closing script tags in embedded data so a code snippet can't break out of the script block", () => {
    const template = `<!-- GRAPHX_DATA_INJECTION_POINT -->`;
    const graph = { nodes: [{ id: "a", snippet: "</script><script>alert(1)</script>" }] };

    const result = buildStandaloneViewerHtml(template, graph);

    expect(result).not.toContain("</script><script>alert(1)");
    expect(result).toContain("<\\/script"); // escaped form is present instead
    // exactly one real closing </script> tag — the one that ends our own data script
    expect(result.match(/<\/script>/g)?.length).toBe(1);
  });
});
