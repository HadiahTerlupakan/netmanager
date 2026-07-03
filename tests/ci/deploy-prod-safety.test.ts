import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readDeployProdScript(): string {
  return readFileSync(resolve(process.cwd(), "deploy-prod.sh"), "utf8");
}

describe("deploy-prod.sh safety", () => {
  it("promotes origin/staging to main with a clean-worktree, fail-fast, fast-forward-only flow", () => {
    const deployProdScript = readDeployProdScript();

    expect(deployProdScript).toContain("set -euo pipefail");
    expect(deployProdScript).toContain('cd "$(git rev-parse --show-toplevel)"');
    expect(deployProdScript).toContain("git status --porcelain");
    expect(deployProdScript).toContain("git fetch origin");
    expect(deployProdScript).toContain("git pull --ff-only origin staging");
    expect(deployProdScript).toContain("git pull --ff-only origin main");
    expect(deployProdScript).toContain("git merge --no-ff origin/staging");
    expect(deployProdScript).not.toContain("git add .");
    expect(deployProdScript).not.toContain(
      'git commit -m "chore: Prepare for production deployment"',
    );
    expect(deployProdScript).not.toContain("git merge staging --no-edit");
  });
});
