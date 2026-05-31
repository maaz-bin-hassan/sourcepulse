import { execFile } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { FixResult } from "./types/index.js";

const execFileAsync = promisify(execFile);

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

export const applyFixes = async (
  root: string,
  unusedDependencies: string[],
): Promise<FixResult> => {
  if (unusedDependencies.length === 0)
    return { removedDependencies: [], warnings: [] };

  const packageFile = resolve(root, "package.json");
  const pkg = JSON.parse(await readFile(packageFile, "utf8")) as Record<
    string,
    Record<string, string> | unknown
  >;
  for (const section of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const dependencies = pkg[section];
    if (
      !dependencies ||
      typeof dependencies !== "object" ||
      Array.isArray(dependencies)
    )
      continue;
    for (const name of unusedDependencies)
      delete (dependencies as Record<string, string>)[name];
    if (Object.keys(dependencies).length === 0) delete pkg[section];
  }
  await writeFile(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);

  const warnings: string[] = [];
  if (await exists(resolve(root, "package-lock.json"))) {
    try {
      await execFileAsync(
        "npm",
        [
          "install",
          "--package-lock-only",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
        ],
        { cwd: root, timeout: 30_000 },
      );
    } catch {
      warnings.push(
        "package-lock.json could not be refreshed; run npm install",
      );
    }
  }
  return { removedDependencies: unusedDependencies, warnings };
};
