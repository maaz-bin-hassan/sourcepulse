import { readFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import {
  type FileAnalysis,
  normalizePath,
  resolveLocalImport,
} from "../analysis.js";
import type { DeadCodeResult } from "../types/index.js";

interface PackageJson {
  main?: string;
  module?: string;
  types?: string;
  bin?: string | Record<string, string>;
  exports?: unknown;
}

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectStrings);
};

const entryFiles = async (
  root: string,
  analyses: FileAnalysis[],
): Promise<Set<string>> => {
  let pkg: PackageJson = {};
  try {
    pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    ) as PackageJson;
  } catch {
    // Fall back to conventional entry files.
  }
  const knownFiles = new Set(analyses.map(({ file }) => file));
  const manifestEntries = [
    pkg.main,
    pkg.module,
    pkg.types,
    ...collectStrings(pkg.bin),
    ...collectStrings(pkg.exports),
  ].filter((value): value is string => Boolean(value));
  const resolvedEntries = manifestEntries
    .map((entry) =>
      resolveLocalImport(
        resolve(root, "__entry__.ts"),
        `./${entry}`,
        knownFiles,
      ),
    )
    .filter((file): file is string => Boolean(file));
  const conventional = analyses
    .filter(({ file }) =>
      ["index", "main", "cli", "app"].includes(
        basename(file, extname(file)).toLowerCase(),
      ),
    )
    .map(({ file }) => file);
  return new Set([...resolvedEntries, ...conventional]);
};

const isCandidateOrphan = (file: string): boolean => {
  const normalized = normalizePath(file);
  const filename = basename(normalized, extname(normalized)).toLowerCase();
  return (
    !normalized.startsWith("test") &&
    !normalized.includes("/test") &&
    !normalized.includes("/__tests__/") &&
    !normalized.includes("/fixtures/") &&
    !normalized.endsWith(".config.ts") &&
    !normalized.endsWith(".config.js") &&
    filename !== "plugin"
  );
};

const reportsUnusedExports = (
  analysis: FileAnalysis,
  roots: Set<string>,
): boolean => {
  const filename = basename(
    analysis.file,
    extname(analysis.file),
  ).toLowerCase();
  return (
    !roots.has(analysis.file) &&
    !analysis.relativeFile.includes(".config.") &&
    filename !== "plugin"
  );
};

export const scanDeadCode = async (
  root: string,
  analyses: FileAnalysis[],
): Promise<DeadCodeResult> => {
  const roots = await entryFiles(root, analyses);
  const reachable = new Set<string>();
  const byFile = new Map(analyses.map((analysis) => [analysis.file, analysis]));

  const visit = (file: string): void => {
    if (reachable.has(file)) return;
    reachable.add(file);
    for (const dependency of byFile.get(file)?.imports ?? []) {
      if (dependency.resolvedFile) visit(dependency.resolvedFile);
    }
  };
  for (const rootFile of roots) visit(rootFile);

  const importedNames = new Map<string, Set<string>>();
  for (const analysis of analyses) {
    for (const dependency of analysis.imports) {
      if (!dependency.resolvedFile) continue;
      const names =
        importedNames.get(dependency.resolvedFile) ?? new Set<string>();
      for (const name of dependency.names) names.add(name);
      importedNames.set(dependency.resolvedFile, names);
    }
  }

  const unusedExports = analyses
    .filter((analysis) => reportsUnusedExports(analysis, roots))
    .flatMap((analysis) => {
      const used = importedNames.get(analysis.file) ?? new Set<string>();
      if (used.has("*")) return [];
      return analysis.exports
        .filter((name) => name !== "*" && !used.has(name))
        .map((name) => `${analysis.relativeFile}#${name}`);
    });

  const orphanFiles =
    roots.size === 0
      ? []
      : analyses
          .filter(
            ({ file }) =>
              !reachable.has(file) && isCandidateOrphan(relative(root, file)),
          )
          .map(({ relativeFile }) => relativeFile)
          .sort();

  return { unusedExports: unusedExports.sort(), orphanFiles };
};
