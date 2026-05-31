import type { FileAnalysis } from "../analysis.js";
import type { CircularResult } from "../types/index.js";

const canonicalCycle = (cycle: string[]): string => {
  const chain = cycle.slice(0, -1);
  const rotations = chain.map((_, index) => [
    ...chain.slice(index),
    ...chain.slice(0, index),
  ]);
  return rotations.map((rotation) => rotation.join(" -> ")).sort()[0];
};

export const scanCircular = async (
  analyses: FileAnalysis[],
): Promise<CircularResult> => {
  const byFile = new Map(analyses.map((analysis) => [analysis.file, analysis]));
  const cycles = new Map<string, string[]>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (file: string): void => {
    if (visiting.has(file)) {
      const start = stack.indexOf(file);
      const cycleFiles = [...stack.slice(start), file];
      const relativeCycle = cycleFiles.map(
        (entry) => byFile.get(entry)?.relativeFile ?? entry,
      );
      cycles.set(canonicalCycle(relativeCycle), relativeCycle);
      return;
    }
    if (visited.has(file)) return;

    visiting.add(file);
    stack.push(file);
    for (const dependency of byFile.get(file)?.imports ?? []) {
      if (dependency.resolvedFile) visit(dependency.resolvedFile);
    }
    stack.pop();
    visiting.delete(file);
    visited.add(file);
  };

  for (const file of byFile.keys()) visit(file);
  return {
    cycles: [...cycles.values()].sort((a, b) =>
      a.join().localeCompare(b.join()),
    ),
  };
};
