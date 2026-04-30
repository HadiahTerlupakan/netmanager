const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const TOP_ITEMS_LIMIT = 10;
const CRITICAL_STATUS = "CRITICAL";

interface MonthlyData {
  tanggal: Date;
  _sum: { jumlah: number | null };
}

interface ActivityItem {
  barang?: { nama?: string; kode?: string };
  gudang?: { nama?: string };
  jumlah: number;
  user?: { name?: string };
  tanggal: Date;
}

interface TransferItem {
  barang?: { nama?: string; kode?: string };
  gudangDari?: { nama?: string };
  gudangKe?: { nama?: string };
  jumlah: number;
  createdBy?: { name?: string };
  tanggal: Date;
}

/** Hitung selisih hari dari waktu saat ini. */
export function calculateDaysSince(date: Date) {
  return Math.floor(
    (Date.now() - new Date(date).getTime()) / MILLISECONDS_PER_DAY,
  );
}

/** Inisialisasi bucket bulan untuk grafik tren. */
export function initializeMonthMap(input: {
  startDate: Date;
  endDate: Date;
  maxTrendMonths: number;
}) {
  const monthMap: Record<string, { masuk: number; keluar: number }> = {};
  const monthDiff =
    (input.endDate.getFullYear() - input.startDate.getFullYear()) * 12 +
    (input.endDate.getMonth() - input.startDate.getMonth()) +
    1;
  const totalMonths = Math.max(1, Math.min(monthDiff, input.maxTrendMonths));

  for (let index = 0; index < totalMonths; index += 1) {
    const currentDate = new Date(
      input.startDate.getFullYear(),
      input.startDate.getMonth() + index,
      1,
    );
    monthMap[formatMonthKey(currentDate)] = { masuk: 0, keluar: 0 };
  }

  return monthMap;
}

/** Akumulasi data group-by harian ke bucket bulanan. */
export function accumulateMonthlyData(
  monthMap: Record<string, { masuk: number; keluar: number }>,
  items: MonthlyData[],
  field: "masuk" | "keluar",
) {
  items.forEach((item) => {
    const key = formatMonthKey(new Date(item.tanggal));
    if (!monthMap[key]) {
      return;
    }

    monthMap[key][field] += item._sum.jumlah || 0;
  });
}

/** Format key bulan berbasis year-month. */
export function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Transformasi item slow moving ke response dashboard. */
export function buildSlowMovingItems(
  slowMovingData: Array<{
    id: string;
    kode: string;
    nama: string;
    barang_keluar: Array<{ tanggal: Date }>;
  }>,
) {
  return slowMovingData.map((barang) => {
    const lastMovement = barang.barang_keluar[0]?.tanggal || null;
    return {
      id: barang.id,
      kode: barang.kode,
      nama: barang.nama,
      lastMovement,
      daysSinceLastMove: lastMovement ? calculateDaysSince(lastMovement) : null,
    };
  });
}

/** Gabungkan aktivitas inventory terbaru lintas jenis transaksi. */
export function processRecentActivities(input: {
  masuk: ActivityItem[];
  keluar: ActivityItem[];
  transfer: TransferItem[];
  limit: number;
}) {
  const activities = [
    ...input.masuk.map((item) => mapActivity(item, "MASUK")),
    ...input.keluar.map((item) => mapActivity(item, "KELUAR")),
    ...input.transfer.map((item) => mapTransferActivity(item)),
  ];

  return activities
    .sort(
      (firstItem, secondItem) =>
        secondItem.timestamp.getTime() - firstItem.timestamp.getTime(),
    )
    .slice(0, input.limit);
}

/** Urutkan dan batasi alert stok terendah. */
export function sortStockAlerts<
  T extends { status: string; currentStock: number },
>(alerts: T[]) {
  return alerts
    .sort((firstAlert, secondAlert) => {
      if (
        firstAlert.status === CRITICAL_STATUS &&
        secondAlert.status !== CRITICAL_STATUS
      ) {
        return -1;
      }

      if (
        firstAlert.status !== CRITICAL_STATUS &&
        secondAlert.status === CRITICAL_STATUS
      ) {
        return 1;
      }

      return firstAlert.currentStock - secondAlert.currentStock;
    })
    .slice(0, TOP_ITEMS_LIMIT);
}

function mapActivity(item: ActivityItem, type: string) {
  return {
    type,
    barang: item.barang?.nama || "-",
    kode: item.barang?.kode || "-",
    gudang: item.gudang?.nama || "-",
    jumlah: item.jumlah,
    user: item.user?.name || "-",
    timestamp: item.tanggal,
  };
}

function mapTransferActivity(item: TransferItem) {
  return {
    type: "TRANSFER",
    barang: item.barang?.nama || "-",
    kode: item.barang?.kode || "-",
    gudang: `${item.gudangDari?.nama} → ${item.gudangKe?.nama}`,
    jumlah: item.jumlah,
    user: item.createdBy?.name || "-",
    timestamp: item.tanggal,
  };
}
