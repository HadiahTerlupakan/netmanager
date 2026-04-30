import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { auditProject } from "../../scripts/audit-claude-compliance";

let projectDir: string | null = null;

function createProject() {
  projectDir = mkdtempSync(path.join(tmpdir(), "claude-audit-"));
  mkdirSync(path.join(projectDir, "modules", "sample"), { recursive: true });
  return projectDir;
}

function writeModuleFile(relativePath: string, content: string) {
  if (!projectDir) throw new Error("Project fixture belum dibuat");
  const fullPath = path.join(projectDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

afterEach(() => {
  if (projectDir) {
    rmSync(projectDir, { recursive: true, force: true });
    projectDir = null;
  }
});

describe("auditProject", () => {
  it("melaporkan module lama yang kehilangan folder wajib", () => {
    const rootDir = createProject();
    writeModuleFile(
      "modules/sample/index.ts",
      "export * from './services/SampleService';\n",
    );

    const report = auditProject({ rootDir, includeAllFiles: true });

    expect(report.reports[0].status).toBe("lama");
    expect(report.summary.errors).toBeGreaterThan(0);
    expect(report.reports[0].issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        rule: "required-folder",
        message: expect.stringContaining("domain/entities"),
      }),
    );
  });

  it("mendeteksi index export non DTO/services", () => {
    const rootDir = createProject();
    for (const folder of [
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
    ]) {
      mkdirSync(path.join(rootDir, "modules", "sample", folder), {
        recursive: true,
      });
    }
    writeModuleFile(
      "modules/sample/index.ts",
      "export * from './dto/SampleDTO';\nexport * from './utils/sample-helper';\n",
    );

    const report = auditProject({ rootDir, includeAllFiles: true });

    expect(report.reports[0].status).toBe("baru");
    expect(report.reports[0].issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        rule: "public-api-export",
        message: expect.stringContaining("utils"),
      }),
    );
  });

  it("mendeteksi file/function/params/console tanpa magic number", () => {
    const rootDir = createProject();
    for (const folder of [
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
    ]) {
      mkdirSync(path.join(rootDir, "modules", "sample", folder), {
        recursive: true,
      });
    }
    writeModuleFile(
      "modules/sample/index.ts",
      "export * from './services/SampleService';\n",
    );
    writeModuleFile(
      "modules/sample/services/SampleService.ts",
      [
        "export function tooManyParams(a: string, b: string, c: string, d: string) {",
        "  console.log(a);",
        "  return 42;",
        "}",
        "export function longFunction() {",
        ...Array.from(
          { length: 41 },
          (_, index) => `  const value${index} = ${index + 10};`,
        ),
        "}",
      ].join("\n"),
    );

    const report = auditProject({ rootDir, includeAllFiles: true });
    const rules = report.reports[0].issues.map((issue) => issue.rule);

    expect(rules).toContain("function-params");
    expect(rules).toContain("console-log");
    expect(rules).toContain("function-length");
    expect(rules).not.toContain("magic-number");
  });

  it("membatasi audit ke file module yang berubah", () => {
    const rootDir = createProject();
    for (const folder of [
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
    ]) {
      mkdirSync(path.join(rootDir, "modules", "sample", folder), {
        recursive: true,
      });
    }
    writeModuleFile(
      "modules/sample/index.ts",
      "export * from './services/SampleService';\n",
    );
    writeModuleFile(
      "modules/sample/services/ChangedService.ts",
      [
        "export function longChangedFunction() {",
        ...Array.from(
          { length: 41 },
          (_, index) => `  const value${index} = ${index};`,
        ),
        "}",
      ].join("\n"),
    );
    writeModuleFile(
      "modules/sample/services/BacklogService.ts",
      [
        "export function longBacklogFunction() {",
        ...Array.from(
          { length: 41 },
          (_, index) => `  const value${index} = ${index};`,
        ),
        "}",
      ].join("\n"),
    );

    const report = auditProject({
      rootDir,
      changedFiles: ["modules/sample/services/ChangedService.ts"],
    });

    expect(report.reports[0].issues).toContainEqual(
      expect.objectContaining({
        filePath: "modules/sample/services/ChangedService.ts",
        rule: "function-length",
      }),
    );
    expect(report.reports[0].issues).not.toContainEqual(
      expect.objectContaining({
        filePath: "modules/sample/services/BacklogService.ts",
      }),
    );
  });

  it("mengabaikan angka boundary yang bukan magic number", () => {
    const rootDir = createProject();
    for (const folder of [
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
    ]) {
      mkdirSync(path.join(rootDir, "modules", "sample", folder), {
        recursive: true,
      });
    }
    writeModuleFile(
      "modules/sample/index.ts",
      "export * from './services/SampleService';\n",
    );
    writeModuleFile(
      "modules/sample/services/BoundaryService.ts",
      [
        "const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;",
        "export function buildResponse() {",
        "  return NextResponse.json({ message: 'HTTP 400 and /v1/users are text only' }, { status: 400 });",
        "}",
        "export function parsePrivateAddress(ip: string) {",
        "  return ip.startsWith('192.168.') || ip.startsWith('172.16.');",
        "}",
      ].join("\n"),
    );

    const report = auditProject({ rootDir, includeAllFiles: true });
    const magicIssues = report.reports[0].issues.filter(
      (issue) => issue.rule === "magic-number",
    );

    expect(magicIssues).toEqual([]);
  });
});
