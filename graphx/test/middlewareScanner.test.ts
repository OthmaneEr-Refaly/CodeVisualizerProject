import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadProject } from "../src/parser";
import { scanEntryPoints } from "../src/entryScanner";
import { scanMiddleware, attachMiddleware } from "../src/middlewareScanner";

const FIXTURE_DIR = path.join(__dirname, "fixtures/app");

describe("scanMiddleware", () => {
  it("finds a consumer.apply(...).forRoutes(...) binding inside configure()", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { bindings, warnings } = scanMiddleware(project);

    expect(warnings).toEqual([]);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      middlewareNames: ["RequestLoggerMiddleware"],
      routePatterns: ["users"],
    });
    expect(bindings[0].line).toBeGreaterThan(0);
    expect(bindings[0].snippet).toContain("RequestLoggerMiddleware");
    expect(bindings[0].filePath).toMatch(/user\.module\.ts$/);
  });

  it("ignores classes with no configure() method", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { bindings } = scanMiddleware(project);

    // Only UserModule has configure() in the fixture — nothing from
    // UserController, UserService, or the guard classes should leak in.
    expect(bindings.every((b) => b.filePath.endsWith("user.module.ts"))).toBe(true);
  });
});

describe("attachMiddleware", () => {
  it("attaches a matching binding to every route under the bound path", () => {
    const project = loadProject(FIXTURE_DIR, "*.ts");
    const { entryPoints } = scanEntryPoints(project);
    const { bindings } = scanMiddleware(project);

    const withMiddleware = attachMiddleware(entryPoints, bindings);

    // Both users/:id and users routes should get the middleware —
    // the binding is on the 'users' path prefix, which covers both.
    withMiddleware.forEach((e) => {
      expect(e.middleware).toEqual(["RequestLoggerMiddleware"]);
      expect(e.middlewareSnippet).toContain("forRoutes(\"users\")");
    });
  });

  it("leaves middleware empty for a route that matches no binding", () => {
    const entryPoints = [
      {
        httpMethod: "GET",
        path: "orders",
        controllerName: "OrderController",
        methodName: "list",
        filePath: "/fake/order.controller.ts",
        line: 1,
        guards: [],
        middleware: [],
      },
    ];
    const bindings = [
      {
        middlewareNames: ["RequestLoggerMiddleware"],
        routePatterns: ["users"],
        filePath: "/fake/user.module.ts",
        line: 5,
        snippet: "consumer.apply(RequestLoggerMiddleware).forRoutes('users')",
      },
    ];

    const result = attachMiddleware(entryPoints, bindings);
    expect(result[0].middleware).toEqual([]);
  });

  it("matches a controller-name pattern like forRoutes(UserController)", () => {
    const entryPoints = [
      {
        httpMethod: "GET",
        path: "users/:id",
        controllerName: "UserController",
        methodName: "findOne",
        filePath: "/fake/user.controller.ts",
        line: 1,
        guards: [],
        middleware: [],
      },
    ];
    const bindings = [
      {
        middlewareNames: ["AuditMiddleware"],
        routePatterns: ["UserController"],
        filePath: "/fake/user.module.ts",
        line: 5,
        snippet: "consumer.apply(AuditMiddleware).forRoutes(UserController)",
      },
    ];

    const result = attachMiddleware(entryPoints, bindings);
    expect(result[0].middleware).toEqual(["AuditMiddleware"]);
  });
});
