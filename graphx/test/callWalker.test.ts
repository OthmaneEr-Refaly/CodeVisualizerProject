import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadProject } from "../src/parser";
import { scanEntryPoints } from "../src/entryScanner";
import { scanMiddleware, attachMiddleware } from "../src/middlewareScanner";
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

    const controllerToService = result.edges.find(
      (e) => e.from === "UserController.findOne" && e.to === "UserService.findOne"
    );
    expect(controllerToService?.kind).toBe("calls");
  });

  it("inserts a guard node between the entry and controller when the route has @UseGuards", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { entryPoints } = scanEntryPoints(project);
    const result = walkCallGraph(project, entryPoints);

    const entryId = "entry:GET:users/:id";
    const guardId = `guard:${entryId}`;

    const guardNode = result.nodes.find((n) => n.id === guardId);
    expect(guardNode).toMatchObject({ kind: "guard", label: "Guards: AuthGuard" });
    expect(guardNode?.snippet).toContain("@UseGuards(AuthGuard)");

    // entry -> guard -> controller, and NOT a direct entry -> controller edge
    expect(result.edges).toContainEqual({ from: entryId, to: guardId, kind: "triggers" });
    expect(result.edges).toContainEqual({ from: guardId, to: "UserController.findOne", kind: "triggers" });
    expect(result.edges.find((e) => e.from === entryId && e.to === "UserController.findOne")).toBeUndefined();
  });

  it("combines class + method guards into one guard node label for the POST route", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { entryPoints } = scanEntryPoints(project);
    const result = walkCallGraph(project, entryPoints);

    const guardId = "guard:entry:POST:users";
    const guardNode = result.nodes.find((n) => n.id === guardId);
    expect(guardNode?.label).toBe("Guards: AuthGuard, RolesGuard");
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

  it("chains entry -> middleware -> guard -> controller in that order when a route has both", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { entryPoints } = scanEntryPoints(project);
    const { bindings } = scanMiddleware(project);
    const withMiddleware = attachMiddleware(entryPoints, bindings);
    const result = walkCallGraph(project, withMiddleware);

    const entryId = "entry:GET:users/:id";
    const middlewareId = `middleware:${entryId}`;
    const guardId = `guard:${entryId}`;

    const middlewareNode = result.nodes.find((n) => n.id === middlewareId);
    expect(middlewareNode).toMatchObject({
      kind: "middleware",
      label: "Middleware: RequestLoggerMiddleware",
    });

    // Full lifecycle order: entry -> middleware -> guard -> controller,
    // with NO shortcut edges skipping a stage.
    expect(result.edges).toContainEqual({ from: entryId, to: middlewareId, kind: "triggers" });
    expect(result.edges).toContainEqual({ from: middlewareId, to: guardId, kind: "triggers" });
    expect(result.edges).toContainEqual({ from: guardId, to: "UserController.findOne", kind: "triggers" });
    expect(result.edges.find((e) => e.from === entryId && e.to === guardId)).toBeUndefined();
    expect(result.edges.find((e) => e.from === entryId && e.to === "UserController.findOne")).toBeUndefined();
  });
});
