import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadProject } from "../src/parser";
import { scanEntryPoints } from "../src/entryScanner";
import { walkCallGraph } from "../src/callWalker";

const FIXTURE_DIR = path.join(__dirname, "fixtures/app");

describe("walkCallGraph", () => {
  it("follows a controller method into the service it calls via DI", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { entryPoints } = scanEntryPoints(project);
    const result = walkCallGraph(project, entryPoints);

    expect(result.warnings).toEqual([]);

    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain("entry:GET:users/:id");
    expect(nodeIds).toContain("UserController.findOne");
    expect(nodeIds).toContain("UserService.findOne");

    const entryToController = result.edges.find(
      (e) => e.from === "entry:GET:users/:id" && e.to === "UserController.findOne"
    );
    expect(entryToController?.kind).toBe("triggers");

    const controllerToService = result.edges.find(
      (e) => e.from === "UserController.findOne" && e.to === "UserService.findOne"
    );
    expect(controllerToService?.kind).toBe("calls");
  });

  it("captures file, line, and a code snippet on service nodes", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { entryPoints } = scanEntryPoints(project);
    const result = walkCallGraph(project, entryPoints);

    const serviceNode = result.nodes.find((n) => n.id === "UserService.findOne");
    expect(serviceNode?.kind).toBe("service");
    expect(serviceNode?.line).toBeGreaterThan(0);
    expect(serviceNode?.snippet).toContain("findOne");
    expect(serviceNode?.filePath).toMatch(/user\.service\.ts$/);
  });

  it("also resolves the POST route into UserService.create", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { entryPoints } = scanEntryPoints(project);
    const result = walkCallGraph(project, entryPoints);

    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain("UserService.create");

    const edge = result.edges.find(
      (e) => e.from === "UserController.create" && e.to === "UserService.create"
    );
    expect(edge).toBeDefined();
  });
});
