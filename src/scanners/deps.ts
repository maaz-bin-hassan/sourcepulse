import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { type FileAnalysis, packageNameFromSpecifier } from "../analysis.js";
import type {
  DependencyResult,
  OutdatedPackage,
  VulnerabilitySummary,
} from "../types/index.js";

const execFileAsync = promisify(execFile);

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const parseMajor = (version: string): number | null => {
  const match = version.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const severityFor = (
  current: string,
  latest: string,
): OutdatedPackage["severity"] => {
  const currentMajor = parseMajor(current);
  const latestMajor = parseMajor(latest);
  if (currentMajor === null || latestMajor === null) return "unknown";
  if (latestMajor > currentMajor) return "major";
  const currentParts = current.match(/\d+/g) ?? [];
  const latestParts = latest.match(/\d+/g) ?? [];
  if (latestParts[1] !== currentParts[1]) return "minor";
  return "patch";
};

const runJsonCommand = async (
  command: string,
  args: string[],
  cwd: string,
): Promise<{ data: unknown; warning?: string }> => {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd,
      timeout: 10_000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return { data: stdout.trim() ? JSON.parse(stdout) : {} };
  } catch (error) {
    const result = error as Error & { stdout?: string };
    if (result.stdout?.trim()) {
      try {
        return { data: JSON.parse(result.stdout) };
      } catch {
        // Fall through to the warning below.
      }
    }
    return {
      data: {},
      warning: `${command} ${args.join(" ")} could not complete`,
    };
  }
};

const scanOutdated = async (
  root: string,
): Promise<{ packages: OutdatedPackage[]; warning?: string }> => {
  const { data, warning } = await runJsonCommand(
    "npm",
    ["outdated", "--json"],
    root,
  );
  const packages = Object.entries(
    data as Record<string, Record<string, string>>,
  )
    .map(([name, versions]) => ({
      name,
      current: versions.current ?? "unknown",
      wanted: versions.wanted ?? "unknown",
      latest: versions.latest ?? "unknown",
      severity: severityFor(versions.current ?? "", versions.latest ?? ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { packages, warning };
};

const emptyVulnerabilities = (): VulnerabilitySummary => ({
  total: 0,
  high: 0,
  critical: 0,
  moderate: 0,
  low: 0,
});

const scanAudit = async (
  root: string,
): Promise<{ summary: VulnerabilitySummary; warning?: string }> => {
  const { data, warning } = await runJsonCommand(
    "npm",
    ["audit", "--json"],
    root,
  );
  const metadata = (
    data as { metadata?: { vulnerabilities?: Partial<VulnerabilitySummary> } }
  ).metadata;
  return {
    summary: { ...emptyVulnerabilities(), ...metadata?.vulnerabilities },
    warning,
  };
};

const declaredPackages = (pkg: PackageJson): string[] =>
  [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ].sort();

export const scanDependencies = async (
  root: string,
  analyses: FileAnalysis[],
  options: { externalChecks: boolean; ignoreDependencies: string[] },
): Promise<DependencyResult> => {
  let pkg: PackageJson = {};
  try {
    pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    ) as PackageJson;
  } catch {
    return {
      outdated: [],
      unused: [],
      vulnerabilities: emptyVulnerabilities(),
      warnings: ["package.json could not be read"],
    };
  }

  const used = new Set(
    analyses.flatMap((analysis) =>
      analysis.imports
        .map(({ specifier }) => packageNameFromSpecifier(specifier))
        .filter((name): name is string => Boolean(name)),
    ),
  );
  const scripts = Object.values(pkg.scripts ?? {}).join(" ");
  const isUsedInScripts = (name: string): boolean => {
    const executable =
      {
        "@biomejs/biome": "biome",
        "@changesets/cli": "changeset",
      }[name] ??
      name.split("/").at(-1) ??
      name;
    return new RegExp(
      `(^|[\\s;&|])${executable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s;&|:]|$)`,
    ).test(scripts);
  };
  const ignored = new Set(options.ignoreDependencies);
  const unused = declaredPackages(pkg).filter((name) => {
    if (ignored.has(name) || used.has(name) || isUsedInScripts(name))
      return false;
    if (name.startsWith("@types/")) return false;
    return true;
  });

  if (!options.externalChecks) {
    return {
      outdated: [],
      unused,
      vulnerabilities: emptyVulnerabilities(),
      warnings: [],
    };
  }

  const [outdated, audit] = await Promise.all([
    scanOutdated(root),
    scanAudit(root),
  ]);
  return {
    outdated: outdated.packages,
    unused,
    vulnerabilities: audit.summary,
    warnings: [outdated.warning, audit.warning].filter(
      (warning): warning is string => Boolean(warning),
    ),
  };
};
