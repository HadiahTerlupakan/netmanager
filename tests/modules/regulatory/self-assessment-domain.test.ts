import { describe, expect, it } from "vitest";
import {
  aggregateByMonth,
  aggregateByQuarter,
  combinePeriods,
  isTargetMet,
  type AggregatableSample,
} from "@/modules/regulatory/domain/service-level-aggregation";
import { evaluateSample } from "@/modules/regulatory/domain/service-level-evaluation";
import { SERVICE_LEVEL_PARAMETERS } from "@/modules/regulatory/domain/service-level-standards";
import {
  countCalendarDays,
  countWorkingDays,
  wibMonth,
  wibYearRange,
} from "@/modules/regulatory/domain/wib-calendar";

const wib = (value: string) => new Date(`${value}+07:00`);
const NO_HOLIDAYS = new Set<string>();

describe("kalender WIB", () => {
  it.each([
    ["10/02 → 11/02", "2025-02-10T08:15:00", "2025-02-11T16:30:00", 1],
    [
      "Kamis → Senin, Sabtu-Minggu dilewati",
      "2025-02-13T08:00:00",
      "2025-02-17T09:00:00",
      2,
    ],
    ["Senin → Kamis", "2025-02-17T10:00:00", "2025-02-20T16:00:00", 3],
    ["hari yang sama", "2025-02-18T08:00:00", "2025-02-18T17:00:00", 0],
  ])("hari kerja %s = %i (contoh Komdigi)", (_label, start, end, expected) => {
    expect(countWorkingDays(wib(start), wib(end), NO_HOLIDAYS)).toBe(expected);
  });

  it("hari libur tidak dihitung sebagai hari kerja", () => {
    expect(
      countWorkingDays(
        wib("2025-03-27T09:00:00"),
        wib("2025-04-01T09:00:00"),
        new Set(["2025-03-31"]),
      ),
    ).toBe(2);
  });

  it("hari kalender mengikuti tanggal WIB, bukan selisih 24 jam", () => {
    expect(
      countCalendarDays(wib("2025-01-04T14:00:00"), wib("2025-01-09T08:00:00")),
    ).toBe(5);
    expect(
      countCalendarDays(wib("2025-01-04T23:30:00"), wib("2025-01-05T00:30:00")),
    ).toBe(1);
  });

  it("bulan & rentang tahun memakai WIB", () => {
    expect(wibMonth(new Date("2026-01-31T18:00:00Z"))).toBe(2);
    expect(wibYearRange(2026).from.toISOString()).toBe(
      "2025-12-31T17:00:00.000Z",
    );
  });
});

describe("penilaian permohonan", () => {
  const pasangBaru = SERVICE_LEVEL_PARAMETERS.PASANG_BARU;
  const pemulihan = SERVICE_LEVEL_PARAMETERS.PEMULIHAN_LAYANAN;
  const context = { now: wib("2025-03-20T12:00:00"), holidayKeys: NO_HOLIDAYS };

  it("selesai dalam batas memenuhi, lewat batas tidak", () => {
    expect(
      evaluateSample(
        pasangBaru,
        {
          startedAt: wib("2025-01-04T14:00:00"),
          finishedAt: wib("2025-01-09T10:00:00"),
        },
        context,
      ),
    ).toEqual({ durationDays: 5, outcome: "MET" });
    expect(
      evaluateSample(
        pasangBaru,
        {
          startedAt: wib("2025-01-08T11:00:00"),
          finishedAt: wib("2025-01-17T10:00:00"),
        },
        context,
      ).outcome,
    ).toBe("NOT_MET");
  });

  it("belum selesai: masih dalam batas belum dinilai, lewat batas pasti tidak memenuhi", () => {
    expect(
      evaluateSample(
        pemulihan,
        { startedAt: wib("2025-03-19T09:00:00"), finishedAt: null },
        context,
      ).outcome,
    ).toBe("PENDING");
    expect(
      evaluateSample(
        pemulihan,
        { startedAt: wib("2025-03-10T09:00:00"), finishedAt: null },
        context,
      ).outcome,
    ).toBe("NOT_MET");
  });
});

describe("agregasi tertimbang (Sheet3 contoh Komdigi)", () => {
  const MONTHLY = [
    [59, 55],
    [67, 67],
    [54, 54],
    [47, 46],
    [44, 40],
    [42, 40],
    [81, 68],
    [106, 79],
    [31, 30],
    [54, 54],
    [39, 33],
    [71, 71],
  ];
  const samples: AggregatableSample[] = MONTHLY.flatMap(
    ([received, met], index) =>
      Array.from({ length: received }, (_, sampleIndex) => ({
        month: index + 1,
        region: "Kabupaten Bogor",
        outcome: sampleIndex < met ? ("MET" as const) : ("NOT_MET" as const),
      })),
  );

  it("kuartal & tahunan sama dengan contoh", () => {
    const months = aggregateByMonth(samples);
    const quarters = aggregateByQuarter(months);

    expect(quarters.map((quarter) => quarter.ratio)).toEqual([
      expect.closeTo(0.977777777777778, 12),
      expect.closeTo(0.947368421052632, 12),
      expect.closeTo(0.811926605504587, 12),
      expect.closeTo(0.963414634146341, 12),
    ]);
    expect(combinePeriods(months).ratio).toBeCloseTo(0.916546762589928, 12);
    expect(isTargetMet(combinePeriods(months), 0.9)).toBe(true);
  });

  it("permohonan yang belum dinilai tidak ikut dihitung; tanpa data = null", () => {
    const months = aggregateByMonth([
      { month: 1, region: "X", outcome: "MET" },
      { month: 1, region: "X", outcome: "PENDING" },
    ]);
    expect(months[0]).toMatchObject({ received: 1, met: 1, ratio: 1 });
    expect(months[1].ratio).toBeNull();
    expect(isTargetMet(combinePeriods([]), 0.9)).toBeNull();
  });
});
