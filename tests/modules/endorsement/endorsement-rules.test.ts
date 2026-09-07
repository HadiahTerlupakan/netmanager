import { describe, expect, it } from "vitest";
import {
  canSign,
  countSigned,
  hasDecline,
  isExpired,
  isFullySigned,
  resolveEndorsementStatus,
} from "@/modules/endorsement/domain/endorsement-rules";
import type { EndorsementSignerEntity } from "@/modules/endorsement/domain/entities/Endorsement";

/**
 * Aturan "kapan surat sah" hanya boleh punya satu definisi. Kalau tersebar di
 * service dan UI, status surat bisa berbeda antara daftar admin dan halaman
 * penanda tangan.
 */

const signer = (
  over: Partial<EndorsementSignerEntity> = {},
): EndorsementSignerEntity => ({
  id: "signer-1",
  endorsementId: "end-1",
  name: "Budi",
  role: "Direktur",
  email: "budi@contoh.id",
  phone: null,
  userId: null,
  status: "PENDING",
  signatureKey: null,
  viewedAt: null,
  signedAt: null,
  declinedAt: null,
  declineReason: null,
  order: 0,
  ...over,
});

const NOW = new Date("2026-09-07T00:00:00.000Z");

describe("isFullySigned", () => {
  it("benar hanya bila semua sudah menandatangani", () => {
    expect(
      isFullySigned([
        signer({ status: "SIGNED" }),
        signer({ status: "SIGNED" }),
      ]),
    ).toBe(true);
  });

  it("salah bila masih ada yang menunggu", () => {
    expect(
      isFullySigned([
        signer({ status: "SIGNED" }),
        signer({ status: "VIEWED" }),
      ]),
    ).toBe(false);
  });

  // Surat tanpa penanda tangan tidak boleh dianggap sah dengan sendirinya.
  it("salah bila tidak ada penanda tangan sama sekali", () => {
    expect(isFullySigned([])).toBe(false);
  });
});

describe("hasDecline", () => {
  it("satu penolakan sudah cukup", () => {
    expect(
      hasDecline([
        signer({ status: "SIGNED" }),
        signer({ status: "DECLINED" }),
      ]),
    ).toBe(true);
  });
});

describe("isExpired", () => {
  it("surat tanpa masa berlaku tidak pernah kedaluwarsa", () => {
    expect(isExpired({ expiresAt: null }, NOW)).toBe(false);
  });

  it("kedaluwarsa bila tanggalnya sudah lewat", () => {
    expect(
      isExpired({ expiresAt: new Date("2026-09-06T23:59:59.000Z") }, NOW),
    ).toBe(true);
  });

  it("belum kedaluwarsa tepat sebelum batas", () => {
    expect(
      isExpired({ expiresAt: new Date("2026-09-07T00:00:01.000Z") }, NOW),
    ).toBe(false);
  });
});

describe("canSign", () => {
  const sent = { status: "SENT" as const, expiresAt: null as Date | null };

  it("boleh menandatangani saat surat terkirim dan belum ditandatangani", () => {
    expect(canSign(sent, signer(), NOW)).toBe(true);
    expect(canSign(sent, signer({ status: "VIEWED" }), NOW)).toBe(true);
  });

  it("tidak boleh menandatangani dua kali", () => {
    expect(canSign(sent, signer({ status: "SIGNED" }), NOW)).toBe(false);
  });

  it("tidak boleh setelah menolak", () => {
    expect(canSign(sent, signer({ status: "DECLINED" }), NOW)).toBe(false);
  });

  // Draft belum dikirim ke siapa pun; token seharusnya belum beredar, tapi
  // pemeriksaannya tetap ada supaya bukan tokennya satu-satunya penjaga.
  it.each(["DRAFT", "COMPLETED", "CANCELLED", "EXPIRED"] as const)(
    "tidak boleh menandatangani saat surat berstatus %s",
    (status) => {
      expect(canSign({ status, expiresAt: null }, signer(), NOW)).toBe(false);
    },
  );

  it("tidak boleh menandatangani setelah kedaluwarsa", () => {
    expect(
      canSign(
        { status: "SENT", expiresAt: new Date("2026-09-01T00:00:00.000Z") },
        signer(),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("resolveEndorsementStatus", () => {
  it("menjadi COMPLETED setelah semua menandatangani", () => {
    expect(
      resolveEndorsementStatus("SENT", [
        signer({ status: "SIGNED" }),
        signer({ status: "SIGNED" }),
      ]),
    ).toBe("COMPLETED");
  });

  // Satu penolakan menggugurkan surat: menandatangani sebagian tidak berarti.
  it("menjadi CANCELLED bila ada yang menolak", () => {
    expect(
      resolveEndorsementStatus("SENT", [
        signer({ status: "SIGNED" }),
        signer({ status: "DECLINED" }),
      ]),
    ).toBe("CANCELLED");
  });

  it("tetap SENT selama masih ada yang menunggu", () => {
    expect(
      resolveEndorsementStatus("SENT", [
        signer({ status: "SIGNED" }),
        signer({ status: "PENDING" }),
      ]),
    ).toBe("SENT");
  });

  it("tidak mengubah status surat yang sudah selesai atau dibatalkan", () => {
    expect(
      resolveEndorsementStatus("CANCELLED", [signer({ status: "SIGNED" })]),
    ).toBe("CANCELLED");
    expect(
      resolveEndorsementStatus("DRAFT", [signer({ status: "SIGNED" })]),
    ).toBe("DRAFT");
  });
});

describe("countSigned", () => {
  it("menghitung hanya yang sudah menandatangani", () => {
    expect(
      countSigned([
        signer({ status: "SIGNED" }),
        signer({ status: "DECLINED" }),
        signer({ status: "PENDING" }),
      ]),
    ).toBe(1);
  });
});
