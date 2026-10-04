import { describe, expect, it, vi } from "vitest";

/**
 * Penerbitan tautan: token hanya ada di memori saat dibuat, jadi pengiriman
 * dan penandaan "terkirim" harus terjadi dalam alur yang sama.
 */

vi.mock("@/lib/utils/portal-url", () => ({
  getPublicSiteUrl: () => "https://radpro.id",
}));

import type { SignerLink } from "@/modules/endorsement";

const { EndorsementIssueService } =
  await import("@/modules/endorsement/services/EndorsementIssueService");

const signerLink: SignerLink = {
  signerId: "signer-1",
  name: "Budi",
  email: "budi@contoh.id",
  phone: null,
  token: "t".repeat(43),
};

const buildDeps = () => {
  const endorsements = {
    create: vi.fn().mockResolvedValue({
      endorsement: { id: "end-1", title: "Berita Acara", tenantId: "tenant-1" },
      links: [signerLink],
    }),
    markSent: vi.fn(),
    getById: vi
      .fn()
      .mockResolvedValue({ id: "end-1", title: "Berita Acara", tenantId: "tenant-1" }),
    reissueSignerLink: vi.fn().mockResolvedValue(signerLink),
  };
  const notifications = {
    sendInvitations: vi
      .fn()
      .mockResolvedValue([{ signerId: "signer-1", channel: "email", delivered: true }]),
  };
  const service = new EndorsementIssueService(
    endorsements as never,
    notifications as never,
  );

  return { endorsements, notifications, service };
};

describe("issue", () => {
  it("membuat, mengirim, lalu menandai terkirim — berurutan", async () => {
    const { endorsements, notifications, service } = buildDeps();

    const result = await service.issue({} as never, "user-1");

    expect(
      notifications.sendInvitations.mock.invocationCallOrder[0]!,
    ).toBeLessThan(endorsements.markSent.mock.invocationCallOrder[0]!);
    expect(endorsements.markSent).toHaveBeenCalledWith("end-1");
    expect(result.links).toEqual([
      { signerId: "signer-1", name: "Budi", url: `https://radpro.id/p/${"t".repeat(43)}` },
    ]);
  });

  it("tidak mengembalikan token mentah", async () => {
    const { service } = buildDeps();

    const result = await service.issue({} as never, "user-1");

    expect(result.links[0]).not.toHaveProperty("token");
  });
});

describe("reissue", () => {
  it("mengirim tautan baru dan mengembalikan URL-nya", async () => {
    const { notifications, service } = buildDeps();

    const result = await service.reissue("end-1", "signer-1");

    expect(notifications.sendInvitations).toHaveBeenCalledWith(
      expect.objectContaining({ links: [signerLink] }),
    );
    expect(result.delivery.delivered).toBe(true);
    expect(result.link.url).toContain("/p/");
  });
});
