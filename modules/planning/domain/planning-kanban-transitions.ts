import type { PlanningStatus } from "./entities/PlanningEntity";

export interface KanbanTransition {
  /** Segmen endpoint di `/api/planning/[id]/<endpoint>`. */
  endpoint: "submit" | "start" | "complete";
  /** Kalimat konfirmasi yang ditampilkan setelah aksi berhasil. */
  label: string;
}

/**
 * Transisi yang boleh dipicu dengan menyeret kartu di papan kanban.
 *
 * Hanya transisi yang TIDAK memerlukan masukan tambahan yang masuk daftar ini.
 * Persetujuan dan penolakan sengaja dikecualikan: persetujuan adalah keputusan
 * kendali atas belanja infrastruktur — satu selip tetikus tidak boleh cukup
 * untuk menyetujuinya — dan penolakan wajib disertai alasan yang tidak mungkin
 * diisi lewat gestur seret. Keduanya tetap melalui tombol dan dialog di halaman
 * detail.
 */
const DRAGGABLE_TRANSITIONS: Record<string, KanbanTransition> = {
  "BACKLOG→PENDING_APPROVAL": {
    endpoint: "submit",
    label: "Rencana diajukan untuk persetujuan",
  },
  "REJECTED→PENDING_APPROVAL": {
    endpoint: "submit",
    label: "Rencana diajukan ulang",
  },
  "APPROVED→IN_PROGRESS": {
    endpoint: "start",
    label: "Pengerjaan dimulai",
  },
  "IN_PROGRESS→COMPLETED": {
    endpoint: "complete",
    label: "Rencana ditandai selesai",
  },
};

/**
 * Menentukan aksi yang dijalankan bila kartu berstatus `from` dijatuhkan ke
 * kolom `to`, atau null bila perpindahan itu tidak sah.
 */
export function resolveKanbanTransition(
  from: PlanningStatus,
  to: PlanningStatus,
): KanbanTransition | null {
  if (from === to) {
    return null;
  }

  return DRAGGABLE_TRANSITIONS[`${from}→${to}`] ?? null;
}
