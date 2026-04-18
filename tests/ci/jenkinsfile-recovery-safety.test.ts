import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readJenkinsfile(): string {
  return readFileSync(resolve(process.cwd(), "Jenkinsfile"), "utf8");
}

describe("Jenkinsfile recovery safety", () => {
  it("supports an explicit recovery mode with registry-validated image overrides", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("parameters {");
    expect(jenkinsfile).toContain(
      "choice(name: 'DEPLOY_MODE', choices: ['normal', 'recovery']",
    );
    expect(jenkinsfile).toContain("string(name: 'RECOVERY_APP_IMAGE'");
    expect(jenkinsfile).toContain("string(name: 'RECOVERY_CRON_IMAGE'");
    expect(jenkinsfile).toContain("string(name: 'RECOVERY_RADIUS_IMAGE'");
    expect(jenkinsfile).toContain(
      "env.DEPLOY_MODE = \"${params.DEPLOY_MODE ?: 'normal'}\"",
    );
    expect(jenkinsfile).toContain(
      "resolveDeployImageRef('netmanager-app', env.APP_IMAGE_REF, params.RECOVERY_APP_IMAGE)",
    );
    expect(jenkinsfile).toContain(
      "resolveDeployImageRef('netmanager-cron', env.CRON_IMAGE_REF, params.RECOVERY_CRON_IMAGE)",
    );
    expect(jenkinsfile).toContain(
      "resolveDeployImageRef('netmanager-radius', env.RADIUS_IMAGE_REF, params.RECOVERY_RADIUS_IMAGE)",
    );
    expect(jenkinsfile).toContain(
      "if (env.DEPLOY_MODE == 'recovery' && env.BRANCH_NAME != 'main') {",
    );
    expect(jenkinsfile).toContain(
      "error('Recovery mode hanya boleh dijalankan untuk branch main.')",
    );
  });
});
