import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyFixes } from "../src/fixer.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("applyFixes", () => {
  it("removes unused dependencies from package.json", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sourcepulse-fix-"));
    temporaryRoots.push(root);
    await writeFile(
      resolve(root, "package.json"),
      `${JSON.stringify({
        dependencies: { lodash: "^4.17.21", "left-pad": "^1.3.0" },
      })}\n`,
    );

    const result = await applyFixes(root, ["left-pad"]);
    const pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
    };

    expect(result).toEqual({ removedDependencies: ["left-pad"], warnings: [] });
    expect(pkg.dependencies).toEqual({ lodash: "^4.17.21" });
  });
});
