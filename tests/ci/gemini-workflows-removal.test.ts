import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function listGeminiWorkflowFiles(): string[] {
  const workflowsDir = resolve(process.cwd(), ".github", "workflows");

  if (!existsSync(workflowsDir)) {
    return [];
  }

  return readdirSync(workflowsDir)
    .filter((fileName) => /^gemini-.*\.ya?ml$/.test(fileName))
    .sort();
}

describe("Gemini CLI workflow removal", () => {
  it("does not keep any GitHub workflow files for Gemini CLI automation", () => {
    expect(listGeminiWorkflowFiles()).toEqual([]);
  });
});
