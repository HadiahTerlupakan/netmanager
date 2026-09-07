import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Judul surat dan nama penanda tangan diisi admin lewat formulir, sedangkan
 * penerimanya pihak luar. Tanpa peng-escape-an, siapa pun yang menguasai akun
 * admin bisa menyisipkan markup ke dalam email orang lain — termasuk tautan
 * palsu yang menyaru sebagai bagian dari surat.
 */

import type { SignerLink } from "@/modules/endorsement";

const sendEmail = vi.hoisted(() => vi.fn());
const sendWhatsApp = vi.hoisted(() => vi.fn());

vi.mock("@/modules/notification", () => ({
  EmailService: class {
    sendEmail = sendEmail;
  },
  WhatsAppSenderService: class {
    send = sendWhatsApp;
  },
}));

vi.mock("@/lib/utils/portal-url", () => ({
  getPublicSiteUrl: () => "https://radpro.id",
}));

const { EndorsementNotificationService, buildSignerUrl } =
  await import("@/modules/endorsement/services/EndorsementNotificationService");

const link = (over: Partial<SignerLink> = {}): SignerLink => ({
  signerId: "signer-1",
  name: "Budi",
  email: "budi@contoh.id",
  phone: null,
  token: "a".repeat(43),
  ...over,
});

const sentHtml = () => sendEmail.mock.calls[0][0].html as string;

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue({ success: true });
  sendWhatsApp.mockResolvedValue({ success: true });
});

describe("buildSignerUrl", () => {
  it("menyusun tautan di bawah prefix /p", () => {
    expect(buildSignerUrl("token-abc")).toBe("https://radpro.id/p/token-abc");
  });
});

describe("email undangan", () => {
  it("meng-escape nama penanda tangan", async () => {
    await new EndorsementNotificationService().sendInvitations({
      endorsementTitle: "Berita Acara",
      tenantId: "tenant-1",
      links: [link({ name: '<script>alert("x")</script>' })],
    });

    expect(sentHtml()).not.toContain("<script>");
    expect(sentHtml()).toContain("&lt;script&gt;");
  });

  it("meng-escape judul surat", async () => {
    await new EndorsementNotificationService().sendInvitations({
      endorsementTitle: '<img src=x onerror="alert(1)">',
      tenantId: "tenant-1",
      links: [link()],
    });

    expect(sentHtml()).not.toContain("<img");
    expect(sentHtml()).toContain("&lt;img");
  });

  // Tanda kutip yang lolos bisa memutus atribut href dan menyisipkan atribut
  // lain pada tautan.
  it("meng-escape tanda kutip supaya atribut tautan tidak bisa diputus", async () => {
    await new EndorsementNotificationService().sendInvitations({
      endorsementTitle: 'Judul" onmouseover="alert(1)',
      tenantId: "tenant-1",
      links: [link()],
    });

    expect(sentHtml()).not.toContain('onmouseover="alert(1)"');
    expect(sentHtml()).toContain("&quot;");
  });

  it("tetap memuat tautan yang benar", async () => {
    await new EndorsementNotificationService().sendInvitations({
      endorsementTitle: "Berita Acara",
      tenantId: "tenant-1",
      links: [link({ token: "b".repeat(43) })],
    });

    expect(sentHtml()).toContain(`https://radpro.id/p/${"b".repeat(43)}`);
  });
});

describe("pemilihan kanal", () => {
  it("memakai WhatsApp bila ada nomor telepon", async () => {
    const [outcome] =
      await new EndorsementNotificationService().sendInvitations({
        endorsementTitle: "Berita Acara",
        tenantId: "tenant-1",
        links: [link({ phone: "08123", email: null })],
      });

    expect(outcome!.channel).toBe("whatsapp");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("melaporkan kegagalan tanpa menghentikan penerima lain", async () => {
    sendWhatsApp.mockResolvedValue({ success: false, error: "nomor salah" });

    const outcomes = await new EndorsementNotificationService().sendInvitations(
      {
        endorsementTitle: "Berita Acara",
        tenantId: "tenant-1",
        links: [
          link({ signerId: "s1", phone: "08123", email: null }),
          link({ signerId: "s2" }),
        ],
      },
    );

    expect(outcomes[0]).toMatchObject({
      delivered: false,
      error: "nomor salah",
    });
    expect(outcomes[1]).toMatchObject({ delivered: true, channel: "email" });
  });

  // Penanda tangan internal tanpa kontak tetap bisa membuka tautan dari halaman
  // detail surat; bukan kegagalan, hanya tidak ada kanal keluar.
  it("menandai tanpa kanal bila tidak ada kontak", async () => {
    const [outcome] =
      await new EndorsementNotificationService().sendInvitations({
        endorsementTitle: "Berita Acara",
        tenantId: "tenant-1",
        links: [link({ email: null, phone: null })],
      });

    expect(outcome!.channel).toBe("none");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });
});
