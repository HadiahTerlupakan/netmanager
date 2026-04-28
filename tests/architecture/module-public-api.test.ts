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

  it("does not instantiate work-order repositories at sync service module load", () => {
    const source = readProjectFile(
      "modules/work-order/services/WorkOrderSyncService.ts",
    );

    expect(source).not.toMatch(
      /^const\s+\w+\s*=\s*new\s+(WorkOrderRepository|TicketRepository)\(/m,
    );
  });
});
