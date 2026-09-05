/**
 * Cross-module cache invalidation helpers.
 *
 * Setiap mutation yang mempengaruhi data lintas-module wajib panggil
 * helper yang sesuai supaya cache di module lain tetap fresh tanpa
 * user perlu reload halaman.
 *
 * Pattern: keyword "invalidate" cocok jadi prefix nama. Setiap helper
 * mengembalikan callback void supaya bisa langsung dipanggil di
 * `onSettled` mutation.
 *
 * Lihat `docs/guides/tanstack-adoption-roadmap.md` Phase 2 untuk
 * daftar 5 cross-module invalidation flow yang ditangani di file ini.
 */

import { useQueryClient } from "@tanstack/react-query";

/**
 * Invalidate cache untuk seluruh resource yang dipengaruhi customer
 * mutation (create / update / delete / status change).
 *
 * Module yang refresh: dashboard admin, billing list, attendance
 * (kalau customer juga karyawan portal customer).
 */
export function useInvalidateCustomerRelated() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pelanggan-ppp"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customer/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tagihan"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/stats"] });
  };
}

/**
 * Invalidate cache setelah invoice payment (manual atau gateway).
 *
 * Module yang refresh: customer detail (status pembayaran), revenue
 * chart finance, riwayat transaksi payment gateway.
 */
export function useInvalidateInvoicePaymentRelated() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/pelanggan-ppp"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tagihan"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customer/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/stats"] });
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/payment-gateway/configs"],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/manual-payments"],
    });
  };
}

/**
 * Invalidate cache setelah work-order status berubah ke DONE / CANCELLED.
 *
 * Module yang refresh: dashboard KPI cards, work order list, inventory
 * (material yang dipakai), salary (incentive WO).
 */
export function useInvalidateWorkOrderRelated() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/workorders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/barang"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/salary/users"] });
  };
}

/**
 * Invalidate cache setelah attendance check-in / check-out.
 *
 * Module yang refresh: live map (real-time location), payroll preview
 * (perhitungan gaji), dashboard active employee count, attendance
 * analytics.
 */
export function useInvalidateAttendanceRelated() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/location/live"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance/history"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance/analytics"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/salary/users"] });
  };
}

/**
 * Invalidate cache setelah inventory transfer / masuk / keluar / opname.
 *
 * Module yang refresh: inventory dashboard, barang list, gudang
 * stock, work order materials (jika WO terkait).
 */
export function useInvalidateInventoryRelated() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/barang"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/gudang"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/opname"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/workorders"] });
  };
}

/**
 * Invalidate seluruh cache modul planning setelah mutasi apa pun.
 *
 * Memakai `predicate`, bukan `queryKey`, dengan alasan konkret: query key di
 * `useApi` adalah URL lengkap berikut query string-nya (`["/api/planning?page=1
 * &limit=20"]`). Filter `queryKey: ["/api/planning"]` mencocokkan elemen array
 * secara persis, sehingga tidak pernah cocok dengan key berparameter — daftar,
 * dashboard, dan kanban tetap menampilkan data lama sampai `staleTime` 30 detik
 * lewat. Gejalanya: menghapus rencana dari halaman detail melempar pengguna ke
 * daftar yang masih memuat rencana yang baru saja dihapus, dan mengkliknya
 * memunculkan "Planning tidak ditemukan".
 *
 * Pencocokan awalan menutup seluruh permukaan modul sekaligus: daftar, detail,
 * item, milestone, kanban, dashboard, dan template.
 */
export function useInvalidatePlanningRelated() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const [key] = query.queryKey;
        return typeof key === "string" && key.startsWith("/api/planning");
      },
    });
  };
}
