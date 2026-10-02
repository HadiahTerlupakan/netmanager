import { describe, expect, it } from "vitest";

import { formatDailyDocumentNumber } from "@/modules/pelanggan/utils/daily-document-number";

describe("formatDailyDocumentNumber", () => {
  it("memakai tanggal lokal zona waktu, bukan tanggal UTC", () => {
    // 01:30 WIB 3 Okt = 18:30 UTC 2 Okt: urutan sudah direset → tanggal harus 3 Okt.
    const nomor = formatDailyDocumentNumber({
      prefix: "TKT",
      date: new Date("2026-10-02T18:30:00.000Z"),
      count: 0,
      sequenceWidth: 5,
      timezone: "Asia/Jakarta",
    });

    expect(nomor).toBe("TKT-20261003-00001");
  });

  it("menambah satu pada jumlah dan mengisi nol di depan", () => {
    const nomor = formatDailyDocumentNumber({
      prefix: "TKT",
      date: new Date("2026-10-02T05:00:00.000Z"),
      count: 41,
      sequenceWidth: 5,
      timezone: "Asia/Jakarta",
    });

    expect(nomor).toBe("TKT-20261002-00042");
  });
});
