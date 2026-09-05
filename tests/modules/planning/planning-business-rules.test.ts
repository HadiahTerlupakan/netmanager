import { describe, expect, it } from "vitest";
import {
  calculateProgressFromMilestones,
  resolveBoqPricingState,
  hasBudgetMismatch,
  sumItemsEstimatedCost,
  isApproverDistinct,
} from "@/modules/planning/domain/planning-business-rules";

const milestone = (status: string) => ({ status }) as never;
const item = (quantity: number, estimatedPrice: number | null) =>
  ({ quantity, estimatedPrice }) as never;

describe("isApproverDistinct", () => {
  // Alur approvalLevel 2 memisahkan approvedLevel1ById dan approvedById —
  // niatnya jelas dua orang berbeda. Tanpa pengecekan ini satu orang bisa
  // menyetujui kedua tingkat sendirian, sehingga persetujuan berlapis tidak
  // memberi kendali apa pun.
  it("menolak approver level 2 yang sama dengan approver level 1", () => {
    expect(
      isApproverDistinct({
        approverId: "user-1",
        approvedLevel1ById: "user-1",
      }),
    ).toBe(false);
  });

  it("mengizinkan approver level 2 yang berbeda", () => {
    expect(
      isApproverDistinct({
        approverId: "user-2",
        approvedLevel1ById: "user-1",
      }),
    ).toBe(true);
  });

  // Persetujuan tingkat pertama belum punya pendahulu, jadi tidak ada yang
  // perlu dibandingkan.
  it("mengizinkan saat belum ada approver level 1", () => {
    expect(
      isApproverDistinct({
        approverId: "user-1",
        approvedLevel1ById: null,
      }),
    ).toBe(true);
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

describe("resolveBoqPricingState", () => {
  it("mengenali daftar yang punya minimal satu harga estimasi", () => {
    expect(resolveBoqPricingState([item(2, null), item(3, 500)])).toBe(
      "priced",
    );
  });

  it("membedakan item tanpa harga dari BOQ yang belum diisi", () => {
    expect(resolveBoqPricingState([item(2, null), item(3, null)])).toBe(
      "items-without-price",
    );
  });

  it("mengenali BOQ yang belum diisi sama sekali", () => {
    expect(resolveBoqPricingState([])).toBe("no-items");
  });
});

describe("hasBudgetMismatch", () => {
  it("menandai saat total item berbeda dari anggaran header", () => {
    expect(hasBudgetMismatch(3500, 2000, "priced")).toBe(true);
  });

  it("tidak menandai saat keduanya sama", () => {
    expect(hasBudgetMismatch(3500, 3500, "priced")).toBe(false);
  });

  // Anggaran belum diisi bukan ketidakcocokan — belum ada yang dibandingkan.
  it("tidak menandai saat anggaran header belum diisi", () => {
    expect(hasBudgetMismatch(3500, null, "priced")).toBe(false);
  });

  // `quantity` dan `estimatedPrice` adalah Float di database, jadi penjumlahan
  // BOQ mengakumulasi galat biner. Perbandingan ketat menandainya sebagai
  // selisih anggaran padahal angkanya identik di mata pengguna.
  it("mengabaikan galat pembulatan float di bawah satu rupiah", () => {
    expect(hasBudgetMismatch(100_000.29000000001, 100_000.29, "priced")).toBe(
      false,
    );
  });

  it("tetap menandai selisih di atas satu rupiah", () => {
    expect(hasBudgetMismatch(3500, 3498, "priced")).toBe(true);
  });

  // Rencana dengan 20 item yang semuanya tanpa harga bertotal nol, sama seperti
  // rencana tanpa item — tetapi artinya berbeda. Yang pertama patut ditandai:
  // anggaran header berdiri tanpa satu pun harga BOQ yang mendukungnya.
  it("menandai anggaran header saat ada item tapi tidak satu pun berharga", () => {
    expect(hasBudgetMismatch(0, 2000, "items-without-price")).toBe(true);
  });

  it("tidak menandai saat item tanpa harga dan anggaran header nol", () => {
    expect(hasBudgetMismatch(0, 0, "items-without-price")).toBe(false);
  });

  // Rencana yang baru dibuat belum punya BOQ sama sekali. Menandainya akan
  // memunculkan peringatan selisih anggaran pada setiap rencana baru — persis
  // kebalikan dari gunanya.
  it("tidak menandai rencana yang BOQ-nya belum diisi sama sekali", () => {
    expect(hasBudgetMismatch(0, 2000, "no-items")).toBe(false);
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
