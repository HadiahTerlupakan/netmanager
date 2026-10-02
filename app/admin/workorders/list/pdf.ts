import { format, formatDuration, intervalToDuration } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { apiFetcher } from "@/lib/hooks/useApi";
import { getWorkOrderCustomerInfo } from "@/modules/work-order/client";

import { WORK_ORDER_STATUS_LABELS } from "./constants";
import type { WorkOrder } from "./types";

/** Kolom PDF daftar work order (mengikuti tabel di layar). */
export const KOLOM_WORK_ORDER_PDF = [
  "No. WO",
  "Judul / Tipe",
  "Customer / Dept",
  "Site",
  "Status",
  "Prioritas",
  "Ditugaskan ke",
  "Dibuat",
  "Durasi",
  "Dibuat oleh",
];

/** Ukuran halaman saat mengambil semua WO untuk PDF. */
const UKURAN_HALAMAN_EKSPOR = 100;
/** Batas baris agar browser tidak kehabisan memori pada PDF yang sangat besar. */
export const BATAS_BARIS_PDF = 5000;
const MARGIN_KIRI = 10;
const Y_JUDUL = 14;
const Y_KETERANGAN = 20;
const JARAK_BARIS_KETERANGAN = 5;
const UKURAN_JUDUL = 14;
const UKURAN_KETERANGAN = 9;
const UKURAN_TABEL = 7;
const JARAK_SEL_TABEL = 1.5;
const WARNA_HEADER_TABEL: [number, number, number] = [79, 70, 229];
const FORMAT_WAKTU = "dd MMM yyyy HH:mm";

interface HalamanWorkOrder {
  workOrders?: WorkOrder[];
  total?: number;
  totalPages?: number;
}

function formatDurasi(wo: WorkOrder): string {
  if (!wo.startedAt || !wo.completedAt) return "-";
  const durasi = intervalToDuration({ start: new Date(wo.startedAt), end: new Date(wo.completedAt) });
  return formatDuration(durasi, { format: ["days", "hours", "minutes"], locale: localeId }) || "< 1 mnt";
}

function formatCustomer(wo: WorkOrder): string {
  const info = getWorkOrderCustomerInfo(wo);
  if (info.source === "internal") {
    return `${info.name || "Internal Request"}\n${wo.department?.name || "Internal / FOC"}`;
  }
  const nama = info.name || "-";
  return info.identifier ? `${nama}\n${info.identifier}` : nama;
}

function formatPenugasan(wo: WorkOrder): string {
  if (wo.assignedMitra) return `${wo.assignedMitra.name} (Mitra)`;
  if (wo.assignedTo) return `${wo.assignedTo.name} (${wo.assignedTo.role?.isTechnical ? "Teknis" : "Internal"})`;
  return "Unassigned";
}

/** Satu baris tabel PDF untuk sebuah work order. */
export function susunBarisWorkOrderPdf(wo: WorkOrder): string[] {
  return [
    wo.workOrderNumber,
    `${wo.title}\n${wo.type}`,
    formatCustomer(wo),
    wo.site?.name ?? "-",
    WORK_ORDER_STATUS_LABELS[wo.status] ?? wo.status,
    wo.priority,
    formatPenugasan(wo),
    format(new Date(wo.createdAt), FORMAT_WAKTU, { locale: localeId }),
    formatDurasi(wo),
    wo.createdBy?.name || "-",
  ];
}

/**
 * Ambil semua WO sesuai filter lewat endpoint daftar (RBAC & batas site tetap
 * berlaku), halaman demi halaman, maksimal {@link BATAS_BARIS_PDF}.
 */
export async function ambilSemuaWorkOrder(
  filterParams: URLSearchParams,
): Promise<{ workOrders: WorkOrder[]; total: number }> {
  const workOrders: WorkOrder[] = [];
  let total = 0;
  for (let page = 1; workOrders.length < BATAS_BARIS_PDF; page += 1) {
    const params = new URLSearchParams(filterParams);
    params.set("page", String(page));
    params.set("limit", String(UKURAN_HALAMAN_EKSPOR));
    const halaman = await apiFetcher<HalamanWorkOrder>(`/api/admin/workorders?${params}`);
    workOrders.push(...(halaman.workOrders ?? []));
    total = halaman.total ?? workOrders.length;
    if (page >= (halaman.totalPages ?? 1) || (halaman.workOrders ?? []).length === 0) break;
  }
  return { workOrders: workOrders.slice(0, BATAS_BARIS_PDF), total };
}

/** Buat dan unduh PDF daftar work order sesuai filter aktif. */
export async function unduhWorkOrderPdf(
  filterParams: URLSearchParams,
  keteranganFilter: string[],
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }, hasil] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    ambilSemuaWorkOrder(filterParams),
  ]);
  const sekarang = new Date();
  const jumlah =
    hasil.total > hasil.workOrders.length
      ? `${hasil.workOrders.length} dari ${hasil.total} work order (dibatasi ${BATAS_BARIS_PDF})`
      : `${hasil.workOrders.length} work order`;
  const keterangan = [
    `Dicetak ${format(sekarang, FORMAT_WAKTU, { locale: localeId })} · ${jumlah}`,
    `Filter: ${keteranganFilter.length > 0 ? keteranganFilter.join(" · ") : "Semua work order"}`,
  ];

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(UKURAN_JUDUL);
  doc.text("Daftar Work Order", MARGIN_KIRI, Y_JUDUL);
  doc.setFontSize(UKURAN_KETERANGAN);
  keterangan.forEach((baris, i) => doc.text(baris, MARGIN_KIRI, Y_KETERANGAN + i * JARAK_BARIS_KETERANGAN));

  autoTable(doc, {
    head: [KOLOM_WORK_ORDER_PDF],
    body: hasil.workOrders.map(susunBarisWorkOrderPdf),
    startY: Y_KETERANGAN + keterangan.length * JARAK_BARIS_KETERANGAN,
    margin: { left: MARGIN_KIRI, right: MARGIN_KIRI },
    styles: { fontSize: UKURAN_TABEL, cellPadding: JARAK_SEL_TABEL },
    headStyles: { fillColor: WARNA_HEADER_TABEL },
  });

  doc.save(`work-order_${format(sekarang, "yyyy-MM-dd")}.pdf`);
}
