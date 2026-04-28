import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const modulesDirectory = join(process.cwd(), "modules");

const modulesWithRestrictedPublicApi = readdirSync(modulesDirectory)
  .map((moduleName) => join("modules", moduleName, "index.ts"))
  .filter((indexPath) => statSync(join(process.cwd(), indexPath)).isFile());

const readProjectFile = (filePath: string) =>
  readFileSync(join(process.cwd(), filePath), "utf8");

describe("module public api boundaries", () => {
  it.each(modulesWithRestrictedPublicApi)(
    "does not export repository implementations from %s",
    (indexPath) => {
      const source = readProjectFile(indexPath);

      expect(source).not.toMatch(/^export .*\.\/repositories\//m);
    },
  );

  it("does not instantiate work-order repositories while loading public API services", () => {
    const publicApiSource = readProjectFile("modules/work-order/index.ts");
    const exportedServicePaths = [
      ...publicApiSource.matchAll(/export \* from "(\.\/services\/[^\"]+)";/g),
    ]
      .map((match) => `modules/work-order/${match[1].slice(2)}.ts`)
      .filter((filePath) => statSync(join(process.cwd(), filePath)).isFile());

    for (const servicePath of exportedServicePaths) {
      const source = readProjectFile(servicePath);

      expect(source, servicePath).not.toMatch(
        /(constructor\([^)]*=\s*new\s+|private\s+(?:readonly\s+)?\w+\s*=\s*new\s+|^export\s+const\s+\w+\s*=\s*new\s+|^const\s+\w+\s*=\s*new\s+)(WorkOrderRepository|TicketRepository)\(/m,
      );
    }
  });
});
