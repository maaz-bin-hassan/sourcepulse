import type { StackRadarConfig } from "../../../src/types/index.js";

export default {
  externalChecks: false,
  ignoreDependencies: ["react", "vite", "vitest"],
  plugins: ["./plugin.ts"],
} satisfies StackRadarConfig;
