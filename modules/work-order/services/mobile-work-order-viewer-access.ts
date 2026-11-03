/**
 * Hubungan pembaca dengan work order pada detail mobile
 * (`GET /api/mobile/work-orders/[id]` → `viewerAccess`). Aplikasi memakainya
 * untuk memutuskan tombol yang tampil; server tetap menegakkan aksinya sendiri.
 *
 * - `PARTICIPANT`: teknisi pemegang, mitra pemegang, atau partner yang diundang
 *   (termasuk undangan yang belum dijawab).
 * - `CLAIMABLE`: bukan peserta, tetapi WO PENDING/REQUESTED lolos aturan daftar
 *   WO tersedia (atau pembaca super admin).
 * - `OBSERVER`: bukan peserta dan tidak bisa mengklaim, tetapi boleh melihat WO
 *   ini di panel web (`workorders:read` + lingkup site/departemen). Hanya baca.
 */
export const MOBILE_WORK_ORDER_VIEWER_ACCESS = {
  PARTICIPANT: "PARTICIPANT",
  CLAIMABLE: "CLAIMABLE",
  OBSERVER: "OBSERVER",
} as const;

export type MobileWorkOrderViewerAccess =
  (typeof MOBILE_WORK_ORDER_VIEWER_ACCESS)[keyof typeof MOBILE_WORK_ORDER_VIEWER_ACCESS];
