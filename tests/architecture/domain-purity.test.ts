import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const collectTypeScriptFiles = (directory: string): string[] => {
  const entries = readdirSync(directory);
  return entries.flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory())
      return collectTypeScriptFiles(entryPath);
    return entryPath.endsWith(".ts") ? [entryPath] : [];
  });
};

const domainFiles = collectTypeScriptFiles(join(process.cwd(), "modules"))
  .filter((filePath) => filePath.includes(`${join("modules", "")}`))
  .filter((filePath) => filePath.includes(`${join("domain", "")}`));

describe("domain layer purity", () => {
  it.each(domainFiles)("does not import external modules in %s", (filePath) => {
    const source = readFileSync(filePath, "utf8");

    expect(source).not.toMatch(/^import .* from ["'](?!\.)([^"']+)["'];?/m);
  });
});
