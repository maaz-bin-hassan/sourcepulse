import pc from "picocolors";
import type { SourcePulseReport } from "./types/index.js";

/* ── ANSI-aware string helpers ─────────────────────────────── */

const RE_ANSI = /\x1b\[[0-9;]*m/g;
const strip = (s: string): string => s.replace(RE_ANSI, "");

/** Visible width accounting for wide (emoji) characters. */
const vWidth = (s: string): number => {
  let w = 0;
  for (const c of strip(s)) {
    w += (c.codePointAt(0) ?? 0) >= 0x1_0000 ? 2 : 1;
  }
  return w;
};

const padR = (s: string, n: number): string =>
  s + " ".repeat(Math.max(0, n - vWidth(s)));

/* ── Layout constants ──────────────────────────────────────── */

const COL = 32;
const BAR = "─".repeat(COL);

const topBorder = `┌${BAR}┬${BAR}┬${BAR}┐`;
const midBorder = `├${BAR}┼${BAR}┼${BAR}┤`;
const botBorder = `└${BAR}┴${BAR}┴${BAR}┘`;

/**
 * Render one visual row of the grid (multiple terminal lines)
 * from three cells (each cell is an array of content lines).
 */
const gridRow = (cells: string[][]): string[] => {
  const maxH = Math.max(...cells.map((c) => c.length));
  const padded = cells.map((c) => [
    ...c,
    ...Array<string>(maxH - c.length).fill(""),
  ]);
  return Array.from({ length: maxH }, (_, i) =>
    `│${padded.map((c) => padR(c[i], COL)).join("│")}│`,
  );
};

/* ── Formatting helpers ────────────────────────────────────── */

const gradeColor = (g: string): ((s: string) => string) => {
  switch (g) {
    case "A":
      return pc.green;
    case "B":
      return pc.green;
    case "C":
      return pc.yellow;
    case "D":
      return pc.red;
    default:
      return pc.red;
  }
};

const daysLabel = (d: number | null): string => {
  if (d === null) return "Unknown";
  if (d === 0) return "Today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
};

/** Highlight a value (bold white). */
const hi = (x: string | number | boolean): string =>
  pc.bold(pc.white(String(x)));

const stackLabel = (r: SourcePulseReport): string =>
  [r.stack.framework, r.stack.orm, r.stack.bundler, r.stack.testRunner]
    .filter(Boolean)
    .join(" + ") || r.stack.runtime;

/* ── Public API ────────────────────────────────────────────── */

export const renderTerminalReport = (report: SourcePulseReport): string => {
  const { results } = report;
  const gc = gradeColor(report.score.grade);

  const out: string[] = [
    "",
    `  ${pc.green(`sourcepulse v${report.version}`)}`,
    `  Scanning ${pc.cyan(report.projectName)} (${stackLabel(report)})`,
    "",
    pc.bold(
      `Overall Score: ${gc(`${report.score.score}/100`)} ${gc(`(${report.score.grade})`)}`,
    ),
    "",
  ];

  /* ── Row 1: Deps · Dead Code · Environment ── */

  const deps: string[] = [
    ` 📦 ${pc.green(pc.bold("Dependencies"))}`,
    `  • Outdated:        ${hi(results.deps.outdated.length)}`,
    `  • Unused:          ${hi(results.deps.unused.length)}`,
    `  • Vulnerabilities: ${hi(results.deps.vulnerabilities.total)}`,
  ];

  const dead: string[] = [
    ` 🔪 ${pc.cyan(pc.bold("Dead Code"))}`,
    `  • Unused exports: ${hi(results.dead.unusedExports.length)}`,
    `  • Orphan files:   ${hi(results.dead.orphanFiles.length)}`,
  ];

  const env: string[] = [
    ` 🌿 ${pc.green(pc.bold("Environment"))}`,
    `  • Ghost vars:   ${hi(results.env.ghostVars.length)}`,
    `  • Phantom refs: ${hi(results.env.phantomRefs.length)}`,
  ];

  /* ── Row 2: Circular · Security · Freshness ── */

  const circ: string[] = [
    ` 🔗 ${pc.yellow(pc.bold("Circular Dependencies"))}`,
    `  • Cycles found: ${hi(results.circular.cycles.length)}`,
  ];

  const sec: string[] = [
    ` 🔒 ${pc.red(pc.bold("Security"))}`,
    `  • Hardcoded secrets: ${hi(results.security.hardcodedSecrets.length)}`,
    `  • .env committed:    ${hi(results.security.envCommitted ? "Yes" : "No")}`,
  ];

  const fresh: string[] = [
    ` 📈 ${pc.blue(pc.bold("Freshness"))}`,
    `  • Last commit:    ${hi(daysLabel(results.freshness.daysSinceCommit))}`,
    `  • Last release:   ${hi(daysLabel(results.freshness.daysSinceRelease))}`,
    `  • Stale branches: ${hi(results.freshness.staleBranches.length)}`,
  ];

  out.push(topBorder, ...gridRow([deps, dead, env]));
  out.push(midBorder, ...gridRow([circ, sec, fresh]));
  out.push(botBorder);

  /* ── Quick Wins ── */

  if (report.quickWins.length > 0) {
    out.push("", ` 💡 ${pc.yellow(pc.bold("Quick Wins"))}`);
    report.quickWins.forEach((win, i) => {
      out.push(`    ${pc.dim(`${i + 1}.`)} ${win}`);
    });
  }

  /* ── Plugins ── */

  if (report.plugins.length > 0) {
    out.push("", ` 🔌 ${pc.magenta(pc.bold("Plugins"))}`);
    for (const plugin of report.plugins) {
      out.push(
        `    • ${plugin.name}: ${hi(`${plugin.findings.length} findings`)}`,
      );
    }
  }

  /* ── Applied Fixes ── */

  if (report.fixes?.removedDependencies.length) {
    out.push("", ` 🔧 ${pc.green(pc.bold("Applied Fixes"))}`);
    out.push(
      `    • Removed packages: ${hi(report.fixes.removedDependencies.join(", "))}`,
    );
    for (const w of report.fixes.warnings) {
      out.push(`    • ${pc.yellow("Warning:")} ${w}`);
    }
  }

  /* ── Dep warnings ── */

  for (const w of results.deps.warnings) {
    out.push("", pc.yellow(`⚠  Warning: ${w}`));
  }

  out.push("");
  return out.join("\n");
};

export const renderJsonReport = (report: SourcePulseReport): string =>
  JSON.stringify(report, null, 2);
