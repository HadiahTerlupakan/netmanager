import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";

const migratedModules = [
  "attendance",
  "coupons",
  "finance",
  "inventory",
  "marketing",
  "overtime",
  "users",
];

const collectTypeScriptFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory())
      return collectTypeScriptFiles(entryPath);
    return entryPath.endsWith(".ts") ? [entryPath] : [];
  });
};

const filesFor = (moduleName: string, folderName: string) =>
  collectTypeScriptFiles(
    join(process.cwd(), "modules", moduleName, folderName),
  );

const relativePath = (filePath: string) => relative(process.cwd(), filePath);

describe("migrated module boundaries", () => {
  it.each(migratedModules)(
    "keeps repository ports only in domain/ports for %s",
    (moduleName) => {
      const repositoryFiles = filesFor(moduleName, "repositories");
      const legacyPorts = repositoryFiles
        .filter((filePath) =>
          /^I[A-Z].*Repository\.ts$/.test(filePath.split("/").pop() ?? ""),
        )
        .map(relativePath);

      expect(legacyPorts).toEqual([]);
    },
  );

  it.each(migratedModules)(
    "keeps service layer independent from legacy repository ports for %s",
    (moduleName) => {
      const serviceFiles = filesFor(moduleName, "services");
      const legacyPortImports = serviceFiles
        .filter((filePath) =>
          /\.\.\/repositories\/I[A-Z].*Repository/.test(
            readFileSync(filePath, "utf8"),
          ),
        )
        .map(relativePath);

      expect(legacyPortImports).toEqual([]);
    },
  );

  it.each(migratedModules)(
    "keeps Prisma imports out of service, type, and validator layers for %s",
    (moduleName) => {
      const checkedFiles = ["services", "types", "validators"].flatMap(
        (folderName) => filesFor(moduleName, folderName),
      );
      const prismaImports = checkedFiles
        .filter((filePath) =>
          /from ["']@prisma\//.test(readFileSync(filePath, "utf8")),
        )
        .map(relativePath);

      expect(prismaImports).toEqual([]);
    },
  );
});
