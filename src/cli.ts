import { resolve } from "node:path";
import { cac } from "cac";
import { runSourcePulse } from "./pipeline.js";
import { renderJsonReport, renderTerminalReport } from "./reporter.js";
import { type ScannerName, scannerNames } from "./types/index.js";

const parseOnly = (value: string | undefined): ScannerName[] | undefined => {
  if (!value) return undefined;
  const requested = value.split(",").map((name) => name.trim());
  const invalid = requested.filter(
    (name) => !scannerNames.includes(name as ScannerName),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unknown scanners: ${invalid.join(", ")}. Choose from: ${scannerNames.join(", ")}`,
    );
  }
  return requested as ScannerName[];
};

const cli = cac("sourcepulse");

cli
  .command("[root]", "Scan a JavaScript or TypeScript repository")
  .option("--json", "Print the full report as JSON")
  .option("--ci", "Use CI exit behavior")
  .option(
    "--fix",
    "Remove unused packages from package.json and refresh package-lock.json",
  )
  .option("--only <scanners>", "Run selected scanners, comma-separated")
  .option(
    "--score-min <score>",
    "Exit with code 1 when the score is below this value",
  )
  .option("--offline", "Skip npm outdated and npm audit network checks")
  .action(
    async (
      root: string | undefined,
      options: {
        json?: boolean;
        ci?: boolean;
        fix?: boolean;
        only?: string;
        scoreMin?: string;
        offline?: boolean;
      },
    ) => {
      try {
        const report = await runSourcePulse({
          root: resolve(root ?? process.cwd()),
          only: parseOnly(options.only),
          fix: options.fix,
          offline: options.offline,
        });
        console.log(
          options.json
            ? renderJsonReport(report)
            : renderTerminalReport(report),
        );
        const minimum = options.scoreMin
          ? Number(options.scoreMin)
          : options.ci
            ? 70
            : null;
        if (
          minimum !== null &&
          (!Number.isFinite(minimum) || minimum < 0 || minimum > 100)
        ) {
          throw new Error("--score-min must be a number between 0 and 100");
        }
        if (minimum !== null && report.score.score < minimum)
          process.exitCode = 1;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    },
  );

cli.help();
cli.version("0.4.1");
cli.parse();
