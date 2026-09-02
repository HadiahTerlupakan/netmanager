import { describe, expect, it } from "vitest";
import {
  calculateProgressFromMilestones,
  hasBudgetMismatch,
  sumItemsEstimatedCost,
  assertApproverIsDistinct,
  PlanningSegregationOfDutiesError,
} from "@/modules/planning/domain/planning-business-rules";

const milestone = (status: string) => ({ status }) as never;
const item = (quantity: number, estimatedPrice: number | null) =>
  ({ quantity, estimatedPrice }) as never;

describe("assertApproverIsDistinct", () => {
  // Alur approvalLevel 2 memisahkan approvedLevel1ById dan approvedById —
  // niatnya jelas dua orang berbeda. Tanpa pengecekan ini satu orang bisa
  // menyetujui kedua tingkat sendirian, sehingga persetujuan berlapis tidak
  // memberi kendali apa pun.
  it("menolak approver level 2 yang sama dengan approver level 1", () => {
    expect(() =>
      assertApproverIsDistinct({
        approverId: "user-1",
        approvedLevel1ById: "user-1",
      }),
    ).toThrow(PlanningSegregationOfDutiesError);
  });

  it("mengizinkan approver level 2 yang berbeda", () => {
    expect(() =>
      assertApproverIsDistinct({
        approverId: "user-2",
        approvedLevel1ById: "user-1",
      }),
    ).not.toThrow();
  });

  // Persetujuan tingkat pertama belum punya pendahulu, jadi tidak ada yang
  // perlu dibandingkan.
  it("mengizinkan saat belum ada approver level 1", () => {
    expect(() =>
      assertApproverIsDistinct({
        approverId: "user-1",
        approvedLevel1ById: null,
      }),
    ).not.toThrow();
  });
});

describe("sumItemsEstimatedCost", () => {
  // PlanningItemEntity punya getTotalEstimated() tapi tidak pernah dipanggil
  // di mana pun, sehingga BOQ dan anggaran header bisa berbeda tanpa protes.
  it("menjumlahkan kuantitas dikali harga estimasi", () => {
    expect(sumItemsEstimatedCost([item(2, 1000), item(3, 500)])).toBe(3500);
  });

  it("melewati item tanpa harga estimasi", () => {
    expect(sumItemsEstimatedCost([item(2, 1000), item(5, null)])).toBe(2000);
  });

  it("mengembalikan nol untuk daftar kosong", () => {
    expect(sumItemsEstimatedCost([])).toBe(0);
  });
});

describe("hasBudgetMismatch", () => {
  it("menandai saat total item berbeda dari anggaran header", () => {
    expect(hasBudgetMismatch(3500, 2000)).toBe(true);
  });

  it("tidak menandai saat keduanya sama", () => {
    expect(hasBudgetMismatch(3500, 3500)).toBe(false);
  });

  // Anggaran belum diisi bukan ketidakcocokan — belum ada yang dibandingkan.
  it("tidak menandai saat anggaran header belum diisi", () => {
    expect(hasBudgetMismatch(3500, null)).toBe(false);
  });

  it("tidak menandai saat belum ada item sama sekali", () => {
    expect(hasBudgetMismatch(0, 2000)).toBe(false);
  });
});

describe("calculateProgressFromMilestones", () => {
  // progressPercentage sebelumnya diketik manual, sehingga rencana bisa
  // menyatakan 90% padahal seluruh milestone masih PENDING.
  it("menghitung persentase dari milestone yang selesai", () => {
    expect(
      calculateProgressFromMilestones([
        milestone("COMPLETED"),
        milestone("COMPLETED"),
        milestone("PENDING"),
        milestone("BLOCKED"),
      ]),
    ).toBe(50);
  });

  it("mengembalikan 100 saat semua milestone selesai", () => {
    expect(
      calculateProgressFromMilestones([
        milestone("COMPLETED"),
        milestone("COMPLETED"),
      ]),
    ).toBe(100);
  });

  it("mengembalikan 0 saat belum ada yang selesai", () => {
    expect(calculateProgressFromMilestones([milestone("PENDING")])).toBe(0);
  });

  // Tanpa milestone tidak ada dasar menghitung; pemanggil yang memutuskan
  // memakai nilai manual.
  it("mengembalikan null saat tidak ada milestone", () => {
    expect(calculateProgressFromMilestones([])).toBeNull();
  });

  it("membulatkan ke bilangan bulat", () => {
    expect(
      calculateProgressFromMilestones([
        milestone("COMPLETED"),
        milestone("PENDING"),
        milestone("PENDING"),
      ]),
    ).toBe(33);
  });
});
