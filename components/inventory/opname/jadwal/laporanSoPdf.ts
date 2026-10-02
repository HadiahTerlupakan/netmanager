import {
  TAMPILAN_STATUS_SO,
  URUTAN_PRIORITAS_STATUS_SO,
  formatBulanSo,
  formatTanggalSo,
  keteranganJendelaSite,
  labelSoTerakhir,
  type LaporanKepatuhanSo,
} from "./jadwalSoTypes";

/** Kolom tabel gudang per site di PDF. */
export const KOLOM_LAPORAN_SO = ["Gudang", "Kode", "Status", "Barang dihitung (dalam jadwal)", "SO terakhir bulan ini"];

const MARGIN_KIRI = 14;
const Y_JUDUL = 15;
const Y_SUBJUDUL = 22;
const Y_RINGKASAN = 28;
const Y_SITE_PERTAMA = 38;
const JARAK_ANTAR_SITE = 10;
const JARAK_JUDUL_KE_TABEL = 7;
const JARAK_JUDUL_KE_KETERANGAN = 5;
const PENANDA_KOSONG = "-";
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

/** Susun seluruh teks PDF dari laporan kepatuhan SO satu bulan. */
export function susunIsiLaporanSoPdf(laporan: LaporanKepatuhanSo, dicetakPada: Date): IsiLaporanSoPdf {
  const ringkasan = URUTAN_PRIORITAS_STATUS_SO.map(
    (status) => `${TAMPILAN_STATUS_SO[status].label}: ${laporan.jumlahPerStatus[status] ?? 0}`,
  ).join("   ");
  const dicetak = formatTanggalSo(dicetakPada.toISOString());

  return {
    judul: `Laporan Stock Opname ${formatBulanSo(laporan.periode)}`,
    subjudul: `Dicetak ${dicetak}`,
    ringkasan,
    namaFile: `laporan-so_${laporan.periode}.pdf`,
    bagian: laporan.site.map((site) => ({
      judul: site.namaSite,
      keterangan: keteranganJendelaSite(site),
      baris: site.gudang.map((gudang) => [
        gudang.nama,
        gudang.kode,
        TAMPILAN_STATUS_SO[gudang.status].label,
        gudang.status === "TANPA_STOK"
          ? PENANDA_KOSONG
          : `${gudang.jumlahDihitungDalamJadwal}/${gudang.jumlahBarangBerstok}`,
        labelSoTerakhir(gudang.soTerakhir, PENANDA_KOSONG),
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
    doc.text(bagian.keterangan, MARGIN_KIRI, y + JARAK_JUDUL_KE_KETERANGAN);
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
