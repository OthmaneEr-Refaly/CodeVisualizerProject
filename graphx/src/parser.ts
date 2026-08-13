import { Project } from "ts-morph";

/**
 * Stage 1: parse.
 * Takes a project root, returns a ts-morph Project loaded with its source files.
 * This is a thin, pure wrapper on purpose — it does nothing except load files,
 * so every later stage can be tested against a Project built here without
 * needing real files on disk (ts-morph supports in-memory file systems too).
 */
export function loadProject(rootDir: string, globPattern = "src/**/*.ts"): Project {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(`${rootDir}/${globPattern}`);

  if (project.getSourceFiles().length === 0) {
    throw new Error(
      `No TypeScript files found under ${rootDir}/${globPattern}. Check the path and try again.`
    );
  }

  return project;
}
