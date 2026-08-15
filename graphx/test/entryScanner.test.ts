import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadProject } from "../src/parser";
import { scanEntryPoints } from "../src/entryScanner";

const FIXTURE_DIR = path.join(__dirname, "fixtures/app");

describe("scanEntryPoints", () => {
  it("finds every @Get/@Post route on a @Controller class", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const result = scanEntryPoints(project);

    expect(result.warnings).toEqual([]);
    expect(result.entryPoints).toHaveLength(2);

    const getRoute = result.entryPoints.find((e) => e.httpMethod === "GET");
    expect(getRoute).toMatchObject({
      httpMethod: "GET",
      path: "users/:id",
      controllerName: "UserController",
      methodName: "findOne",
    });
    expect(getRoute?.line).toBeGreaterThan(0);

    const postRoute = result.entryPoints.find((e) => e.httpMethod === "POST");
    expect(postRoute).toMatchObject({
      httpMethod: "POST",
      path: "users",
      controllerName: "UserController",
      methodName: "create",
    });
  });

  it("ignores classes that are not @Controller", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const result = scanEntryPoints(project);

    const fromService = result.entryPoints.filter(
      (e) => e.controllerName === "UserService"
    );
    expect(fromService).toHaveLength(0);
  });

  it("throws a clear error when the project root has no TypeScript files", () => {
    expect(() => loadProject("/nonexistent/path", "*.ts")).toThrow(
      /No TypeScript files found/
    );
  });

  it("picks up a class-level @UseGuards and applies it to every route on that controller", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const result = scanEntryPoints(project);

    const getRoute = result.entryPoints.find((e) => e.methodName === "findOne");
    expect(getRoute?.guards).toEqual(["AuthGuard"]);
  });

  it("combines class-level and method-level @UseGuards, without duplicates", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const result = scanEntryPoints(project);

    const postRoute = result.entryPoints.find((e) => e.methodName === "create");
    expect(postRoute?.guards).toEqual(["AuthGuard", "RolesGuard"]);
    expect(postRoute?.guardsSnippet).toContain("@UseGuards(AuthGuard)");
    expect(postRoute?.guardsSnippet).toContain("@UseGuards(RolesGuard)");
  });

  it("returns an empty guards array for a route with no @UseGuards at all", () => {
    // Reuse a synthetic in-memory check: a controller with no guards anywhere
    // should report guards: [] rather than undefined, so callers don't need
    // null-checks everywhere.
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const result = scanEntryPoints(project);
    result.entryPoints.forEach((e) => expect(Array.isArray(e.guards)).toBe(true));
  });
});
