import type {
  ScannerName,
  ScannerResults,
  SourcePulseConfig,
} from "./types/index.js";

export const defaultWeights: Record<ScannerName, number> = {
  deps: 25,
  dead: 20,
  env: 15,
  circular: 15,
  security: 15,
  freshness: 10,
};

export const defaultConfig: Required<
  Pick<
    SourcePulseConfig,
    | "ignoreDependencies"
    | "ignoreEnvVars"
    | "ignoreFiles"
    | "externalChecks"
    | "staleBranchDays"
    | "plugins"
  >
> = {
  ignoreDependencies: [],
  ignoreEnvVars: ["NODE_ENV"],
  ignoreFiles: [],
  externalChecks: true,
  staleBranchDays: 90,
  plugins: [],
};

export const emptyResults = (): ScannerResults => ({
  deps: {
    outdated: [],
    unused: [],
    vulnerabilities: { total: 0, high: 0, critical: 0, moderate: 0, low: 0 },
    warnings: [],
  },
  dead: { unusedExports: [], orphanFiles: [] },
  env: { ghostVars: [], phantomRefs: [], envFiles: [] },
  circular: { cycles: [] },
  security: {
    hardcodedSecrets: [],
    envCommitted: false,
    committedEnvFiles: [],
  },
  freshness: {
    daysSinceCommit: null,
    daysSinceRelease: null,
    staleBranches: [],
  },
});
