#!/usr/bin/env tsx
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type Severity = "ok" | "warning" | "error";
export type ModuleStatus = "lama" | "baru";

export interface AuditIssue {
  severity: Severity;
  rule: string;
  message: string;
  filePath?: string;
  line?: number;
}

export interface ModuleReport {
  name: string;
  status: ModuleStatus;
  issues: AuditIssue[];
}

export interface AuditSummary {
  modules: number;
  compliant: number;
  warnings: number;
  errors: number;
}

export interface ProjectAuditReport {
  reports: ModuleReport[];
  summary: AuditSummary;
}

interface AuditOptions {
  rootDir?: string;
  changedFiles?: string[];
  includeAllFiles?: boolean;
}

const MAX_FILE_LINES_WARN = 300;
const MAX_FILE_LINES_ERROR = 350;
const MAX_FUNCTION_LINES_WARN = 20;
const MAX_FUNCTION_LINES_ERROR = 40;
const MAX_PARAMS = 3;

const REQUIRED_FOLDERS = [
  "domain/entities",
  "domain/ports",
  "dto",
  "repositories",
  "services",
  "mappers",
  "factories",
  "types",
  "utils",
  "validators",
];

const SKIPPED_MODULES = new Set(["database", "events"]);
const ALLOWED_PUBLIC_EXPORTS = new Set([
  "dto",
  "services",
  "client",
  "validation",
  "contracts",
]);
const INTERNAL_EXPORT_FOLDERS = [
  "repositories",
  "domain",
  "types",
  "mappers",
  "factories",
  "validators",
  "utils",
];

interface ExportStatement {
  folder: string;
  line: number;
}

function collectIndexExportStatements(indexPath: string): ExportStatement[] {
  const lines = readLines(indexPath);
  const exports: ExportStatement[] = [];
  let statementStart = 0;
  let statementBuffer = "";

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;

    if (!statementBuffer && !trimmed.startsWith("export")) {
      return;
    }

    if (!statementBuffer) {
      statementStart = lineNumber;
    }

    statementBuffer = statementBuffer ? `${statementBuffer}\n${line}` : line;
    if (!trimmed.endsWith(";")) {
      return;
    }

    const match = statementBuffer.match(/from\s+["']\.\/([^/"']+)/);
    if (match?.[1]) {
      exports.push({ folder: match[1], line: statementStart });
    }

    statementBuffer = "";
    statementStart = 0;
  });

  return exports;
}

function getInvalidPublicExport(folder: string): string | null {
  if (ALLOWED_PUBLIC_EXPORTS.has(folder)) return null;
  if (!INTERNAL_EXPORT_FOLDERS.includes(folder)) return null;
  return folder;
}

function buildPublicApiExportIssue(
  rootDir: string,
  indexPath: string,
  folder: string,
  line: number,
): AuditIssue {
  return createIssue({
    severity: "error",
    rule: "public-api-export",
    message: `index.ts hanya boleh export DTO + services atau shim root-level aman, ditemukan export ${folder}/`,
    filePath: toDisplayPath(rootDir, indexPath),
    line,
  });
}

function checkIndexPublicApiExports(
  rootDir: string,
  indexPath: string,
): AuditIssue[] {
  return collectIndexExportStatements(indexPath).flatMap(({ folder, line }) => {
    const invalidFolder = getInvalidPublicExport(folder);
    if (!invalidFolder) return [];

    return [buildPublicApiExportIssue(rootDir, indexPath, invalidFolder, line)];
  });
}

function checkRootShimCollisions(
  rootDir: string,
  moduleDir: string,
): AuditIssue[] {
  const collisions: AuditIssue[] = [];
  for (const folder of INTERNAL_EXPORT_FOLDERS) {
    const folderPath = path.join(moduleDir, folder);
    const shimPath = path.join(moduleDir, `${folder}.ts`);
    if (!fs.existsSync(folderPath) || !fs.existsSync(shimPath)) continue;

    collisions.push(
      createIssue({
        severity: "warning",
        rule: "shim-name-collision",
        message: `Shim root-level ${folder}.ts bentrok nama dengan folder internal ${folder}/`,
        filePath: toDisplayPath(rootDir, shimPath),
      }),
    );
  }

  return collisions;
}

function checkIndexTs(rootDir: string, moduleDir: string): AuditIssue[] {
  const indexPath = path.join(moduleDir, "index.ts");

  if (!fs.existsSync(indexPath)) {
    return [
      createIssue({
        severity: "error",
        rule: "missing-index",
        message: "index.ts tidak ditemukan",
        filePath: toDisplayPath(rootDir, indexPath),
      }),
    ];
  }

  return [
    ...checkIndexPublicApiExports(rootDir, indexPath),
    ...checkRootShimCollisions(rootDir, moduleDir),
  ];
}

function getExportedFolder(line: string): string | null {
  const match = line.match(/export\s+[^;]*from\s+["']\.\/?([^/"']+)/);
  return match?.[1] ?? null;
}

const IGNORED_MAGIC_NUMBERS = new Set([
  "0",
  "1",
  "2",
  "-1",
  "10",
  "11",
  "12",
  "15",
  "20",
  "22",
  "23",
  "24",
  "30",
  "31",
  "59",
  "60",
  "100",
  "127",
  "168",
  "172",
  "192",
  "999",
  "1000",
  "200",
  "201",
  "204",
  "400",
  "401",
  "403",
  "404",
  "409",
  "422",
  "429",
  "500",
  "503",
]);
const MAGIC_NUMBER_ALLOWLIST_PATTERNS = [
  /status\s*:\s*\d{3}/,
  /http\s+\d{3}/i,
  /\b(?:v|version)\d+\b/i,
  /\b\d{1,3}(?:\.\d{1,3}){1,3}\b/,
  /\d+\s*\*\s*\d+/,
  /new\s+Date\s*\(/,
  /set(?:Hours|Minutes|Seconds|Milliseconds)\s*\(/,
  /(?:hour|minute|second|millisecond|day|month|year|timeout|interval|delay|duration|tolerance|limit|offset|threshold|page|size|count|max|min)/i,
];

function collectTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) return collectTsFiles(fullPath);
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) return [fullPath];
    return [];
  });
}

function readLines(filePath: string): string[] {
  return fs.readFileSync(filePath, "utf-8").split("\n");
}

function toDisplayPath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath);
}

function createIssue(input: AuditIssue): AuditIssue {
  return input;
}

function isNewModule(moduleDir: string): boolean {
  return (
    fs.existsSync(path.join(moduleDir, "domain", "entities")) &&
    fs.existsSync(path.join(moduleDir, "domain", "ports"))
  );
}

function checkFolderStructure(moduleDir: string): AuditIssue[] {
  return REQUIRED_FOLDERS.flatMap((folder) => {
    if (fs.existsSync(path.join(moduleDir, folder))) return [];

    return [
      createIssue({
        severity: "error",
        rule: "required-folder",
        message: `Folder wajib tidak ada: ${folder}/`,
      }),
    ];
  });
}

function checkFileLength(rootDir: string, filePath: string): AuditIssue[] {
  const count = readLines(filePath).length;
  const displayPath = toDisplayPath(rootDir, filePath);

  if (count > MAX_FILE_LINES_ERROR) {
    return [
      createIssue({
        severity: "error",
        rule: "file-length",
        message: `${displayPath} — ${count} baris, wajib dipecah`,
        filePath: displayPath,
      }),
    ];
  }

  if (count > MAX_FILE_LINES_WARN) {
    return [
      createIssue({
        severity: "warning",
        rule: "file-length",
        message: `${displayPath} — ${count} baris, evaluasi pemecahan file`,
        filePath: displayPath,
      }),
    ];
  }

  return [];
}

function countBraceDelta(line: string): number {
  return (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
}

function getFunctionName(line: string): string {
  return (
    line.match(/(?:function\s+)?([A-Za-z_$][\w$]*)\s*\(/)?.[1] ?? "anonymous"
  );
}

function isFunctionStart(line: string): boolean {
  const trimmedLine = line.trim();
  if (!trimmedLine) return false;

  if (/^(if|for|while|switch|catch)\s*\(/.test(trimmedLine)) {
    return false;
  }

  return (
    /^\s*(export\s+)?(async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.test(line) ||
    /^\s*(?:export\s+)?(?:public|private|protected|static|async|get|set\s+)*[A-Za-z_$][\w$]*\s*\([^)]*\)\s*(?::\s*[^={]+)?\s*\{\s*$/.test(
      line,
    )
  );
}

function checkFunctionLength(rootDir: string, filePath: string): AuditIssue[] {
  const lines = readLines(filePath);
  const issues: AuditIssue[] = [];
  const displayPath = toDisplayPath(rootDir, filePath);
  let functionName = "";
  let startLine = 0;
  let braceDepth = 0;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (!startLine && isFunctionStart(line)) {
      functionName = getFunctionName(line);
      startLine = lineNumber;
      braceDepth = countBraceDelta(line);
      return;
    }

    if (!startLine) return;

    braceDepth += countBraceDelta(line);
    if (braceDepth > 0) return;

    const length = lineNumber - startLine + 1;
    const severity = length > MAX_FUNCTION_LINES_ERROR ? "error" : "warning";
    const limit =
      severity === "error" ? MAX_FUNCTION_LINES_ERROR : MAX_FUNCTION_LINES_WARN;

    if (length > MAX_FUNCTION_LINES_WARN) {
      issues.push(
        createIssue({
          severity,
          rule: "function-length",
          message: `${displayPath} — fungsi ${functionName} baris ${startLine}: ${length} baris (limit ${limit})`,
          filePath: displayPath,
          line: startLine,
        }),
      );
    }

    functionName = "";
    startLine = 0;
    braceDepth = 0;
  });

  return issues;
}

function splitParams(params: string): string[] {
  return params
    .split(",")
    .map((param) => param.trim())
    .filter((param) => param && !param.startsWith("//"));
}

function checkFunctionParams(rootDir: string, filePath: string): AuditIssue[] {
  const displayPath = toDisplayPath(rootDir, filePath);

  return readLines(filePath).flatMap((line, index) => {
    const match = line.match(
      /(?:function\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\()\s*([^)]*)\)/,
    );
    if (!match) return [];

    const params = splitParams(match[3] ?? "");
    if (params.length <= MAX_PARAMS) return [];

    return [
      createIssue({
        severity: "error",
        rule: "function-params",
        message: `${displayPath} baris ${index + 1}: fungsi ${match[1] ?? match[2] ?? "anonymous"} punya ${params.length} parameter`,
        filePath: displayPath,
        line: index + 1,
      }),
    ];
  });
}

function checkConsoleLogs(rootDir: string, filePath: string): AuditIssue[] {
  const displayPath = toDisplayPath(rootDir, filePath);

  return readLines(filePath).flatMap((line, index) => {
    if (line.trim().startsWith("//") || !/console\.log\s*\(/.test(line))
      return [];

    return [
      createIssue({
        severity: "warning",
        rule: "console-log",
        message: `${displayPath} baris ${index + 1}: console.log ditemukan`,
        filePath: displayPath,
        line: index + 1,
      }),
    ];
  });
}

function isConstantLine(line: string): boolean {
  return /^\s*const\s+[A-Z][A-Z0-9_]*\s*=/.test(line);
}

function removeQuotedText(line: string): string {
  return line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "");
}

function isAllowedMagicNumberContext(line: string): boolean {
  return MAGIC_NUMBER_ALLOWLIST_PATTERNS.some((pattern) => pattern.test(line));
}

function getSuspiciousNumbers(line: string): string[] {
  if (isAllowedMagicNumberContext(line)) return [];

  const searchableLine = removeQuotedText(line);
  const matches = searchableLine.match(/(?<![.\w])-?\b\d{2,}\b/g) ?? [];
  return matches.filter((number) => !IGNORED_MAGIC_NUMBERS.has(number));
}

function checkMagicNumbers(rootDir: string, filePath: string): AuditIssue[] {
  const displayPath = toDisplayPath(rootDir, filePath);

  return readLines(filePath).flatMap((line, index) => {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      isConstantLine(line)
    )
      return [];

    const suspicious = getSuspiciousNumbers(line);
    if (!suspicious.length) return [];

    return [
      createIssue({
        severity: "warning",
        rule: "magic-number",
        message: `${displayPath} baris ${index + 1}: kemungkinan magic number [${suspicious.join(", ")}]`,
        filePath: displayPath,
        line: index + 1,
      }),
    ];
  });
}

function normalizeChangedFiles(
  options: AuditOptions,
  rootDir: string,
): Set<string> | null {
  if (options.includeAllFiles) return null;

  return new Set(
    (options.changedFiles ?? []).map((filePath) =>
      path.resolve(rootDir, filePath),
    ),
  );
}

function isAuditableChangedFile(
  filePath: string,
  changedFileSet: Set<string> | null,
): boolean {
  if (!changedFileSet) return true;
  return changedFileSet.has(path.resolve(filePath));
}

function auditTsFile(rootDir: string, filePath: string): AuditIssue[] {
  return [
    ...checkFileLength(rootDir, filePath),
    ...checkFunctionLength(rootDir, filePath),
    ...checkFunctionParams(rootDir, filePath),
    ...checkConsoleLogs(rootDir, filePath),
  ];
}

function auditModule(
  rootDir: string,
  moduleDir: string,
  changedFileSet: Set<string> | null,
): ModuleReport {
  const name = path.basename(moduleDir);
  const tsIssues = collectTsFiles(moduleDir)
    .filter((filePath) => isAuditableChangedFile(filePath, changedFileSet))
    .flatMap((filePath) => auditTsFile(rootDir, filePath));
  const structureIssues = changedFileSet
    ? []
    : [...checkFolderStructure(moduleDir), ...checkIndexTs(rootDir, moduleDir)];
  const issues = [...structureIssues, ...tsIssues];

  return { name, status: isNewModule(moduleDir) ? "baru" : "lama", issues };
}

function getModuleDirs(rootDir: string): string[] {
  const modulesDir = path.join(rootDir, "modules");
  if (!fs.existsSync(modulesDir)) return [];

  return fs
    .readdirSync(modulesDir)
    .filter((name) => !SKIPPED_MODULES.has(name))
    .map((name) => path.join(modulesDir, name))
    .filter((moduleDir) => fs.statSync(moduleDir).isDirectory());
}

function summarize(reports: ModuleReport[]): AuditSummary {
  const warnings = reports.reduce(
    (total, report) =>
      total +
      report.issues.filter((issue) => issue.severity === "warning").length,
    0,
  );
  const errors = reports.reduce(
    (total, report) =>
      total +
      report.issues.filter((issue) => issue.severity === "error").length,
    0,
  );

  return {
    modules: reports.length,
    compliant: reports.filter((report) => report.issues.length === 0).length,
    warnings,
    errors,
  };
}

export function auditProject(options: AuditOptions = {}): ProjectAuditReport {
  const rootDir = options.rootDir ?? process.cwd();
  const changedFileSet = normalizeChangedFiles(options, rootDir);
  const reports = getModuleDirs(rootDir).map((moduleDir) =>
    auditModule(rootDir, moduleDir, changedFileSet),
  );

  return { reports, summary: summarize(reports) };
}

function iconForSeverity(severity: Severity): string {
  if (severity === "error") return "❌";
  if (severity === "warning") return "⚠️ ";
  return "✅";
}

function printReport(report: ProjectAuditReport): void {
  console.log("🔍 Menjalankan audit structural compliance...\n");

  for (const moduleReport of report.reports) {
    const hasErrors = moduleReport.issues.some(
      (issue) => issue.severity === "error",
    );
    const hasWarnings = moduleReport.issues.some(
      (issue) => issue.severity === "warning",
    );
    const icon = hasErrors ? "❌" : hasWarnings ? "⚠️ " : "✅";

    console.log(
      `${icon} modules/${moduleReport.name} (${moduleReport.status})`,
    );
    if (!moduleReport.issues.length) {
      console.log("   ✅ Semua checks passed");
      continue;
    }

    for (const issue of moduleReport.issues) {
      const location = issue.filePath
        ? ` ${issue.filePath}${issue.line ? `:${issue.line}` : ""}`
        : "";
      console.log(
        `   ${iconForSeverity(issue.severity)} [${issue.rule}]${location} — ${issue.message}`,
      );
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log("📊 RINGKASAN AUDIT");
  console.log(`   Module diperiksa : ${report.summary.modules}`);
  console.log(`   ✅ Compliant      : ${report.summary.compliant}`);
  console.log(`   ⚠️  Warnings       : ${report.summary.warnings}`);
  console.log(`   ❌ Errors         : ${report.summary.errors}`);
  console.log("─".repeat(60));
}

function isCliEntryPoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

function getChangedTsFiles(rootDir: string): string[] {
  const output = execFileSync(
    "git",
    [
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMR",
      "--",
      "modules",
      "app",
      "lib",
      "scripts",
    ],
    { cwd: rootDir, encoding: "utf-8" },
  );

  return output
    .split("\n")
    .map((filePath) => filePath.trim())
    .filter(
      (filePath) => filePath.endsWith(".ts") && !filePath.endsWith(".d.ts"),
    );
}

if (isCliEntryPoint()) {
  const rootDir = process.cwd();
  const changedFiles = getChangedTsFiles(rootDir);
  const report = auditProject({
    rootDir,
    ...(changedFiles.length > 0 ? { changedFiles } : { includeAllFiles: true }),
  });
  printReport(report);
  process.exit(report.summary.errors > 0 ? 1 : 0);
}
