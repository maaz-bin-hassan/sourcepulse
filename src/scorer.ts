import { defaultWeights } from "./defaults.js";
import type {
  PluginResult,
  ScannerName,
  ScannerResults,
  ScoreResult,
} from "./types/index.js";

const clamp = (score: number): number => Math.max(0, Math.min(100, score));

const gradeFor = (score: number): ScoreResult["grade"] => {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
};

const categoryScores = (
  results: ScannerResults,
): Record<ScannerName, number> => ({
  deps: clamp(
    100 -
      results.deps.outdated.filter(({ severity }) => severity === "major")
        .length *
        5 -
      results.deps.unused.length * 2 -
      (results.deps.vulnerabilities.high +
        results.deps.vulnerabilities.critical) *
        8,
  ),
  dead: clamp(
    100 -
      results.dead.orphanFiles.length * 2 -
      results.dead.unusedExports.length,
  ),
  env: clamp(
    100 - results.env.ghostVars.length * 3 - results.env.phantomRefs.length * 5,
  ),
  circular: clamp(100 - results.circular.cycles.length * 5),
  security: clamp(
    100 -
      results.security.hardcodedSecrets.length * 10 -
      (results.security.envCommitted ? 8 : 0),
  ),
  freshness: clamp(
    100 -
      (results.freshness.daysSinceCommit !== null &&
      results.freshness.daysSinceCommit > 30
        ? 3
        : 0) -
      (results.freshness.daysSinceRelease !== null &&
      results.freshness.daysSinceRelease > 90
        ? 5
        : 0),
  ),
});

export const scoreReport = (
  results: ScannerResults,
  plugins: PluginResult[],
  weights: Partial<Record<ScannerName, number>> = defaultWeights,
): ScoreResult => {
  const scores = categoryScores(results);
  const resolvedWeights = { ...defaultWeights, ...weights };
  const weightTotal = Object.values(resolvedWeights).reduce(
    (total, weight) => total + weight,
    0,
  );
  const weightedScore =
    Object.entries(scores).reduce(
      (total, [name, score]) =>
        total + score * resolvedWeights[name as ScannerName],
      0,
    ) / weightTotal;
  const pluginPenalty = plugins
    .flatMap(({ findings }) => findings)
    .reduce((total, { penalty = 0 }) => total + penalty, 0);
  const score = Math.round(clamp(weightedScore - pluginPenalty));

  return { score, grade: gradeFor(score), categoryScores: scores };
};
