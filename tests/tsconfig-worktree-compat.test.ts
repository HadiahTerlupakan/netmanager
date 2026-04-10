import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("worktree tsconfig compatibility", () => {
  it("pins ignoreDeprecations for legacy baseUrl worktrees", () => {
    const tsconfigPath = join(
      process.cwd(),
      ".claude",
      "worktrees",
      "agent-a893cc08",
      "tsconfig.json",
    );

    const parsed = JSON.parse(readFileSync(tsconfigPath, "utf8")) as {
      compilerOptions?: { ignoreDeprecations?: string };
    };

    expect(parsed.compilerOptions?.ignoreDeprecations).toBe("6.0");
  });
});
