import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runSourcePulse } from "../src/pipeline.js";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/sample", import.meta.url),
);

describe("runSourcePulse", () => {
  it("loads config, plugins, and produces a scored v0.4 report", async () => {
    const report = await runSourcePulse({ root: fixtureRoot, offline: true });

    expect(report.version).toBe("0.4.1");
    expect(report.projectName).toBe("fixture-app");
    expect(report.stack.framework).toBe("React");
    expect(report.stack.bundler).toBe("Vite");
    expect(report.plugins).toEqual([
      {
        name: "fixture-plugin",
        findings: [{ message: "Fixture plugin is active", penalty: 1 }],
      },
    ]);
    expect(report.score.score).toBeLessThan(100);
    expect(report.quickWins).toContain('Remove unused package "left-pad"');
  });
});
