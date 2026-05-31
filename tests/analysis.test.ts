import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../src/analysis.js";
import { scanCircular } from "../src/scanners/circular.js";
import { scanDeadCode } from "../src/scanners/dead.js";
import { scanDependencies } from "../src/scanners/deps.js";
import { scanEnv } from "../src/scanners/env.js";
import { scanSecurity } from "../src/scanners/security.js";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/sample", import.meta.url),
);

describe("SourcePulse scanners", () => {
  it("finds dependency usage without external npm calls", async () => {
    const analyses = await analyzeProject(fixtureRoot);
    const result = await scanDependencies(fixtureRoot, analyses, {
      externalChecks: false,
      ignoreDependencies: ["react", "vite", "vitest"],
    });

    expect(result.unused).toEqual(["left-pad"]);
    expect(result.outdated).toEqual([]);
  });

  it("finds env hygiene issues", async () => {
    const analyses = await analyzeProject(fixtureRoot);
    const result = await scanEnv(fixtureRoot, analyses, ["NODE_ENV"]);

    expect(result.ghostVars).toEqual(["GHOST_KEY"]);
    expect(result.phantomRefs).toEqual(["MISSING_KEY"]);
  });

  it("finds dead code and circular imports", async () => {
    const analyses = await analyzeProject(fixtureRoot);
    const [dead, circular] = await Promise.all([
      scanDeadCode(fixtureRoot, analyses),
      scanCircular(analyses),
    ]);

    expect(dead.orphanFiles).toContain("src/orphan.ts");
    expect(dead.unusedExports).toContain("src/util.ts#unusedHelper");
    expect(circular.cycles).toHaveLength(1);
  });

  it("flags likely hardcoded credentials", async () => {
    const analyses = await analyzeProject(fixtureRoot);
    const result = await scanSecurity(fixtureRoot, analyses);

    expect(result.hardcodedSecrets).toContainEqual({
      file: "src/index.ts",
      line: 6,
      kind: "hardcoded credential",
    });
  });
});
