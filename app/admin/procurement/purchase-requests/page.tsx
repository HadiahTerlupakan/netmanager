import { ensurePermission } from "@/lib/rbac";
import { ProcurementPRListClient } from "./ProcurementPRListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase Request - Admin Portal",
};

/**
 * View Purchase Request dari sudut procurement.
 *
 * PR utamanya dibuat & lifecycle (approve/reject/process/receive) dijalankan
 * lewat modul `inventory/restock` (lihat `/admin/inventory/restock`).
 * Halaman ini menyediakan view read-only & action konsolidasi PR APPROVED → PO
 * untuk admin procurement, supaya tidak harus buka UI restock untuk lihat
 * apa saja yang siap dijadikan PO.
 */
export default async function PurchaseRequestListPage() {
  await ensurePermission("purchase_orders:read");
  return <ProcurementPRListClient />;
}
