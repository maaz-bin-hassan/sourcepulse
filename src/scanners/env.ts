import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import dotenv from "dotenv";
import fg from "fast-glob";
import { type FileAnalysis, normalizePath } from "../analysis.js";
import type { EnvResult } from "../types/index.js";

const envPatterns = [".env", ".env.*", "**/.env", "**/.env.*"];

export const scanEnv = async (
  root: string,
  analyses: FileAnalysis[],
  ignoreEnvVars: string[],
): Promise<EnvResult> => {
  const files = await fg(envPatterns, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore: ["**/node_modules/**", "**/fixtures/**", "**/.git/**"],
  });
  const defined = new Set<string>();
  for (const file of files) {
    const parsed = dotenv.parse(await readFile(file, "utf8"));
    for (const name of Object.keys(parsed)) defined.add(name);
  }
  const ignored = new Set(ignoreEnvVars);
  const used = new Set(analyses.flatMap((analysis) => analysis.envRefs));

  return {
    ghostVars: [...defined]
      .filter((name) => !used.has(name) && !ignored.has(name))
      .sort(),
    phantomRefs: [...used]
      .filter((name) => !defined.has(name) && !ignored.has(name))
      .sort(),
    envFiles: files.map((file) => normalizePath(relative(root, file))).sort(),
  };
};
