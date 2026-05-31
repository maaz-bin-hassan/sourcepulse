import type { SourcePulsePlugin } from "../../../src/types/index.js";

export default {
  name: "fixture-plugin",
  scan: () => [{ message: "Fixture plugin is active", penalty: 1 }],
} satisfies SourcePulsePlugin;
