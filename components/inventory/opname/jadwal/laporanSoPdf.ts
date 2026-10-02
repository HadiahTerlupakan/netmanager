import {
  LABEL_KEADAAN,
  TAMPILAN_STATUS_SO,
  formatTanggalSo,
  labelJendela,
  type LaporanKepatuhanSo,
  type StatusSoGudang,
} from "./jadwalSoTypes";

/** Kolom tabel gudang per site di PDF. */
export const KOLOM_LAPORAN_SO = ["Gudang", "Kode", "Status", "Barang dihitung (dalam jadwal)", "SO terakhir bulan ini"];

const URUTAN_STATUS: StatusSoGudang[] = ["LENGKAP", "SEBAGIAN", "DI_LUAR_JADWAL", "BELUM", "TANPA_STOK"];
const MARGIN_KIRI = 14;
const Y_JUDUL = 15;
const Y_SUBJUDUL = 22;
const Y_RINGKASAN = 28;
const Y_SITE_PERTAMA = 38;
const JARAK_ANTAR_SITE = 10;
const JARAK_JUDUL_KE_TABEL = 7;
const BATAS_BAWAH_HALAMAN = 180;
const UKURAN_JUDUL = 14;
const UKURAN_SUBJUDUL_SITE = 11;
const UKURAN_TEKS = 9;
const UKURAN_TABEL = 8;
/** Lebar kolom tetap (mm) agar tabel antar-site sejajar; kolom terakhir mengisi sisa. */
const LEBAR_KOLOM = { 0: { cellWidth: 80 }, 1: { cellWidth: 35 }, 2: { cellWidth: 35 }, 3: { cellWidth: 55 } };
const WARNA_HEADER_TABEL: [number, number, number] = [79, 70, 229];

/** Satu bagian PDF: judul site dan baris tabel gudangnya. */
export interface BagianLaporanSoPdf {
  judul: string;
  keterangan: string;
  baris: string[][];
}

/** Isi PDF laporan SO yang sudah berbentuk teks (tanpa ketergantungan jsPDF). */
export interface IsiLaporanSoPdf {
  judul: string;
  subjudul: string;
  ringkasan: string;
  bagian: BagianLaporanSoPdf[];
  namaFile: string;
}

function labelBulan(periode: string): string {
  return new Date(`${periode}-01T00:00:00.000Z`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Susun seluruh teks PDF dari laporan kepatuhan SO satu bulan. */
export function susunIsiLaporanSoPdf(laporan: LaporanKepatuhanSo, dicetakPada: Date): IsiLaporanSoPdf {
  const ringkasan = URUTAN_STATUS.map(
    (status) => `${TAMPILAN_STATUS_SO[status].label}: ${laporan.jumlahPerStatus[status] ?? 0}`,
  ).join("   ");
  const dicetak = formatTanggalSo(dicetakPada.toISOString());

  return {
    judul: `Laporan Stock Opname ${labelBulan(laporan.periode)}`,
    subjudul: `Dicetak ${dicetak}`,
    ringkasan,
    namaFile: `laporan-so_${laporan.periode}.pdf`,
    bagian: laporan.site.map((site) => ({
      judul: site.namaSite,
      keterangan: `${labelJendela(site.jendela)} · ${LABEL_KEADAAN[site.keadaan]}${
        site.siteId && !site.isPengingatAktif ? " · Pengingat mati" : ""
      }`,
      baris: site.gudang.map((gudang) => [
        gudang.nama,
        gudang.kode,
        TAMPILAN_STATUS_SO[gudang.status].label,
        gudang.status === "TANPA_STOK"
          ? "-"
          : `${gudang.jumlahDihitungDalamJadwal}/${gudang.jumlahBarangBerstok}`,
        gudang.soTerakhir
          ? `${formatTanggalSo(gudang.soTerakhir.tanggal)}${gudang.soTerakhir.pic ? ` · ${gudang.soTerakhir.pic}` : ""}`
          : "-",
      ]),
    })),
  };
}

interface DokumenDenganTabel {
  lastAutoTable?: { finalY: number };
}

/** Buat dan unduh PDF laporan SO bulanan (landscape, satu tabel per site). */
export async function unduhLaporanSoPdf(laporan: LaporanKepatuhanSo): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const isi = susunIsiLaporanSoPdf(laporan, new Date());
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(UKURAN_JUDUL);
  doc.text(isi.judul, MARGIN_KIRI, Y_JUDUL);
  doc.setFontSize(UKURAN_TEKS);
  doc.text(isi.subjudul, MARGIN_KIRI, Y_SUBJUDUL);
  doc.text(isi.ringkasan, MARGIN_KIRI, Y_RINGKASAN);

  let y = Y_SITE_PERTAMA;
  for (const bagian of isi.bagian) {
    if (y > BATAS_BAWAH_HALAMAN) {
      doc.addPage();
      y = Y_JUDUL;
    }
    doc.setFontSize(UKURAN_SUBJUDUL_SITE);
    doc.text(bagian.judul, MARGIN_KIRI, y);
    doc.setFontSize(UKURAN_TEKS);
    doc.text(bagian.keterangan, MARGIN_KIRI, y + 5);
    autoTable(doc, {
      head: [KOLOM_LAPORAN_SO],
      body: bagian.baris,
      startY: y + JARAK_JUDUL_KE_TABEL,
      styles: { fontSize: UKURAN_TABEL },
      headStyles: { fillColor: WARNA_HEADER_TABEL },
      columnStyles: LEBAR_KOLOM,
      margin: { left: MARGIN_KIRI },
    });
    y = ((doc as unknown as DokumenDenganTabel).lastAutoTable?.finalY ?? y) + JARAK_ANTAR_SITE;
  }

  doc.save(isi.namaFile);
}
