import type { LegalDocumentType } from "./entities/LegalDocument";
import type { TemplateBlock } from "./template-content";

/**
 * Template bawaan yang dibuat saat tenant pertama kali membuka daftar
 * template (dan, untuk yang bertanda `isSeededForExistingTenants`, juga di
 * tenant lama yang belum memilikinya). Isinya kerangka umum — tenant diharapkan menyesuaikan pasal
 * dengan kebutuhannya; bukan nasihat hukum.
 */

const SIGNATURES: TemplateBlock = {
  type: "signatures",
  left: { label: "PIHAK PERTAMA", name: "{{perusahaan.nama}}" },
  right: { label: "PIHAK KEDUA", name: "{{pihak.nama}}" },
};

const PARTIES_INTRO: TemplateBlock[] = [
  {
    type: "paragraph",
    text: "Pada hari ini, {{tanggal}}, yang bertanda tangan di bawah ini:",
  },
  {
    type: "list",
    items: [
      "**{{perusahaan.nama}}**, beralamat di {{perusahaan.alamat}}, selanjutnya disebut **PIHAK PERTAMA**;",
      "**{{pihak.nama}}**, beralamat di {{pihak.alamat}}, selanjutnya disebut **PIHAK KEDUA**.",
    ],
  },
];

/**
 * PKS Reseller model agen: PIHAK PERTAMA (ISP) menagih pelanggan atas
 * mereknya sendiri dan membukukan seluruh pendapatan, PIHAK KEDUA menerima
 * komisi. Memuat klausul wajib Permenkominfo 5/2021 Pasal 223 ayat (2).
 * Angka yang dinegosiasikan (persen komisi, tanggal, jam) sengaja dibiarkan
 * titik-titik supaya diisi saat dokumen dibuat.
 */
const PKS_RESELLER_CONTENT: TemplateBlock[] = [
  {
    type: "heading",
    text: "PERJANJIAN KERJA SAMA JUAL KEMBALI JASA AKSES INTERNET",
  },
  { type: "paragraph", text: "Nomor: {{nomor}}" },
  {
    type: "paragraph",
    text: "**Catatan: template ini kerangka acuan, bukan nasihat hukum. Wajib ditinjau konsultan hukum sebelum ditandatangani, lalu hapus catatan ini.**",
  },
  ...PARTIES_INTRO,
  {
    type: "paragraph",
    text: "PIHAK PERTAMA adalah penyelenggara jasa akses internet yang memiliki Perizinan Berusaha di bidang telekomunikasi. PIHAK KEDUA adalah pelaku usaha jual kembali jasa telekomunikasi yang memiliki Nomor Induk Berusaha dan Sertifikat Standar untuk KBLI jual kembali jasa telekomunikasi yang berlaku di sistem OSS.",
  },
  {
    type: "paragraph",
    text: "Perjanjian ini dibuat dengan memperhatikan Undang-Undang Nomor 36 Tahun 1999 tentang Telekomunikasi sebagaimana telah diubah dengan Undang-Undang Nomor 6 Tahun 2023, Peraturan Pemerintah Nomor 46 Tahun 2021 tentang Pos, Telekomunikasi, dan Penyiaran, Peraturan Menteri Komunikasi dan Informatika Nomor 5 Tahun 2021 tentang Penyelenggaraan Telekomunikasi, Peraturan Menteri Komunikasi dan Digital Nomor 15 Tahun 2025 tentang standar kegiatan usaha sektor pos, telekomunikasi, dan penyiaran, serta Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
  },
  {
    type: "paragraph",
    text: "Para pihak sepakat mengadakan perjanjian kerja sama jual kembali jasa akses internet dengan ketentuan sebagai berikut:",
  },
  {
    type: "article",
    title: "Ruang Lingkup",
    text: "(1) PIHAK KEDUA memasarkan dan menjual kembali layanan akses internet milik PIHAK PERTAMA kepada Pelanggan di wilayah yang disepakati dalam Lampiran.\n(2) Pelanggan adalah pelanggan PIHAK PERTAMA. PIHAK PERTAMA menerbitkan tagihan, menerima pembayaran, dan membukukan pendapatan; PIHAK KEDUA menerima komisi sesuai Perjanjian ini.\n(3) Paket, tarif, dan syarat berlangganan ditetapkan oleh PIHAK PERTAMA. PIHAK KEDUA tidak boleh menjual dengan harga atau syarat lain.",
  },
  {
    type: "article",
    title: "Jangka Waktu",
    text: "Perjanjian ini berlaku sejak {{tanggal_mulai}} sampai dengan {{tanggal_berakhir}} dan dapat diperpanjang atas kesepakatan tertulis para pihak paling lambat 30 (tiga puluh) hari sebelum berakhir.",
  },
  {
    type: "article",
    title: "Perizinan PIHAK KEDUA",
    text: "(1) PIHAK KEDUA wajib memiliki dan menjaga tetap berlaku Nomor Induk Berusaha, KBLI jual kembali jasa telekomunikasi yang berlaku di OSS, dan Sertifikat Standar jual kembali jasa telekomunikasi selama Perjanjian ini berlaku.\n(2) PIHAK KEDUA wajib menyerahkan salinan perizinan tersebut sebelum Perjanjian ditandatangani dan memberi tahu PIHAK PERTAMA secara tertulis paling lambat 7 (tujuh) hari setelah ada perubahan, pembekuan, atau pencabutan.\n(3) Bila perizinan PIHAK KEDUA dicabut, dibekukan, atau tidak berlaku, PIHAK PERTAMA berhak menghentikan sementara atau mengakhiri Perjanjian ini seketika.",
  },
  {
    type: "article",
    title: "Merek Dagang",
    text: "(1) Layanan dipasarkan dengan merek dagang PIHAK PERTAMA.\n(2) PIHAK KEDUA dapat menambahkan merek dagangnya sendiri (co-branding) dengan persetujuan tertulis PIHAK PERTAMA, dengan ketentuan merek PIHAK PERTAMA tetap tercantum dan tidak lebih kecil dari merek PIHAK KEDUA.\n(3) PIHAK KEDUA dilarang memakai merek PIHAK PERTAMA di luar keperluan Perjanjian ini.",
  },
  {
    type: "article",
    title: "Standar Kualitas Layanan",
    text: "(1) PIHAK KEDUA wajib memenuhi standar kualitas layanan yang dikomitmenkan PIHAK PERTAMA kepada Pelanggan sebagaimana tercantum dalam Lampiran tingkat layanan (SLA) Pelanggan.\n(2) PIHAK PERTAMA berhak memantau dan mengevaluasi kualitas layanan dan penanganan Pelanggan oleh PIHAK KEDUA secara berkala.",
  },
  {
    type: "article",
    title: "Pendapatan dan Penagihan",
    text: "(1) Seluruh pendapatan dari Pelanggan atas jual kembali layanan menjadi pendapatan dari dan dibukukan oleh PIHAK PERTAMA.\n(2) Tagihan kepada Pelanggan diterbitkan oleh PIHAK PERTAMA dan mencantumkan merek dagang PIHAK PERTAMA. PIHAK KEDUA dilarang menerbitkan tagihan sendiri kepada Pelanggan.\n(3) Pembayaran Pelanggan dilakukan ke rekening atau kanal pembayaran resmi PIHAK PERTAMA. Bila PIHAK KEDUA ditunjuk menerima pembayaran tunai, PIHAK KEDUA menerimanya atas nama PIHAK PERTAMA dan wajib menyetorkannya paling lambat 1 x 24 jam.",
  },
  {
    type: "article",
    title: "Komisi",
    text: "(1) Atas setiap tagihan Pelanggan yang telah lunas, PIHAK KEDUA berhak atas komisi sebesar ........% (........ persen) dari nilai tagihan sebelum Pajak Pertambahan Nilai (Dasar Pengenaan Pajak), kecuali ditetapkan lain dalam Lampiran.\n(2) Komisi dihitung per periode bulan kalender dan dituangkan dalam laporan rekapitulasi yang diterbitkan PIHAK PERTAMA paling lambat tanggal ........ bulan berikutnya.\n(3) PIHAK KEDUA dapat mengajukan keberatan atas rekapitulasi paling lambat 7 (tujuh) hari setelah diterima; setelah itu rekapitulasi dianggap disetujui.\n(4) PIHAK PERTAMA membayar komisi ke rekening PIHAK KEDUA paling lambat tanggal ........ bulan berikutnya, setelah dipotong pajak sesuai ketentuan peraturan perundang-undangan.\n(5) Tagihan yang dibatalkan atau dikembalikan dananya kepada Pelanggan tidak menghasilkan komisi; komisi yang terlanjur dibayar diperhitungkan pada periode berikutnya.",
  },
  {
    type: "article",
    title: "Alamat IP dan ASN",
    text: "(1) Layanan berbasis protokol internet menggunakan alamat IP publik dan Autonomous System Number (ASN) milik PIHAK PERTAMA.\n(2) PIHAK KEDUA dilarang memakai alamat IP publik atau ASN milik sendiri maupun pihak lain untuk layanan berdasarkan Perjanjian ini.\n(3) Alamat IP yang dialokasikan untuk layanan tetap milik PIHAK PERTAMA dan kembali kepada PIHAK PERTAMA saat Perjanjian berakhir.",
  },
  {
    type: "article",
    title: "Keberlangsungan Layanan",
    text: "(1) PIHAK PERTAMA menjamin keberlangsungan layanan kepada seluruh Pelanggan.\n(2) Bila kerja sama dihentikan sementara atau diakhiri karena sebab apa pun, layanan kepada Pelanggan tetap berjalan dan Pelanggan dilayani langsung oleh PIHAK PERTAMA atau pihak lain yang ditunjuk PIHAK PERTAMA, tanpa biaya tambahan bagi Pelanggan.\n(3) PIHAK KEDUA wajib menyerahkan data Pelanggan dan membantu proses pengalihan paling lambat 7 (tujuh) hari setelah penghentian atau pengakhiran.",
  },
  {
    type: "article",
    title: "Perlindungan Konsumen dan Penanganan Keluhan",
    text: "(1) PIHAK KEDUA wajib memberikan informasi paket, tarif, dan syarat berlangganan yang benar dan jelas kepada calon Pelanggan, serta memakai formulir dan syarat berlangganan PIHAK PERTAMA.\n(2) PIHAK KEDUA menjadi lini pertama penerimaan keluhan Pelanggan, mencatat setiap keluhan, dan menanggapinya paling lambat ........ jam sejak diterima.\n(3) Keluhan yang tidak selesai dalam ........ jam, atau yang menyangkut jaringan dan tagihan, wajib dieskalasi ke PIHAK PERTAMA. PIHAK PERTAMA menyelesaikannya sesuai standar penanganan keluhan PIHAK PERTAMA.\n(4) Pelanggan tetap dapat menghubungi kanal pengaduan resmi PIHAK PERTAMA secara langsung, dan kanal tersebut wajib diinformasikan PIHAK KEDUA kepada Pelanggan.",
  },
  {
    type: "article",
    title: "Data Pribadi Pelanggan",
    text: "(1) PIHAK PERTAMA adalah pengendali data pribadi Pelanggan. PIHAK KEDUA adalah prosesor data pribadi yang memproses data hanya untuk keperluan Perjanjian ini dan atas instruksi PIHAK PERTAMA, sesuai Undang-Undang Nomor 27 Tahun 2022.\n(2) PIHAK KEDUA wajib menjaga kerahasiaan dan keamanan data pribadi Pelanggan serta dilarang memakai atau mengungkapkannya untuk keperluan lain.\n(3) PIHAK KEDUA wajib memberi tahu PIHAK PERTAMA paling lambat 1 x 24 jam setelah mengetahui adanya kegagalan pelindungan data pribadi.\n(4) Saat Perjanjian berakhir, PIHAK KEDUA wajib mengembalikan atau memusnahkan data pribadi Pelanggan dan menyampaikan pernyataan tertulis.",
  },
  {
    type: "article",
    title: "Larangan Sub-Reseller",
    text: "(1) PIHAK KEDUA dilarang menunjuk pihak lain untuk menjual kembali layanan (sub-reseller), tanpa pengecualian.\n(2) PIHAK KEDUA dilarang mengalihkan hak serta kewajibannya berdasarkan Perjanjian ini kepada pihak lain tanpa persetujuan tertulis PIHAK PERTAMA.\n(3) Gerai/outlet PIHAK KEDUA yang terdaftar pada sistem PIHAK PERTAMA merupakan bagian dari PIHAK KEDUA, bukan sub-reseller. PIHAK KEDUA bertanggung jawab penuh atas tindakan gerai/outlet tersebut, termasuk penerimaan pembayaran tunai dan pelindungan data pribadi Pelanggan.",
  },
  {
    type: "article",
    title: "Sanksi dan Pengakhiran",
    text: "(1) Bila PIHAK KEDUA melanggar Perjanjian ini, PIHAK PERTAMA memberikan surat peringatan tertulis paling banyak 2 (dua) kali dengan tenggang waktu masing-masing 7 (tujuh) hari.\n(2) Selama peringatan belum dipenuhi, PIHAK PERTAMA berhak menangguhkan pembayaran komisi dan penambahan Pelanggan baru melalui PIHAK KEDUA.\n(3) PIHAK PERTAMA berhak mengakhiri Perjanjian bila peringatan kedua tidak dipenuhi, perizinan PIHAK KEDUA dicabut atau tidak berlaku, PIHAK KEDUA menagih Pelanggan sendiri, menunjuk sub-reseller, atau menyalahgunakan data pribadi Pelanggan.\n(4) PIHAK KEDUA berhak mengakhiri Perjanjian bila PIHAK PERTAMA tidak membayar komisi yang tidak disengketakan setelah diperingatkan secara tertulis 2 (dua) kali.\n(5) Masing-masing pihak dapat mengakhiri Perjanjian dengan pemberitahuan tertulis paling lambat 30 (tiga puluh) hari sebelumnya.\n(6) Pengakhiran tidak menghapus kewajiban yang telah timbul, termasuk komisi atas tagihan yang lunas sebelum tanggal pengakhiran dan kewajiban Pasal tentang Keberlangsungan Layanan dan Data Pribadi Pelanggan.",
  },
  {
    type: "article",
    title: "Penyelesaian Perselisihan",
    text: "Perselisihan diselesaikan secara musyawarah dalam 30 (tiga puluh) hari. Bila tidak tercapai, para pihak sepakat menyelesaikannya melalui Pengadilan Negeri di wilayah domisili PIHAK PERTAMA.",
  },
  {
    type: "article",
    title: "Penutup",
    text: "(1) Perubahan Perjanjian ini hanya sah bila dibuat secara tertulis dan ditandatangani para pihak.\n(2) Lampiran (wilayah, paket dan tarif, SLA Pelanggan, besaran komisi) merupakan bagian yang tidak terpisahkan dari Perjanjian ini.\n(3) Perjanjian ini dibuat dalam 2 (dua) rangkap bermeterai cukup dengan kekuatan hukum yang sama.",
  },
  SIGNATURES,
];

/** Nama template PKS Reseller model agen; dipakai juga oleh tes. */
export const PKS_RESELLER_TEMPLATE_NAME = "PKS Reseller (Model Agen)";

export interface DefaultLegalTemplate {
  name: string;
  documentType: LegalDocumentType;
  content: TemplateBlock[];
  /**
   * Template yang ditambahkan setelah tenant lama sudah di-seed. Bila tenant
   * belum punya template dengan nama ini, template dibuat di samping template
   * lamanya (tidak menimpa apa pun).
   */
  isSeededForExistingTenants?: boolean;
}

export const DEFAULT_LEGAL_TEMPLATES: ReadonlyArray<DefaultLegalTemplate> = [
  {
    name: PKS_RESELLER_TEMPLATE_NAME,
    documentType: "KONTRAK",
    content: PKS_RESELLER_CONTENT,
    isSeededForExistingTenants: true,
  },
  {
    name: "Kontrak Pelanggan Korporat",
    documentType: "KONTRAK",
    content: [
      { type: "heading", text: "PERJANJIAN BERLANGGANAN LAYANAN INTERNET" },
      { type: "paragraph", text: "Nomor: {{nomor}}" },
      ...PARTIES_INTRO,
      {
        type: "article",
        title: "Layanan",
        text: "PIHAK PERTAMA menyediakan layanan internet dedicated kepada PIHAK KEDUA sesuai spesifikasi dan tingkat layanan (SLA) yang disepakati.",
      },
      {
        type: "article",
        title: "Nilai dan Pembayaran",
        text: "Nilai layanan sebesar {{nilai}}, dibayarkan sesuai tagihan yang diterbitkan PIHAK PERTAMA.",
      },
      {
        type: "article",
        title: "Jangka Waktu",
        text: "Perjanjian berlaku sejak {{tanggal_mulai}} sampai dengan {{tanggal_berakhir}}.",
      },
      SIGNATURES,
    ],
  },
  {
    name: "Surat Kuasa",
    documentType: "KORPORAT",
    content: [
      { type: "heading", text: "SURAT KUASA" },
      { type: "paragraph", text: "Nomor: {{nomor}}" },
      {
        type: "paragraph",
        text: "Yang bertanda tangan di bawah ini, **{{perusahaan.nama}}**, beralamat di {{perusahaan.alamat}}, selanjutnya disebut **PEMBERI KUASA**, dengan ini memberi kuasa kepada:",
      },
      {
        type: "paragraph",
        text: "**{{pihak.nama}}**, beralamat di {{pihak.alamat}}, selanjutnya disebut **PENERIMA KUASA**.",
      },
      {
        type: "article",
        title: "Khusus",
        text: "Untuk dan atas nama PEMBERI KUASA mengurus {{judul}}.",
      },
      {
        type: "paragraph",
        text: "Surat kuasa ini berlaku sejak {{tanggal_mulai}} sampai dengan {{tanggal_berakhir}}.",
      },
      {
        type: "signatures",
        left: { label: "PEMBERI KUASA", name: "{{perusahaan.nama}}" },
        right: { label: "PENERIMA KUASA", name: "{{pihak.nama}}" },
      },
    ],
  },
];
