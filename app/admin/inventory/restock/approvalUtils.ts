import type {
  Barang,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestJasaItem,
  RestockApprovalDecisions,
  RestockApprovalLineDecision,
  RestockApprovePayload,
  RestockRejectPayload,
} from "./types";

/** Batas panjang catatan, sama dengan validasi server. */
export const APPROVAL_OVERALL_NOTE_MAX_LENGTH = 500;
export const APPROVAL_LINE_NOTE_MAX_LENGTH = 255;

export const ALL_LINES_REJECTED_MESSAGE =
  "Semua item ditolak. Pakai Tolak Pengajuan dan tulis alasannya.";

/** Baris barang atau jasa yang bisa diputuskan approver. */
export type ApprovalLine = PurchaseRequestItem | PurchaseRequestJasaItem;

export interface RestockSubstituteOption {
  value: string;
  label: string;
  subLabel: string;
}

/** Baris yang ditolak approver; tidak ikut PO maupun penerimaan. */
export function isLineRejected(line: ApprovalLine): boolean {
  return line.statusApproval === "REJECTED";
}

/** Approver mengubah jumlah baris ini dari yang diajukan. */
export function wasQtyChanged(line: ApprovalLine): boolean {
  return line.jumlahDiminta != null && line.jumlahDiminta !== line.jumlah;
}

/** Approver mengganti barang baris ini dengan barang lain. */
export function wasSubstituted(item: PurchaseRequestItem): boolean {
  return !!item.barangIdDiminta && item.barangIdDiminta !== item.barangId;
}

/** Jumlah yang semula diajukan pemohon, sebelum diubah approver. */
export function getRequestedQuantity(line: ApprovalLine): number {
  return line.jumlahDiminta ?? line.jumlah;
}

/**
 * Satuan jumlah yang diajukan. Bila barangnya diganti, jumlah yang diajukan
 * memakai satuan barang asli, bukan satuan barang pengganti.
 */
export function getRequestedSatuan(item: PurchaseRequestItem): string {
  const satuan = item.barang?.satuan || "-";
  if (!wasSubstituted(item)) return satuan;
  return item.barangDiminta?.satuan || satuan;
}

function buildDefaultDecision(line: ApprovalLine): RestockApprovalLineDecision {
  return {
    keputusan: "APPROVED",
    jumlah: line.jumlah,
    barangIdPengganti: null,
    catatan: "",
  };
}

function buildDecisionMap(
  lines: ApprovalLine[],
): Record<string, RestockApprovalLineDecision> {
  return Object.fromEntries(
    lines.map((line) => [line.id, buildDefaultDecision(line)]),
  );
}

/** Keputusan awal: semua baris disetujui sesuai jumlah yang diajukan. */
export function buildInitialApprovalDecisions(
  request: PurchaseRequest,
): RestockApprovalDecisions {
  return {
    items: buildDecisionMap(request.items),
    jasaItems: buildDecisionMap(request.jasaItems ?? []),
  };
}

/** Barang pengganti yang benar-benar berbeda dari barang yang diajukan. */
export function getEffectiveSubstitute(
  decision: RestockApprovalLineDecision,
  originalBarangId?: string,
): string | null {
  const substitute = decision.barangIdPengganti;
  if (!substitute || substitute === originalBarangId) return null;
  return substitute;
}

/** Keputusan ini mengubah jumlah yang diajukan. */
export function isDecisionQtyChanged(
  decision: RestockApprovalLineDecision,
  line: ApprovalLine,
): boolean {
  return decision.keputusan === "APPROVED" && decision.jumlah !== line.jumlah;
}

/**
 * Catatan baris wajib bila baris ditolak, jumlahnya diubah, atau barangnya
 * diganti: pemohon perlu tahu kenapa permintaannya tidak dipenuhi apa adanya.
 */
export function isDecisionNoteRequired(
  decision: RestockApprovalLineDecision,
  line: ApprovalLine,
  originalBarangId?: string,
): boolean {
  if (decision.keputusan === "REJECTED") return true;
  return (
    isDecisionQtyChanged(decision, line) ||
    getEffectiveSubstitute(decision, originalBarangId) !== null
  );
}

function isValidApprovedQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1;
}

function describeLineProblems(
  name: string,
  decision: RestockApprovalLineDecision | undefined,
  line: ApprovalLine,
  originalBarangId?: string,
): string[] {
  if (!decision) return [`${name}: keputusannya belum dipilih.`];

  const problems: string[] = [];
  if (
    decision.keputusan === "APPROVED" &&
    !isValidApprovedQuantity(decision.jumlah)
  ) {
    problems.push(`${name}: jumlah yang disetujui harus 1 atau lebih.`);
  }
  const note = decision.catatan.trim();
  if (isDecisionNoteRequired(decision, line, originalBarangId) && !note) {
    problems.push(`${name}: ${describeMissingNoteReason(decision, line)}`);
  }
  if (note.length > APPROVAL_LINE_NOTE_MAX_LENGTH) {
    problems.push(
      `${name}: catatan paling panjang ${APPROVAL_LINE_NOTE_MAX_LENGTH} karakter.`,
    );
  }
  return problems;
}

function describeMissingNoteReason(
  decision: RestockApprovalLineDecision,
  line: ApprovalLine,
): string {
  if (decision.keputusan === "REJECTED") {
    return "tulis alasan item ini ditolak.";
  }
  if (isDecisionQtyChanged(decision, line)) {
    return "tulis alasan jumlahnya diubah.";
  }
  return "tulis alasan barangnya diganti.";
}

function getApprovedSubstitute(
  item: PurchaseRequestItem,
  decisions: RestockApprovalDecisions,
): string | null {
  const decision = decisions.items[item.id];
  if (!decision || decision.keputusan === "REJECTED") return null;
  return getEffectiveSubstitute(decision, item.barangId);
}

/**
 * Sama dengan aturan server: barang pengganti tidak boleh sama dengan barang
 * baris lain yang tidak ditolak, atau dengan pengganti di baris lain. Dua baris
 * asli dengan barang yang sama (tanpa penggantian) tidak dipermasalahkan.
 */
function findCollidingSubstitutes(
  request: PurchaseRequest,
  decisions: RestockApprovalDecisions,
): Set<string> {
  const colliding = new Set<string>();
  request.items.forEach((item) => {
    const substitute = getApprovedSubstitute(item, decisions);
    if (!substitute) return;
    const isUsedByOtherLine = request.items.some((other) => {
      if (other.id === item.id) return false;
      const otherDecision = decisions.items[other.id];
      if (!otherDecision || otherDecision.keputusan === "REJECTED") {
        return false;
      }
      return (
        other.barangId === substitute ||
        getApprovedSubstitute(other, decisions) === substitute
      );
    });
    if (isUsedByOtherLine) colliding.add(substitute);
  });
  return colliding;
}

function describeDuplicateApprovedBarang(
  request: PurchaseRequest,
  decisions: RestockApprovalDecisions,
  barangNamaById: ReadonlyMap<string, string>,
): string[] {
  return [...findCollidingSubstitutes(request, decisions)].map((barangId) => {
    const nama = barangNamaById.get(barangId) ?? "Barang yang sama";
    return `${nama} muncul di lebih dari satu baris setelah penggantian. Pilih barang pengganti lain.`;
  });
}

function hasApprovedLine(decisions: RestockApprovalDecisions): boolean {
  return [
    ...Object.values(decisions.items),
    ...Object.values(decisions.jasaItems),
  ].some((decision) => decision.keputusan === "APPROVED");
}

function buildBarangNamaMap(
  request: PurchaseRequest,
  allBarangs: Barang[],
): Map<string, string> {
  const namaById = new Map(
    allBarangs.map((barang) => [barang.id, barang.nama]),
  );
  request.items.forEach((item) =>
    namaById.set(item.barangId, item.barang.nama),
  );
  return namaById;
}

interface ApprovalProblemsInput {
  request: PurchaseRequest;
  decisions: RestockApprovalDecisions;
  overallNote: string;
  /** Sumber nama barang pengganti untuk pesan barang dobel. */
  allBarangs?: Barang[];
}

/**
 * Hal yang masih kurang sebelum pengajuan bisa disetujui, dalam kalimat untuk
 * approver. Daftar kosong berarti tombol Setujui boleh ditekan.
 */
export function getApprovalProblems({
  request,
  decisions,
  overallNote,
  allBarangs = [],
}: ApprovalProblemsInput): string[] {
  const problems = [
    ...request.items.flatMap((item) =>
      describeLineProblems(
        item.barang.nama,
        decisions.items[item.id],
        item,
        item.barangId,
      ),
    ),
    ...(request.jasaItems ?? []).flatMap((item) =>
      describeLineProblems(item.jasa.nama, decisions.jasaItems[item.id], item),
    ),
    ...describeDuplicateApprovedBarang(
      request,
      decisions,
      buildBarangNamaMap(request, allBarangs),
    ),
  ];

  if (!hasApprovedLine(decisions)) problems.push(ALL_LINES_REJECTED_MESSAGE);
  if (overallNote.trim().length > APPROVAL_OVERALL_NOTE_MAX_LENGTH) {
    problems.push(
      `Catatan keputusan paling panjang ${APPROVAL_OVERALL_NOTE_MAX_LENGTH} karakter.`,
    );
  }
  return problems;
}

/** Alasan tombol Tolak Pengajuan belum bisa dipakai; null bila siap. */
export function getRejectProblem(overallNote: string): string | null {
  const note = overallNote.trim();
  if (!note) return "Tulis alasan penolakan di catatan keputusan.";
  if (note.length > APPROVAL_OVERALL_NOTE_MAX_LENGTH) {
    return `Catatan keputusan paling panjang ${APPROVAL_OVERALL_NOTE_MAX_LENGTH} karakter.`;
  }
  return null;
}

function buildLineFields(decision: RestockApprovalLineDecision) {
  const catatan = decision.catatan.trim();
  return {
    keputusan: decision.keputusan,
    ...(decision.keputusan === "APPROVED" ? { jumlah: decision.jumlah } : {}),
    ...(catatan ? { catatan } : {}),
  };
}

/** Susun body APPROVE sesuai kontrak API dari keputusan per baris. */
export function buildApprovalPayload(
  request: PurchaseRequest,
  decisions: RestockApprovalDecisions,
  overallNote: string,
): RestockApprovePayload {
  const catatan = overallNote.trim();
  return {
    action: "APPROVE",
    ...(catatan ? { catatan } : {}),
    items: request.items.map((item) => {
      const decision = decisions.items[item.id] ?? buildDefaultDecision(item);
      const substitute =
        decision.keputusan === "APPROVED"
          ? getEffectiveSubstitute(decision, item.barangId)
          : null;
      return {
        itemId: item.id,
        ...buildLineFields(decision),
        ...(substitute ? { barangIdPengganti: substitute } : {}),
      };
    }),
    jasaItems: (request.jasaItems ?? []).map((item) => ({
      itemId: item.id,
      ...buildLineFields(
        decisions.jasaItems[item.id] ?? buildDefaultDecision(item),
      ),
    })),
  };
}

/** Susun body REJECT; catatan sudah dipastikan terisi oleh getRejectProblem. */
export function buildRejectPayload(overallNote: string): RestockRejectPayload {
  return { action: "REJECT", catatan: overallNote.trim() };
}

/**
 * Pilihan barang pengganti untuk satu baris. Barang yang sudah dipakai baris
 * lain yang tidak ditolak, atau sudah jadi pengganti di baris lain, tidak
 * ditawarkan supaya satu barang tidak muncul dua kali di PO.
 */
export function getSubstituteOptions(
  allBarangs: Barang[],
  request: PurchaseRequest,
  decisions: RestockApprovalDecisions,
  itemId: string,
): RestockSubstituteOption[] {
  const excludedBarangIds = new Set<string>();
  request.items.forEach((item) => {
    const decision = decisions.items[item.id];
    if (item.id === itemId) {
      excludedBarangIds.add(item.barangId);
      return;
    }
    if (decision?.keputusan === "REJECTED") return;
    excludedBarangIds.add(item.barangId);
    const substitute = decision
      ? getEffectiveSubstitute(decision, item.barangId)
      : null;
    if (substitute) excludedBarangIds.add(substitute);
  });

  return allBarangs
    .filter((barang) => !excludedBarangIds.has(barang.id))
    .map((barang) => ({
      value: barang.id,
      label: barang.nama,
      subLabel: `${barang.kode} • ${barang.satuan}`,
    }));
}

/** Kalimat arah perubahan jumlah ("naik 2" / "turun 3"); null bila sama. */
export function describeQuantityChange(
  requested: number,
  approved: number,
  satuan: string,
): string | null {
  if (!Number.isFinite(approved) || approved === requested) return null;
  const difference = Math.abs(approved - requested);
  return approved > requested
    ? `Naik ${difference} ${satuan} dari yang diajukan`
    : `Turun ${difference} ${satuan} dari yang diajukan`;
}
