import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { StackInfo } from "./types/index.js";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const findFirst = (
  packages: Set<string>,
  choices: Array<[string, string]>,
): string | null => choices.find(([name]) => packages.has(name))?.[1] ?? null;

export const detectStack = async (root: string): Promise<StackInfo> => {
  let pkg: PackageJson = {};
  try {
    pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    ) as PackageJson;
  } catch {
    // Stack detection remains useful for repositories with an incomplete manifest.
  }
  const packages = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);

  return {
    framework: findFirst(packages, [
      ["next", "Next.js"],
      ["react-native", "React Native"],
      ["@angular/core", "Angular"],
      ["vue", "Vue"],
      ["svelte", "Svelte"],
      ["express", "Express"],
      ["fastify", "Fastify"],
      ["react", "React"],
    ]),
    runtime: packages.has("bun-types")
      ? "Bun"
      : packages.has("deno")
        ? "Deno"
        : "Node.js",
    bundler: findFirst(packages, [
      ["vite", "Vite"],
      ["webpack", "webpack"],
      ["esbuild", "esbuild"],
      ["tsup", "tsup"],
      ["rollup", "Rollup"],
    ]),
    orm: findFirst(packages, [
      ["prisma", "Prisma"],
      ["@prisma/client", "Prisma"],
      ["drizzle-orm", "Drizzle"],
      ["typeorm", "TypeORM"],
      ["sequelize", "Sequelize"],
    ]),
    testRunner: findFirst(packages, [
      ["vitest", "Vitest"],
      ["jest", "Jest"],
      ["mocha", "Mocha"],
      ["@playwright/test", "Playwright"],
    ]),
  };
};
