import { execFile } from "node:child_process";
import { relative } from "node:path";
import { promisify } from "node:util";
import fg from "fast-glob";
import { type FileAnalysis, normalizePath } from "../analysis.js";
import type { SecretFinding, SecurityResult } from "../types/index.js";

const execFileAsync = promisify(execFile);
const assignmentSecret =
  /\b(api[_-]?key|secret|token|password|passwd|private[_-]?key)\b\s*[:=]\s*["'`]([^"'`]{8,})["'`]/i;
const recognizableSecrets = [
  { kind: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  {
    kind: "private key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

const committedEnvFiles = async (root: string): Promise<string[]> => {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files"], {
      cwd: root,
      timeout: 3_000,
    });
    return stdout
      .split("\n")
      .filter(
        (file) =>
          /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".example"),
      )
      .sort();
  } catch {
    return [];
  }
};

const scanLine = (line: string): string | null => {
  if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*"))
    return null;
  if (assignmentSecret.test(line)) return "hardcoded credential";
  return (
    recognizableSecrets.find(({ regex }) => regex.test(line))?.kind ?? null
  );
};

export const scanSecurity = async (
  root: string,
  analyses: FileAnalysis[],
): Promise<SecurityResult> => {
  const extraFiles = await fg(["**/*.json", "**/*.yaml", "**/*.yml"], {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/package-lock.json",
      "**/fixtures/**",
    ],
  });
  const files = [
    ...analyses.map(({ file, text }) => ({ file, text })),
    ...(await Promise.all(
      extraFiles.map(async (file) => ({
        file,
        text: await import("node:fs/promises").then(({ readFile }) =>
          readFile(file, "utf8"),
        ),
      })),
    )),
  ];

  const hardcodedSecrets: SecretFinding[] = files.flatMap(({ file, text }) =>
    text.split("\n").flatMap((line, index) => {
      const kind = scanLine(line);
      return kind
        ? [{ file: normalizePath(relative(root, file)), line: index + 1, kind }]
        : [];
    }),
  );
  const envFiles = await committedEnvFiles(root);
  return {
    hardcodedSecrets,
    envCommitted: envFiles.length > 0,
    committedEnvFiles: envFiles,
  };
};
