import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { defaultConfig, defaultWeights } from "./defaults.js";
import type { StackRadarConfig, StackRadarPlugin } from "./types/index.js";

const configFiles = [
  "stackradar.config.ts",
  "stackradar.config.mts",
  "stackradar.config.js",
  "stackradar.config.mjs",
  "stackradar.config.cjs",
  "stackradar.config.json",
  "stackprobe.config.ts",
  "stackprobe.config.mts",
  "stackprobe.config.js",
  "stackprobe.config.mjs",
  "stackprobe.config.cjs",
  "stackprobe.config.json",
];

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

export interface ResolvedConfig
  extends Required<Omit<StackRadarConfig, "plugins">> {
  plugins: StackRadarPlugin[];
}

const importModule = async (file: string): Promise<unknown> => {
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  return jiti.import(pathToFileURL(file).href, { default: true });
};

export const loadConfig = async (root: string): Promise<ResolvedConfig> => {
  const configFile = (
    await Promise.all(
      configFiles.map(async (name) => {
        const file = resolve(root, name);
        return (await exists(file)) ? file : null;
      }),
    )
  ).find(Boolean);

  const loaded = configFile
    ? ((await importModule(configFile)) as StackRadarConfig)
    : {};
  const rawPlugins = loaded.plugins ?? defaultConfig.plugins;
  const plugins = await Promise.all(
    rawPlugins.map(async (plugin) => {
      if (typeof plugin !== "string") return plugin;
      const file = plugin.startsWith(".") ? resolve(root, plugin) : plugin;
      return (await importModule(file)) as StackRadarPlugin;
    }),
  );

  return {
    weights: { ...defaultWeights, ...loaded.weights },
    ignoreDependencies:
      loaded.ignoreDependencies ?? defaultConfig.ignoreDependencies,
    ignoreEnvVars: loaded.ignoreEnvVars ?? defaultConfig.ignoreEnvVars,
    ignoreFiles: loaded.ignoreFiles ?? defaultConfig.ignoreFiles,
    externalChecks: loaded.externalChecks ?? defaultConfig.externalChecks,
    staleBranchDays: loaded.staleBranchDays ?? defaultConfig.staleBranchDays,
    plugins,
  };
};
