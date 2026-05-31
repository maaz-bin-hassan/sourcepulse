import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FreshnessResult } from "../types/index.js";

const execFileAsync = promisify(execFile);

const git = async (root: string, args: string[]): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: root,
      timeout: 3_000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return null;
  }
};

const daysAgo = (unixSeconds: string | null): number | null => {
  if (!unixSeconds) return null;
  const date = Number(unixSeconds);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, Math.floor((Date.now() - date * 1_000) / 86_400_000));
};

export const scanFreshness = async (
  root: string,
  staleBranchDays: number,
): Promise<FreshnessResult> => {
  const [lastCommit, latestTagRaw, branchRows] = await Promise.all([
    git(root, ["log", "-1", "--format=%ct"]),
    git(root, ["tag", "--sort=-creatordate", "--format=%(creatordate:unix)"]),
    git(root, [
      "for-each-ref",
      "--format=%(refname:short)|%(committerdate:unix)",
      "refs/heads",
    ]),
  ]);
  const latestTag = latestTagRaw?.split("\n")[0] ?? null;

  const staleBranches = (branchRows ?? "")
    .split("\n")
    .filter(Boolean)
    .flatMap((row) => {
      const [branch, timestamp] = row.split("|");
      const age = daysAgo(timestamp);
      return age !== null && age > staleBranchDays ? [branch] : [];
    })
    .sort();

  return {
    daysSinceCommit: daysAgo(lastCommit),
    daysSinceRelease: daysAgo(latestTag),
    staleBranches,
  };
};
