import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readDeployProdScript(): string {
  return readFileSync(resolve(process.cwd(), "deploy-prod.sh"), "utf8");
}

describe("deploy-prod.sh safety", () => {
  it("treats the script as promotion-only and prints the promoted staging SHA", () => {
    const script = readDeployProdScript();

    expect(script).toContain('PROMOTION_SHA="$(git rev-parse origin/staging)"');
    expect(script).toContain(
      'echo "Promoting commit ${PROMOTION_SHA} from origin/staging to main..."',
    );
    expect(script).toContain('echo -e "${GREEN}Git promotion selesai.${NC}"');
    expect(script).toContain(
      'echo -e "${YELLOW}Deploy production resmi berjalan di Jenkins job branch main.${NC}"',
    );
    expect(script).toContain(
      'echo -e "${YELLOW}Pantau hasil akhir deploy di Jenkins production sebelum menganggap production sehat.${NC}"',
    );
    expect(script).not.toContain("Production deployment successful");
  });
});
