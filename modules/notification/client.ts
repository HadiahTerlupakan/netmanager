/**
 * Public API modul notification untuk komponen klien.
 *
 * Hanya berisi tipe, konstanta, dan fungsi murni — TIDAK meng-export service
 * atau repository, sehingga aman diimpor dari client component tanpa menarik
 * Prisma ke bundle browser.
 *
 * Client component: `import { ... } from "@/modules/notification/client"`
 * Server/API route: `import { ... } from "@/modules/notification"` (barrel penuh)
 */

export {
  hitungStatusTayang,
  tanggalKeEpoch,
  LABEL_STATUS_TAYANG,
  STATUS_TAYANG,
  type PeriodeTayang,
  type StatusTayang,
} from "./domain/status-tayang";
