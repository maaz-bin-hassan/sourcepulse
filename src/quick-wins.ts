import type { StackRadarReport } from "./types/index.js";

export const buildQuickWins = (
  report: Pick<StackRadarReport, "results" | "plugins">,
  limit = 5,
): string[] => {
  const { results } = report;
  return [
    ...results.deps.unused.map((name) => `Remove unused package "${name}"`),
    ...results.dead.orphanFiles.map(
      (file) => `Delete or connect orphan file ${file}`,
    ),
    ...results.env.ghostVars.map(
      (name) => `Remove unused environment variable ${name}`,
    ),
    ...results.env.phantomRefs.map(
      (name) => `Define referenced environment variable ${name}`,
    ),
    ...results.circular.cycles.map(
      (cycle) => `Break circular import ${cycle.join(" -> ")}`,
    ),
    ...results.security.hardcodedSecrets.map(
      ({ file, line }) =>
        `Move hardcoded credential at ${file}:${line} into environment config`,
    ),
    ...report.plugins.flatMap(({ findings }) =>
      findings.flatMap(({ recommendation }) =>
        recommendation ? [recommendation] : [],
      ),
    ),
  ].slice(0, limit);
};
