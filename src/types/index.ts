export const scannerNames = [
  "deps",
  "dead",
  "env",
  "circular",
  "security",
  "freshness",
] as const;

export type ScannerName = (typeof scannerNames)[number];

export interface StackInfo {
  framework: string | null;
  runtime: string;
  bundler: string | null;
  orm: string | null;
  testRunner: string | null;
}

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  severity: "major" | "minor" | "patch" | "unknown";
}

export interface VulnerabilitySummary {
  total: number;
  high: number;
  critical: number;
  moderate: number;
  low: number;
}

export interface DependencyResult {
  outdated: OutdatedPackage[];
  unused: string[];
  vulnerabilities: VulnerabilitySummary;
  warnings: string[];
}

export interface DeadCodeResult {
  unusedExports: string[];
  orphanFiles: string[];
}

export interface EnvResult {
  ghostVars: string[];
  phantomRefs: string[];
  envFiles: string[];
}

export interface CircularResult {
  cycles: string[][];
}

export interface SecretFinding {
  file: string;
  line: number;
  kind: string;
}

export interface SecurityResult {
  hardcodedSecrets: SecretFinding[];
  envCommitted: boolean;
  committedEnvFiles: string[];
}

export interface FreshnessResult {
  daysSinceCommit: number | null;
  daysSinceRelease: number | null;
  staleBranches: string[];
}

export interface PluginFinding {
  message: string;
  penalty?: number;
  recommendation?: string;
}

export interface PluginResult {
  name: string;
  findings: PluginFinding[];
}

export interface ScannerResults {
  deps: DependencyResult;
  dead: DeadCodeResult;
  env: EnvResult;
  circular: CircularResult;
  security: SecurityResult;
  freshness: FreshnessResult;
}

export interface ScoreResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categoryScores: Record<ScannerName, number>;
}

export interface FixResult {
  removedDependencies: string[];
  warnings: string[];
}

export interface StackRadarReport {
  version: string;
  root: string;
  projectName: string;
  stack: StackInfo;
  results: ScannerResults;
  plugins: PluginResult[];
  score: ScoreResult;
  quickWins: string[];
  fixes?: FixResult;
}

export interface PluginContext {
  root: string;
  report: Omit<StackRadarReport, "plugins" | "score" | "quickWins">;
}

export interface StackRadarPlugin {
  name: string;
  scan(context: PluginContext): Promise<PluginFinding[]> | PluginFinding[];
}

export interface StackRadarConfig {
  weights?: Partial<Record<ScannerName, number>>;
  ignoreDependencies?: string[];
  ignoreEnvVars?: string[];
  ignoreFiles?: string[];
  externalChecks?: boolean;
  staleBranchDays?: number;
  plugins?: Array<string | StackRadarPlugin>;
}
