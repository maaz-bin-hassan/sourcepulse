import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { analyzeProject } from "./analysis.js";
import { loadConfig, type ResolvedConfig } from "./config.js";
import { emptyResults } from "./defaults.js";
import { detectStack } from "./detector.js";
import { applyFixes } from "./fixer.js";
import { buildQuickWins } from "./quick-wins.js";
import {
  scanCircular,
  scanDeadCode,
  scanDependencies,
  scanEnv,
  scanFreshness,
  scanSecurity,
} from "./scanners/index.js";
import { scoreReport } from "./scorer.js";
import {
  type FixResult,
  type PluginResult,
  type ScannerName,
  type StackRadarReport,
  scannerNames,
} from "./types/index.js";

export interface RunOptions {
  root: string;
  only?: ScannerName[];
  fix?: boolean;
  offline?: boolean;
}

const readProjectName = async (root: string): Promise<string> => {
  try {
    const pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    ) as {
      name?: string;
    };
    return pkg.name ?? basename(root);
  } catch {
    return basename(root);
  }
};

const runOnce = async (
  root: string,
  selected: Set<ScannerName>,
  config: ResolvedConfig,
  fixes?: FixResult,
): Promise<StackRadarReport> => {
  const [analyses, stack, projectName] = await Promise.all([
    analyzeProject(root, config.ignoreFiles),
    detectStack(root),
    readProjectName(root),
  ]);
  const results = emptyResults();

  await Promise.all([
    selected.has("deps")
      ? scanDependencies(root, analyses, {
          externalChecks: config.externalChecks,
          ignoreDependencies: config.ignoreDependencies,
        }).then((result) => {
          results.deps = result;
        })
      : undefined,
    selected.has("dead")
      ? scanDeadCode(root, analyses).then((result) => {
          results.dead = result;
        })
      : undefined,
    selected.has("env")
      ? scanEnv(root, analyses, config.ignoreEnvVars).then((result) => {
          results.env = result;
        })
      : undefined,
    selected.has("circular")
      ? scanCircular(analyses).then((result) => {
          results.circular = result;
        })
      : undefined,
    selected.has("security")
      ? scanSecurity(root, analyses).then((result) => {
          results.security = result;
        })
      : undefined,
    selected.has("freshness")
      ? scanFreshness(root, config.staleBranchDays).then((result) => {
          results.freshness = result;
        })
      : undefined,
  ]);

  const partial = {
    version: "0.4.0",
    root,
    projectName,
    stack,
    results,
    fixes,
  };
  const plugins: PluginResult[] = await Promise.all(
    config.plugins.map(async (plugin) => ({
      name: plugin.name,
      findings: await plugin.scan({ root, report: partial }),
    })),
  );
  const score = scoreReport(results, plugins, config.weights);
  const quickWins = buildQuickWins({ results, plugins });
  return { ...partial, plugins, score, quickWins };
};

export const runStackRadar = async (
  options: RunOptions,
): Promise<StackRadarReport> => {
  const root = resolve(options.root);
  const selected = new Set(options.only ?? scannerNames);
  const config = await loadConfig(root);
  if (options.offline) config.externalChecks = false;

  const initial = await runOnce(root, selected, config);
  if (!options.fix) return initial;

  const fixes = await applyFixes(root, initial.results.deps.unused);
  return runOnce(root, selected, config, fixes);
};
