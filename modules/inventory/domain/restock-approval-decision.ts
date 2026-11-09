/**
 * Aturan keputusan penyetuju atas setiap baris pengajuan restock.
 *
 * Murni: tanpa Prisma, tanpa framework. Service memuat data, memanggil
 * `resolveRestockApprovalDecision`, lalu menyerahkan rencana tulisnya ke
 * repository. Semua pesan ditujukan ke penyetuju dengan kata sehari-hari.
 */

export type RestockLineDecision = "APPROVED" | "REJECTED";

/** Baris barang pengajuan seperti tersimpan saat keputusan dibuat. */
export interface RestockApprovalBarangLine {
  id: string;
  barangId: string;
  barangNama: string;
  jumlah: number;
  hargaPerUnit: number;
}

/** Baris jasa pengajuan seperti tersimpan saat keputusan dibuat. */
export interface RestockApprovalJasaLine {
  id: string;
  jasaNama: string;
  jumlah: number;
  hargaPerUnit: number;
}

/** Keputusan penyetuju untuk satu baris barang. */
export interface RestockApprovalBarangDecision {
  itemId: string;
  keputusan: RestockLineDecision;
  jumlah?: number;
  barangIdPengganti?: string | null;
  catatan?: string;
}

/** Keputusan penyetuju untuk satu baris jasa. */
export interface RestockApprovalJasaDecision {
  itemId: string;
  keputusan: RestockLineDecision;
  jumlah?: number;
  catatan?: string;
}

/** Barang pengganti yang ditemukan di tenant yang sama. */
export interface RestockApprovalBarangRef {
  id: string;
  nama: string;
}

export interface RestockApprovalDecisionInput {
  barangLines: RestockApprovalBarangLine[];
  jasaLines: RestockApprovalJasaLine[];
  barangDecisions: RestockApprovalBarangDecision[];
  jasaDecisions: RestockApprovalJasaDecision[];
  /** Hasil pencarian barang pengganti, sudah disaring per tenant. */
  substituteBarangs: RestockApprovalBarangRef[];
}

/** Perubahan jumlah: `jumlahDiminta` menyimpan jumlah sebelum diubah. */
export interface RestockQuantityChange {
  jumlah: number;
  jumlahDiminta: number;
  totalHarga: number;
}

/** Penggantian barang: `barangIdDiminta` menyimpan barang yang diminta. */
export interface RestockBarangSubstitution {
  barangId: string;
  barangNama: string;
  barangIdDiminta: string;
}

interface RestockLinePlanBase {
  itemId: string;
  nama: string;
  statusApproval: RestockLineDecision;
  catatanApproval: string | null;
  jumlahDisetujui: number;
  quantityChange: RestockQuantityChange | null;
}

export type RestockJasaLinePlan = RestockLinePlanBase;

export interface RestockBarangLinePlan extends RestockLinePlanBase {
  substitution: RestockBarangSubstitution | null;
}

/** Rencana tulis per baris; baris yang ditolak tidak membawa perubahan. */
export interface RestockApprovalPlan {
  barangLines: RestockBarangLinePlan[];
  jasaLines: RestockJasaLinePlan[];
}

/** `INVALID` → isian penyetuju perlu dibetulkan; `CONFLICT` → keadaan pengajuan tidak cocok. */
export type RestockApprovalDecisionErrorCode = "INVALID" | "CONFLICT";

export type RestockApprovalDecisionResult =
  | { success: true; data: RestockApprovalPlan }
  | {
      success: false;
      code: RestockApprovalDecisionErrorCode;
      error: string;
    };

export const RESTOCK_APPROVAL_MESSAGES = {
  linesChanged:
    "Isi pengajuan berubah sejak dibuka. Muat ulang lalu putuskan lagi.",
  allRejected: "Semua item ditolak. Pakai Tolak Pengajuan dan tulis alasannya.",
} as const;

interface LineCommon {
  id: string;
  nama: string;
  jumlah: number;
  hargaPerUnit: number;
}

interface DecisionCommon {
  itemId: string;
  keputusan: RestockLineDecision;
  jumlah?: number;
  catatan?: string;
}

/**
 * Periksa keputusan penyetuju terhadap isi pengajuan dan hasilkan rencana
 * tulis per baris, atau alasan kenapa keputusan itu belum bisa disimpan.
 */
export function resolveRestockApprovalDecision(
  input: RestockApprovalDecisionInput,
): RestockApprovalDecisionResult {
  const barangCommon = input.barangLines.map(toBarangCommon);
  const jasaCommon = input.jasaLines.map(toJasaCommon);

  if (
    !coversExactly(barangCommon, input.barangDecisions) ||
    !coversExactly(jasaCommon, input.jasaDecisions)
  ) {
    return conflict(RESTOCK_APPROVAL_MESSAGES.linesChanged);
  }

  const isAnythingApproved = [
    ...input.barangDecisions,
    ...input.jasaDecisions,
  ].some((decision) => decision.keputusan === "APPROVED");
  if (!isAnythingApproved)
    return conflict(RESTOCK_APPROVAL_MESSAGES.allRejected);

  const problems: string[] = [];
  const barangPlans = planBarangLines(input, problems);
  const jasaPlans = jasaCommon.map((line) =>
    planLine(line, findDecision(input.jasaDecisions, line.id), false, problems),
  );

  if (problems.length > 0) {
    return { success: false, code: "INVALID", error: problems.join("\n") };
  }
  return {
    success: true,
    data: { barangLines: barangPlans, jasaLines: jasaPlans },
  };
}

function toBarangCommon(line: RestockApprovalBarangLine): LineCommon {
  return {
    id: line.id,
    nama: line.barangNama,
    jumlah: line.jumlah,
    hargaPerUnit: line.hargaPerUnit,
  };
}

function toJasaCommon(line: RestockApprovalJasaLine): LineCommon {
  return {
    id: line.id,
    nama: line.jasaNama,
    jumlah: line.jumlah,
    hargaPerUnit: line.hargaPerUnit,
  };
}

function conflict(error: string): RestockApprovalDecisionResult {
  return { success: false, code: "CONFLICT", error };
}

/** Setiap baris diputuskan tepat sekali, dan tidak ada baris asing. */
function coversExactly(
  lines: LineCommon[],
  decisions: Array<{ itemId: string }>,
): boolean {
  const decidedIds = new Set(decisions.map((decision) => decision.itemId));
  return (
    decidedIds.size === decisions.length &&
    decisions.length === lines.length &&
    lines.every((line) => decidedIds.has(line.id))
  );
}

function findDecision<T extends { itemId: string }>(
  decisions: T[],
  itemId: string,
): T {
  const decision = decisions.find((candidate) => candidate.itemId === itemId);
  if (!decision) {
    throw new Error(
      `Keputusan untuk baris ${itemId} hilang setelah dicocokkan`,
    );
  }
  return decision;
}

function planBarangLines(
  input: RestockApprovalDecisionInput,
  problems: string[],
): RestockBarangLinePlan[] {
  return input.barangLines.map((line) => {
    const decision = findDecision(input.barangDecisions, line.id);
    const substitution = resolveSubstitution(line, decision, input, problems);
    const plan = planLine(
      toBarangCommon(line),
      decision,
      substitution !== null,
      problems,
    );
    return { ...plan, substitution };
  });
}

function planLine(
  line: LineCommon,
  decision: DecisionCommon,
  isSubstituted: boolean,
  problems: string[],
): RestockLinePlanBase {
  const catatan = decision.catatan?.trim() || null;
  const isRejected = decision.keputusan === "REJECTED";
  const approvedQuantity = isRejected
    ? line.jumlah
    : (decision.jumlah ?? line.jumlah);
  const isQuantityChanged = !isRejected && approvedQuantity !== line.jumlah;

  if (!catatan && (isRejected || isQuantityChanged || isSubstituted)) {
    problems.push(
      `${line.nama}: ${describeMissingNote(isRejected, isQuantityChanged, line.jumlah, approvedQuantity)}`,
    );
  }

  return {
    itemId: line.id,
    nama: line.nama,
    statusApproval: decision.keputusan,
    catatanApproval: catatan,
    jumlahDisetujui: isRejected ? 0 : approvedQuantity,
    quantityChange: isQuantityChanged
      ? {
          jumlah: approvedQuantity,
          jumlahDiminta: line.jumlah,
          totalHarga: approvedQuantity * line.hargaPerUnit,
        }
      : null,
  };
}

function describeMissingNote(
  isRejected: boolean,
  isQuantityChanged: boolean,
  requestedQuantity: number,
  approvedQuantity: number,
): string {
  if (isRejected) return "tulis alasan baris ini ditolak.";
  if (isQuantityChanged) {
    return `tulis catatan kenapa jumlahnya diubah dari ${requestedQuantity} menjadi ${approvedQuantity}.`;
  }
  return "tulis catatan kenapa barangnya diganti.";
}

function resolveSubstitution(
  line: RestockApprovalBarangLine,
  decision: RestockApprovalBarangDecision,
  input: RestockApprovalDecisionInput,
  problems: string[],
): RestockBarangSubstitution | null {
  const substituteId = decision.barangIdPengganti;
  if (decision.keputusan === "REJECTED" || !substituteId) return null;

  if (substituteId === line.barangId) {
    problems.push(
      `${line.barangNama}: barang pengganti sama dengan barang yang diminta. Kosongkan pilihan penggantinya.`,
    );
    return null;
  }
  const substitute = input.substituteBarangs.find(
    (barang) => barang.id === substituteId,
  );
  if (!substitute) {
    problems.push(
      `${line.barangNama}: barang pengganti tidak ditemukan di daftar barang. Mungkin sudah dihapus. Pilih barang pengganti lain.`,
    );
    return null;
  }
  if (isBarangUsedByOtherLine(substituteId, line.id, input)) {
    problems.push(
      `${line.barangNama}: ${substitute.nama} sudah ada di baris lain pengajuan ini. Ubah saja jumlah di baris itu, atau pilih pengganti lain.`,
    );
    return null;
  }
  return {
    barangId: substitute.id,
    barangNama: substitute.nama,
    barangIdDiminta: line.barangId,
  };
}

/** Pengganti tidak boleh sama dengan barang atau pengganti baris lain yang tidak ditolak. */
function isBarangUsedByOtherLine(
  barangId: string,
  ownLineId: string,
  input: RestockApprovalDecisionInput,
): boolean {
  return input.barangLines.some((other) => {
    if (other.id === ownLineId) return false;
    const otherDecision = findDecision(input.barangDecisions, other.id);
    if (otherDecision.keputusan === "REJECTED") return false;
    return (
      other.barangId === barangId ||
      otherDecision.barangIdPengganti === barangId
    );
  });
}
