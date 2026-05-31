import type { SourcePulseConfig } from "../../../src/types/index.js";

export default {
  externalChecks: false,
  ignoreDependencies: ["react", "vite", "vitest"],
  plugins: ["./plugin.ts"],
} satisfies SourcePulseConfig;
