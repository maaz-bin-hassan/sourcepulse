import { readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import fg from "fast-glob";
import ts from "typescript";

const sourceExtensions = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
];
const sourceGlobs = sourceExtensions.map((extension) => `**/*${extension}`);
const defaultIgnores = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/fixtures/**",
  "**/.git/**",
  "**/*.d.ts",
];

export interface ImportReference {
  specifier: string;
  names: string[];
  resolvedFile: string | null;
}

export interface FileAnalysis {
  file: string;
  relativeFile: string;
  text: string;
  imports: ImportReference[];
  exports: string[];
  envRefs: string[];
}

const scriptKindFor = (file: string): ts.ScriptKind => {
  const extension = extname(file);
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
};

export const normalizePath = (path: string): string =>
  path.replaceAll("\\", "/");

export const discoverSourceFiles = async (
  root: string,
  ignoreFiles: string[] = [],
): Promise<string[]> => {
  const files = await fg(sourceGlobs, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore: [...defaultIgnores, ...ignoreFiles],
  });
  return files.sort();
};

const hasExtension = (specifier: string): boolean =>
  sourceExtensions.some((extension) => specifier.endsWith(extension));

export const resolveLocalImport = (
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>,
): string | null => {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  const extension = extname(specifier);
  const candidates = hasExtension(specifier)
    ? [
        base,
        ...(extension === ".js" || extension === ".jsx" || extension === ".mjs"
          ? [
              `${base.slice(0, -extension.length)}.ts`,
              `${base.slice(0, -extension.length)}.tsx`,
            ]
          : []),
      ]
    : [
        base,
        ...sourceExtensions.map((extension) => `${base}${extension}`),
        ...sourceExtensions.map((extension) =>
          resolve(base, `index${extension}`),
        ),
      ];
  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
};

const stringLiteralValue = (node: ts.Node | undefined): string | null => {
  if (
    node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  ) {
    return node.text;
  }
  return null;
};

const bindingNames = (name: ts.BindingName): string[] => {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  );
};

const exportedDeclarationNames = (node: ts.Node): string[] => {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name
  ) {
    return [node.name.text];
  }
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.flatMap((declaration) =>
      bindingNames(declaration.name),
    );
  }
  return [];
};

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts
    .getModifiers(node)
    ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
    false);

const isDefaultExport = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts
    .getModifiers(node)
    ?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ??
    false);

export const analyzeProject = async (
  root: string,
  ignoreFiles: string[] = [],
): Promise<FileAnalysis[]> => {
  const files = await discoverSourceFiles(root, ignoreFiles);
  const knownFiles = new Set(files);

  return Promise.all(
    files.map(async (file): Promise<FileAnalysis> => {
      const text = await readFile(file, "utf8");
      const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKindFor(file),
      );
      const imports: ImportReference[] = [];
      const exports = new Set<string>();
      const envRefs = new Set<string>();

      const addImport = (
        specifier: string | null,
        names: string[] = [],
      ): void => {
        if (!specifier) return;
        imports.push({
          specifier,
          names,
          resolvedFile: resolveLocalImport(file, specifier, knownFiles),
        });
      };

      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node)) {
          const names: string[] = [];
          const clause = node.importClause;
          if (clause?.name) names.push("default");
          if (
            clause?.namedBindings &&
            ts.isNamedImports(clause.namedBindings)
          ) {
            names.push(
              ...clause.namedBindings.elements.map(
                (element) => element.propertyName?.text ?? element.name.text,
              ),
            );
          }
          if (
            clause?.namedBindings &&
            ts.isNamespaceImport(clause.namedBindings)
          ) {
            names.push("*");
          }
          addImport(stringLiteralValue(node.moduleSpecifier), names);
        }

        if (ts.isExportDeclaration(node)) {
          const specifier = stringLiteralValue(node.moduleSpecifier);
          const names = node.exportClause
            ? ts.isNamedExports(node.exportClause)
              ? node.exportClause.elements.map(
                  (element) => element.propertyName?.text ?? element.name.text,
                )
              : ["*"]
            : ["*"];
          addImport(specifier, names);
          for (const name of names) exports.add(name);
        }

        if (ts.isExportAssignment(node)) exports.add("default");

        if (hasExportModifier(node)) {
          if (isDefaultExport(node)) exports.add("default");
          for (const name of exportedDeclarationNames(node)) exports.add(name);
        }

        if (ts.isCallExpression(node)) {
          const argument = stringLiteralValue(node.arguments[0]);
          if (
            (ts.isIdentifier(node.expression) &&
              node.expression.text === "require") ||
            node.expression.kind === ts.SyntaxKind.ImportKeyword
          ) {
            addImport(argument, ["*"]);
          }
        }

        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "process" &&
          node.expression.name.text === "env"
        ) {
          envRefs.add(node.name.text);
        }

        if (
          ts.isElementAccessExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "process" &&
          node.expression.name.text === "env"
        ) {
          const name = stringLiteralValue(node.argumentExpression);
          if (name) envRefs.add(name);
        }

        ts.forEachChild(node, visit);
      };

      visit(source);
      return {
        file,
        relativeFile: normalizePath(relative(root, file)),
        text,
        imports,
        exports: [...exports].sort(),
        envRefs: [...envRefs].sort(),
      };
    }),
  );
};

export const packageNameFromSpecifier = (specifier: string): string | null => {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("node:")
  ) {
    return null;
  }
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};
