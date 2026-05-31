# StackRadar

Zero-config project intelligence for JavaScript and TypeScript repositories.

```bash
npx stackradar
```

StackRadar scans a local repository and produces a scored health report covering dependencies, dead code, environment hygiene, circular imports, security issues, and Git freshness. It runs locally with no cloud service or required configuration.

## Features

- Detects frameworks, runtimes, bundlers, ORMs, and test runners
- Reports outdated, unused, and vulnerable npm packages
- Finds unused exports, orphan files, and circular imports with TypeScript AST analysis
- Detects ghost and phantom environment variables
- Flags likely hardcoded credentials and committed `.env` files
- Measures Git activity and stale branches
- Prints terminal or JSON reports and supports CI score thresholds
- Supports custom weights, ignore lists, plugins, and conservative dependency cleanup

## Requirements

- Node.js 20 or newer
- npm for external dependency checks
- Git for repository freshness and tracked `.env` detection

## Usage

```bash
stackradar [root]

stackradar --json
stackradar --ci --score-min=70
stackradar --only=deps,env,security
stackradar --offline
stackradar --fix
```

`--offline` skips `npm outdated` and `npm audit`. `--fix` removes packages identified as unused from `package.json` and refreshes `package-lock.json` when present. Review the diff before committing.

## Configuration

StackRadar automatically loads `stackradar.config.ts`, `.mts`, `.js`, `.mjs`, `.cjs`, or `.json` from the scanned repository root. Legacy `stackprobe.config.*` files are also supported.

```ts
import type { StackRadarConfig } from "stackradar";

export default {
  weights: {
    security: 30,
    deps: 20,
  },
  ignoreDependencies: ["@types/node"],
  ignoreEnvVars: ["NODE_ENV"],
  ignoreFiles: ["**/generated/**"],
  externalChecks: true,
  staleBranchDays: 60,
  plugins: ["./tools/stackradar-license-plugin.ts"],
} satisfies StackRadarConfig;
```

Plugins receive the scan context and return findings:

```ts
import type { StackRadarPlugin } from "stackradar";

export default {
  name: "license-policy",
  scan: async ({ root }) => {
    return [{ message: `Review licenses in ${root}`, penalty: 2 }];
  },
} satisfies StackRadarPlugin;
```

## CI

```yaml
- name: Run StackRadar
  run: npx stackradar --ci --json --score-min=70
```

The command exits with code `1` when the resulting score is below the selected minimum.

## Development

```bash
npm install
npm run build-check
npm run lint
npm test
npm run build
```

## Roadmap Delivered

- `v0.1`: stack detection, dependency checks, environment hygiene, Git freshness, terminal report
- `v0.2`: dead-code analysis, circular imports, JSON output
- `v0.3`: secret detection, tracked `.env` checks, CI thresholds
- `v0.4`: config loading, custom scoring, `--fix`, JSR metadata, plugin API
