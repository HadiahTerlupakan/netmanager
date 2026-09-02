import type { PlanningItemEntity } from "./entities/PlanningItemEntity";
import type { PlanningMilestoneEntity } from "./entities/PlanningMilestoneEntity";

/** Dilempar saat satu orang mencoba menyetujui lebih dari satu tingkat. */
export class PlanningSegregationOfDutiesError extends Error {
  constructor(
    message = "Persetujuan tingkat kedua harus dilakukan oleh orang yang berbeda dari penyetuju tingkat pertama",
  ) {
    super(message);
    this.name = "PlanningSegregationOfDutiesError";
  }
}

/**
 * Memastikan penyetuju tingkat kedua bukan orang yang sama dengan tingkat
 * pertama.
 *
 * Alur `approvalLevel: 2` memisahkan `approvedLevel1ById` dan `approvedById`,
 * yang maksudnya jelas: dua orang berbeda. Tanpa pemeriksaan ini satu orang
 * dapat menyetujui kedua tingkat sendirian, sehingga persetujuan berlapis hanya
 * menambah klik tanpa memberi kendali apa pun — padahal dokumen ini memutuskan
 * belanja infrastruktur.
 */
export function assertApproverIsDistinct(options: {
  approverId: string;
  approvedLevel1ById: string | null;
}): void {
  if (!options.approvedLevel1ById) {
    return;
  }

  if (options.approvedLevel1ById === options.approverId) {
    throw new PlanningSegregationOfDutiesError();
  }
}

/**
 * Menjumlahkan biaya estimasi seluruh item (BOQ).
 * Item tanpa harga estimasi dilewati, bukan dianggap nol secara diam-diam.
 */
export function sumItemsEstimatedCost(
  items: Pick<PlanningItemEntity, "quantity" | "estimatedPrice">[],
): number {
  return items.reduce((total, item) => {
    if (item.estimatedPrice === null) {
      return total;
    }
    return total + item.quantity * item.estimatedPrice;
  }, 0);
}

/**
 * Menandai ketidakcocokan antara total BOQ dan anggaran yang diketik di header.
 *
 * Keduanya selama ini berdiri sendiri: `PlanningItemEntity.getTotalEstimated()`
 * tidak pernah dipanggil, sehingga item dapat berjumlah jauh berbeda dari
 * `estimatedBudget` tanpa ada yang memprotes.
 *
 * Sengaja tidak menimpa nilai header: angka itu bisa memuat komponen di luar
 * BOQ. Yang dibutuhkan adalah selisihnya terlihat, bukan disembunyikan.
 */
export function hasBudgetMismatch(
  itemsTotalCost: number,
  estimatedBudget: number | null,
): boolean {
  if (estimatedBudget === null || itemsTotalCost === 0) {
    return false;
  }

  return itemsTotalCost !== estimatedBudget;
}

/**
 * Menghitung progres dari milestone yang berstatus COMPLETED.
 *
 * `progressPercentage` sebelumnya diketik manual, sehingga sebuah rencana dapat
 * menyatakan 90% selesai padahal seluruh milestone-nya masih PENDING.
 *
 * @returns persentase bulat, atau null bila belum ada milestone sebagai dasar.
 */
export function calculateProgressFromMilestones(
  milestones: Pick<PlanningMilestoneEntity, "status">[],
): number | null {
  if (milestones.length === 0) {
    return null;
  }

  const completed = milestones.filter(
    (milestone) => milestone.status === "COMPLETED",
  ).length;

  return Math.round((completed / milestones.length) * 100);
}
