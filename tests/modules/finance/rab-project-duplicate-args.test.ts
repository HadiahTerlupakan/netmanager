import { describe, expect, it } from "vitest";
import { buildDuplicateProjectCreateArgs } from "@/modules/finance/repositories/rabProject.repository-mutations";

type DuplicateSource = Parameters<typeof buildDuplicateProjectCreateArgs>[0];

function buildSourceProject(siteId: string | null): DuplicateSource {
  return {
    name: "Proyek Cimenyan",
    description: null,
    siteId,
    items: [],
  } as unknown as DuplicateSource;
}

describe("buildDuplicateProjectCreateArgs", () => {
  it("menautkan site bila RAB sumber punya site", () => {
    const args = buildDuplicateProjectCreateArgs(
      buildSourceProject("site-1"),
      "user-1",
    );

    expect(args.data.site).toEqual({ connect: { id: "site-1" } });
  });

  // RAB tanpa site sah (site bersifat opsional). Menautkan id null membuat
  // Prisma menolak seluruh proses salin.
  it("tidak menautkan site bila RAB sumber tanpa site", () => {
    const args = buildDuplicateProjectCreateArgs(
      buildSourceProject(null),
      "user-1",
    );

    expect(args.data).not.toHaveProperty("site");
  });
});
