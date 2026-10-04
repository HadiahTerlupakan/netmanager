import { describe, expect, it } from "vitest";
import {
  daysUntil,
  deriveStatus,
  isActionable,
  listDeadlines,
  nextObligationDate,
  overdueWeekKey,
  reminderThresholdFor,
  toWibDateKey,
  wibDayStart,
} from "@/modules/legal/domain/legal-rules";

/**
 * Aturan inti modul legal. Semua hari dihitung sebagai tanggal kalender WIB,
 * supaya "H-7" berarti tujuh hari kalender bagi admin di Indonesia.
 */

// 2026-10-04 10:00 WIB
const NOW = new Date("2026-10-04T03:00:00.000Z");
const wib = (date: string) => new Date(`${date}T00:00:00+07:00`);

const baseDocument = {
  terminatedAt: null as Date | null,
  renewedById: null as string | null,
  endDate: null as Date | null,
  noticePeriodDays: null as number | null,
  isAutoRenew: false,
  guaranteeEndDate: null as Date | null,
  obligations: [] as Array<{ id: string; description: string; dueDate: Date; recurrence: "NONE" | "MONTHLY" | "YEARLY" }>,
};

describe("tanggal kalender WIB", () => {
  it("menghitung selisih hari kalender, bukan 24 jam", () => {
    // 23:30 WIB tanggal 4 ke 00:30 WIB tanggal 5 = 1 hari kalender.
    const lateNight = new Date("2026-10-04T16:30:00.000Z");
    expect(daysUntil(wib("2026-10-05"), lateNight)).toBe(1);
  });

  it("kunci tanggal dan awal hari mengikuti WIB", () => {
    expect(toWibDateKey(new Date("2026-10-04T18:00:00.000Z"))).toBe("2026-10-05");
    expect(wibDayStart(NOW).toISOString()).toBe("2026-10-03T17:00:00.000Z");
  });
});

describe("deriveStatus", () => {
  it.each([
    [null, "AKTIF"],
    [wib("2027-06-01"), "AKTIF"],
    [wib("2026-12-01"), "SEGERA_BERAKHIR"],
    [wib("2026-10-04"), "SEGERA_BERAKHIR"],
    [wib("2026-10-03"), "KEDALUWARSA"],
  ])("tanggal berakhir %s → %s", (endDate, expected) => {
    expect(deriveStatus({ ...baseDocument, endDate }, NOW)).toBe(expected);
  });

  it("diakhiri dan diperpanjang mengalahkan tanggal", () => {
    const expired = { ...baseDocument, endDate: wib("2020-01-01") };
    expect(deriveStatus({ ...expired, terminatedAt: NOW }, NOW)).toBe("DIAKHIRI");
    expect(deriveStatus({ ...expired, renewedById: "baru" }, NOW)).toBe("DIPERPANJANG");
  });
});

describe("listDeadlines", () => {
  it("batas pemberitahuan = tanggal berakhir − masa pemberitahuan", () => {
    const deadlines = listDeadlines(
      { ...baseDocument, endDate: wib("2026-12-31"), noticePeriodDays: 60, isAutoRenew: true },
      NOW,
    );
    const notice = deadlines.find((deadline) => deadline.kind === "NOTICE")!;

    expect(toWibDateKey(notice.date)).toBe("2026-11-01");
    expect(notice.label).toMatch(/diperpanjang otomatis/);
    expect(notice.key).toBe("NOTICE:2026-11-01");
  });

  it("memuat jaminan dan kewajiban dengan kunci unik per kewajiban", () => {
    const deadlines = listDeadlines(
      {
        ...baseDocument,
        guaranteeEndDate: wib("2026-11-15"),
        obligations: [
          { id: "ob-1", description: "Bayar sewa", dueDate: wib("2026-10-20"), recurrence: "NONE" },
        ],
      },
      NOW,
    );

    expect(deadlines.map((deadline) => deadline.key)).toEqual([
      "GUARANTEE:2026-11-15",
      "OBLIGATION:ob-1:2026-10-20",
    ]);
  });

  it("dokumen diakhiri/diperpanjang tidak punya tenggat", () => {
    expect(
      listDeadlines({ ...baseDocument, endDate: wib("2026-11-01"), terminatedAt: NOW }, NOW),
    ).toEqual([]);
  });
});

describe("nextObligationDate", () => {
  it("kewajiban tahunan yang sudah lewat dimajukan ke tahun berikutnya", () => {
    const next = nextObligationDate(
      { dueDate: wib("2025-03-15"), recurrence: "YEARLY" },
      NOW,
    );
    expect(toWibDateKey(next)).toBe("2027-03-15");
  });

  it("kewajiban bulanan dimajukan ke bulan berjalan bila belum lewat", () => {
    const next = nextObligationDate(
      { dueDate: wib("2026-01-10"), recurrence: "MONTHLY" },
      NOW,
    );
    expect(toWibDateKey(next)).toBe("2026-10-10");
  });

  it("kewajiban sekali tidak dimajukan", () => {
    const due = wib("2026-01-10");
    expect(nextObligationDate({ dueDate: due, recurrence: "NONE" }, NOW)).toBe(due);
  });
});

describe("reminderThresholdFor", () => {
  it.each([
    [120, null],
    [90, "H90"],
    [45, "H90"],
    [30, "H30"],
    [20, "H30"],
    [7, "H7"],
    [3, "H7"],
    [0, "H0"],
    [-1, null],
  ])("sisa %s hari → %s", (daysLeft, expected) => {
    expect(reminderThresholdFor(daysLeft)).toBe(expected);
  });
});

describe("overdueWeekKey", () => {
  it("memakai minggu ISO kalender WIB", () => {
    expect(overdueWeekKey(NOW)).toBe("OVERDUE:2026-W40");
    // Senin 2026-10-05 WIB masuk minggu 41.
    expect(overdueWeekKey(new Date("2026-10-04T17:30:00.000Z"))).toBe("OVERDUE:2026-W41");
  });
});

describe("isActionable", () => {
  const deadline = (kind: "END" | "NOTICE", daysLeft: number) => ({
    kind,
    daysLeft,
    date: NOW,
    key: "",
    label: "",
  });

  it("dalam 90 hari perlu tindakan; lebih jauh belum", () => {
    expect(isActionable(deadline("NOTICE", 30))).toBe(true);
    expect(isActionable(deadline("NOTICE", 91))).toBe(false);
  });

  it("hanya masa berlaku yang lewat yang tetap ditampilkan", () => {
    expect(isActionable(deadline("END", -5))).toBe(true);
    expect(isActionable(deadline("NOTICE", -5))).toBe(false);
  });
});
