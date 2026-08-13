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
});
