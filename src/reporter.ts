import pc from "picocolors";
import type { ScannerName, SourcePulseReport } from "./types/index.js";

const categoryLabels: Record<ScannerName, string> = {
  deps: "Dependencies",
  dead: "Dead Code",
  env: "Environment",
  circular: "Circular Dependencies",
  security: "Security",
  freshness: "Freshness",
};

const stackLabel = (report: SourcePulseReport): string =>
  [
    report.stack.framework,
    report.stack.orm,
    report.stack.bundler,
    report.stack.testRunner,
  ]
    .filter(Boolean)
    .join(" + ") || report.stack.runtime;

const line = (label: string, value: string | number | boolean): string =>
  `  ${pc.dim("-")} ${label}: ${String(value)}`;

export const renderTerminalReport = (report: SourcePulseReport): string => {
  const { results } = report;
  const output = [
    pc.bold(`sourcepulse v${report.version}`),
    "",
    `Scanning ${pc.cyan(report.projectName)} (${stackLabel(report)})`,
    "",
    pc.bold(`Overall Score: ${report.score.score}/100 (${report.score.grade})`),
    "",
    pc.bold(categoryLabels.deps),
    line("Outdated", results.deps.outdated.length),
    line("Unused", results.deps.unused.length),
    line("Vulnerabilities", results.deps.vulnerabilities.total),
    "",
    pc.bold(categoryLabels.dead),
    line("Unused exports", results.dead.unusedExports.length),
    line("Orphan files", results.dead.orphanFiles.length),
    "",
    pc.bold(categoryLabels.env),
    line("Ghost vars", results.env.ghostVars.length),
    line("Phantom refs", results.env.phantomRefs.length),
    "",
    pc.bold(categoryLabels.circular),
    line("Cycles", results.circular.cycles.length),
    "",
    pc.bold(categoryLabels.security),
    line("Hardcoded secrets", results.security.hardcodedSecrets.length),
    line(".env committed", results.security.envCommitted ? "Yes" : "No"),
    "",
    pc.bold(categoryLabels.freshness),
    line(
      "Last commit",
      results.freshness.daysSinceCommit === null
        ? "Unknown"
        : results.freshness.daysSinceCommit === 0
          ? "Today"
          : `${results.freshness.daysSinceCommit} days ago`,
    ),
    line(
      "Last release",
      results.freshness.daysSinceRelease === null
        ? "Unknown"
        : results.freshness.daysSinceRelease === 0
          ? "Today"
          : `${results.freshness.daysSinceRelease} days ago`,
    ),
  ];

  if (report.plugins.length > 0) {
    output.push("", pc.bold("Plugins"));
    for (const plugin of report.plugins)
      output.push(line(plugin.name, `${plugin.findings.length} findings`));
  }

  if (report.quickWins.length > 0) {
    output.push("", pc.bold("Quick Wins"));
    report.quickWins.forEach((win, index) => {
      output.push(`  ${index + 1}. ${win}`);
    });
  }

  if (report.fixes?.removedDependencies.length) {
    output.push("", pc.bold("Applied Fixes"));
    output.push(
      line("Removed packages", report.fixes.removedDependencies.join(", ")),
    );
    for (const warning of report.fixes.warnings)
      output.push(line("Warning", warning));
  }

  for (const warning of results.deps.warnings)
    output.push("", pc.yellow(`Warning: ${warning}`));
  return output.join("\n");
};

export const renderJsonReport = (report: SourcePulseReport): string =>
  JSON.stringify(report, null, 2);
