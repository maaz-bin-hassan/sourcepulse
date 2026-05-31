# SourcePulse

[![npm version](https://img.shields.io/npm/v/sourcepulse.svg)](https://www.npmjs.com/package/sourcepulse)
[![license](https://img.shields.io/npm/l/sourcepulse.svg)](./LICENSE)

Zero-config project intelligence for JavaScript and TypeScript repositories.

```bash
npx sourcepulse
```

SourcePulse scans a local repository and produces a scored health report with practical cleanup suggestions. It runs locally, does not upload your source code, and does not require a configuration file.

## What It Checks

| Area | Checks |
| --- | --- |
| Dependencies | Outdated packages, unused packages, npm audit vulnerabilities |
| Dead code | Unused exports and orphan files |
| Environment | Defined-but-unused variables and referenced-but-missing variables |
| Imports | Circular dependency chains |
| Security | Likely hardcoded credentials and committed `.env` files |
| Freshness | Recent commits, releases, and stale branches |

## Quick Start

Scan the current directory:

```bash
npx sourcepulse
```

Scan another project:

```bash
npx sourcepulse ../my-project
```

Example output:

```text
sourcepulse v0.4.1

Scanning my-app (Next.js + Prisma + Vitest)

Overall Score: 82/100 (B)

Dependencies
  - Outdated: 4
  - Unused: 1
  - Vulnerabilities: 0

Dead Code
  - Unused exports: 3
  - Orphan files: 1

Environment
  - Ghost vars: 1
  - Phantom refs: 0

Quick Wins
  1. Remove unused package "left-pad"
  2. Delete or connect orphan file src/legacy.ts
  3. Remove unused environment variable OLD_API_URL
```

## CLI Options

| Option | Description |
| --- | --- |
| `--json` | Print the complete report as JSON |
| `--ci` | Enable CI exit behavior with a default minimum score of `70` |
| `--score-min <score>` | Exit with code `1` when the score is below the selected threshold |
| `--only <scanners>` | Run selected scanners, such as `deps,env,security` |
| `--offline` | Skip network-backed `npm outdated` and `npm audit` checks |
| `--fix` | Remove detected unused packages from `package.json` |

Examples:

```bash
npx sourcepulse --json
npx sourcepulse --only=deps,env,security
npx sourcepulse --offline
npx sourcepulse --ci --score-min=80
```

### Using `--fix`

`--fix` only removes packages detected as unused and refreshes `package-lock.json` when present.

```bash
npx sourcepulse --fix
git diff
```

Review the resulting diff before committing. Static analysis can require project-specific judgment.

## CI Usage

Add SourcePulse to GitHub Actions:

```yaml
- name: Run SourcePulse
  run: npx sourcepulse --ci --json --score-min=70
```

The command exits with code `1` when the score falls below the selected minimum.

## Optional Configuration

SourcePulse works without configuration. To customize behavior, add `sourcepulse.config.ts` in the project root:

```ts
import type { SourcePulseConfig } from "sourcepulse";

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
} satisfies SourcePulseConfig;
```

Supported config filenames:

```text
sourcepulse.config.ts
sourcepulse.config.mts
sourcepulse.config.js
sourcepulse.config.mjs
sourcepulse.config.cjs
sourcepulse.config.json
```

Legacy `stackradar.config.*` and `stackprobe.config.*` filenames are also supported.

## Plugins

Plugins can add project-specific findings:

```ts
import type { SourcePulsePlugin } from "sourcepulse";

export default {
  name: "license-policy",
  scan: async ({ root }) => {
    return [{ message: `Review licenses in ${root}`, penalty: 2 }];
  },
} satisfies SourcePulsePlugin;
```

Register the plugin from your config file:

```ts
export default {
  plugins: ["./tools/sourcepulse-license-plugin.ts"],
};
```

## Requirements

- Node.js `20` or newer
- npm for dependency checks
- Git for repository freshness and committed `.env` detection

## Development

```bash
npm install
npm run build-check
npm run lint
npm test
npm run build
```

## License

[MIT](./LICENSE)
