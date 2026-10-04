import { beforeEach, describe, expect, it, vi } from "vitest";

const applySignedVersion = vi.hoisted(() => vi.fn());
vi.mock("@/modules/legal/services/LegalSigningService", () => ({
  LegalSigningService: class {
    applySignedVersion = applySignedVersion;
  },
}));

import { handleEndorsementCompletedLegal } from "@/modules/legal/services/event-handlers/endorsement-completed-legal.handler";

const job = (payload: Record<string, unknown>) => ({ data: { payload } }) as never;

beforeEach(() => vi.clearAllMocks());

describe("handleEndorsementCompletedLegal", () => {
  it("menerapkan versi sah untuk surat dari dokumen legal", async () => {
    await handleEndorsementCompletedLegal(
      job({ endorsementId: "end-1", sourceType: "LEGAL_DOCUMENT", tenantId: "tenant-1" }),
    );

    expect(applySignedVersion).toHaveBeenCalledWith("end-1");
  });

  it("mengabaikan surat dari sumber lain", async () => {
    await handleEndorsementCompletedLegal(
      job({ endorsementId: "end-1", sourceType: "UPLOAD", tenantId: "tenant-1" }),
    );

    expect(applySignedVersion).not.toHaveBeenCalled();
  });

  // Tanpa tenantId worker berjalan dalam konteks sistem tanpa saringan tenant.
  it("melewati event tanpa tenantId tanpa melempar (tidak di-retry)", async () => {
    await expect(
      handleEndorsementCompletedLegal(job({ endorsementId: "end-1", sourceType: "LEGAL_DOCUMENT" })),
    ).resolves.toBeUndefined();
    expect(applySignedVersion).not.toHaveBeenCalled();
  });
});
