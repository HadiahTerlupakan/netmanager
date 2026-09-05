import type { PlanningItemEntity } from "./entities/PlanningItemEntity";
import type { PlanningMilestoneEntity } from "./entities/PlanningMilestoneEntity";

/**
 * Apakah penyetuju tingkat kedua orang yang berbeda dari tingkat pertama.
 *
 * Alur `approvalLevel: 2` memisahkan `approvedLevel1ById` dan `approvedById`,
 * yang maksudnya jelas: dua orang berbeda. Tanpa pemeriksaan ini satu orang
 * dapat menyetujui kedua tingkat sendirian, sehingga persetujuan berlapis
 * hanya menambah klik tanpa memberi kendali apa pun — padahal dokumen ini
 * memutuskan belanja infrastruktur.
 *
 * Mengembalikan boolean, bukan melempar. Layer domain tidak boleh mengenal
 * bentuk error yang dipahami transport (lihat `tests/architecture/
 * domain-purity.test.ts`): keputusan "apakah aturan ini dilanggar" milik
 * domain, keputusan "jadi status HTTP berapa" milik service dan route.
 */
export function isApproverDistinct(options: {
  approverId: string;
  approvedLevel1ById: string | null;
}): boolean {
  if (!options.approvedLevel1ById) {
    return true;
  }

  return options.approvedLevel1ById !== options.approverId;
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
 * Toleransi pembulatan saat membandingkan dua nilai rupiah.
 *
 * `quantity` dan `estimatedPrice` adalah `Float` di database, jadi
 * `sumItemsEstimatedCost` mengakumulasi galat biner: tiga item 33.333,33 plus
 * 0,1 plus 0,2 menghasilkan 100.000,29000000001 terhadap header 100.000,29.
 * Perbandingan ketat menandai itu sebagai selisih. Satu rupiah adalah unit
 * terkecil yang punya arti di dokumen anggaran, sekaligus jauh di atas galat
 * float yang mungkin terakumulasi pada BOQ sebesar apa pun.
 */
const BUDGET_COMPARISON_TOLERANCE = 1;

/**
 * Keadaan BOQ sebuah rencana, dilihat dari sisi harga.
 *
 * Tiga keadaan ini harus dibedakan karena artinya berbeda:
 * - `no-items`: BOQ belum diisi sama sekali. Wajar untuk rencana yang baru
 *   dibuat, dan tidak ada yang bisa dibandingkan dengan anggaran header.
 * - `items-without-price`: ada item, tetapi tidak satu pun punya harga
 *   estimasi. Inilah yang patut ditandai — anggaran header berdiri tanpa satu
 *   angka BOQ pun yang mendukungnya.
 * - `priced`: minimal satu item berharga, jadi totalnya layak dibandingkan.
 */
export type BoqPricingState = "no-items" | "items-without-price" | "priced";

/** Menentukan {@link BoqPricingState} dari daftar item. */
export function resolveBoqPricingState(
  items: Pick<PlanningItemEntity, "estimatedPrice">[],
): BoqPricingState {
  if (items.length === 0) {
    return "no-items";
  }

  return items.some((item) => item.estimatedPrice !== null)
    ? "priced"
    : "items-without-price";
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
  boqState: BoqPricingState,
): boolean {
  if (estimatedBudget === null) {
    return false;
  }

  // Rencana yang BOQ-nya belum diisi tidak ditandai. Ini keadaan normal setiap
  // rencana yang baru dibuat; menandainya akan memunculkan peringatan selisih
  // anggaran pada setiap rencana baru — persis kebalikan dari gunanya.
  if (boqState === "no-items") {
    return false;
  }

  if (boqState === "items-without-price") {
    return estimatedBudget !== 0;
  }

  return (
    Math.abs(itemsTotalCost - estimatedBudget) > BUDGET_COMPARISON_TOLERANCE
  );
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

/**
 * Ambang anggaran yang memicu persetujuan dua tingkat (Rupiah).
 *
 * Sebelumnya konstanta dan rumusnya disalin di `PlanningService`,
 * `PlanningApprovalService`, dan `PlanningTemplateService` — tiga salinan
 * aturan bisnis yang sama, yang berarti tiga peluang untuk berbeda diam-diam.
 */
export const TWO_STEP_APPROVAL_BUDGET_THRESHOLD = 500_000_000;

/**
 * Menentukan berapa tingkat persetujuan yang dibutuhkan sebuah anggaran.
 *
 * `null` dan `0` sengaja dibedakan dari nilai lain lewat pemeriksaan eksplisit,
 * bukan lewat falsy check: anggaran nol adalah nilai sah yang cukup satu
 * tingkat, dan menyamakannya dengan "belum diisi" mengaburkan maksudnya.
 */
export function resolveApprovalLevel(estimatedBudget: number | null): number {
  if (estimatedBudget === null) {
    return 1;
  }

  return estimatedBudget >= TWO_STEP_APPROVAL_BUDGET_THRESHOLD ? 2 : 1;
}

/**
 * Anggaran yang menjadi dasar tingkat persetujuan saat rencana diajukan.
 *
 * Diambil dari nilai terbesar antara anggaran header dan total BOQ. Alasannya
 * konkret: `estimatedBudget` dikunci saat rencana dibuat, sementara item BOQ
 * masih boleh ditambah selama status BACKLOG. Rencana yang dibuat dengan header
 * Rp 100 juta lalu diisi BOQ Rp 900 juta akan diajukan sebagai satu tingkat
 * bila hanya header yang dibaca — satu orang menyetujui belanja yang menurut
 * aturan butuh dua. Header tetap ikut dipertimbangkan karena boleh memuat
 * komponen di luar BOQ.
 */
export function resolveApprovalBaseBudget(options: {
  estimatedBudget: number | null;
  itemsTotalCost: number;
}): number | null {
  const { estimatedBudget, itemsTotalCost } = options;

  if (estimatedBudget === null) {
    return itemsTotalCost > 0 ? itemsTotalCost : null;
  }

  return Math.max(estimatedBudget, itemsTotalCost);
}
