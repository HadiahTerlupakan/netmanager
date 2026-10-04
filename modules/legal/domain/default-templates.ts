import type { LegalDocumentType } from "./entities/LegalDocument";
import type { TemplateBlock } from "./template-content";

/**
 * Template bawaan yang dibuat saat tenant pertama kali membuka daftar
 * template. Isinya kerangka umum — tenant diharapkan menyesuaikan pasal
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

export const DEFAULT_LEGAL_TEMPLATES: ReadonlyArray<{
  name: string;
  documentType: LegalDocumentType;
  content: TemplateBlock[];
}> = [
  {
    name: "PKS Reseller",
    documentType: "KONTRAK",
    content: [
      { type: "heading", text: "PERJANJIAN KERJA SAMA RESELLER" },
      { type: "paragraph", text: "Nomor: {{nomor}}" },
      ...PARTIES_INTRO,
      {
        type: "paragraph",
        text: "Para pihak sepakat mengadakan perjanjian kerja sama penjualan layanan internet dengan ketentuan sebagai berikut:",
      },
      {
        type: "article",
        title: "Ruang Lingkup",
        text: "PIHAK KEDUA memasarkan dan menjual layanan internet milik PIHAK PERTAMA kepada calon pelanggan di wilayah yang disepakati.",
      },
      {
        type: "article",
        title: "Jangka Waktu",
        text: "Perjanjian ini berlaku sejak {{tanggal_mulai}} sampai dengan {{tanggal_berakhir}} dan dapat diperpanjang atas kesepakatan para pihak.",
      },
      {
        type: "article",
        title: "Hak dan Kewajiban",
        text: "Hak dan kewajiban para pihak, termasuk skema komisi dan harga, mengikuti ketentuan yang berlaku dan disepakati para pihak.",
      },
      {
        type: "article",
        title: "Penyelesaian Perselisihan",
        text: "Perselisihan diselesaikan secara musyawarah. Bila tidak tercapai, para pihak sepakat menyelesaikannya melalui pengadilan negeri setempat.",
      },
      SIGNATURES,
    ],
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
