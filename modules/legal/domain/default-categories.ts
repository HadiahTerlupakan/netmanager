import type {
  LegalConfidentiality,
  LegalDocumentType,
} from "./entities/LegalDocument";

/**
 * Kategori yang dibuat otomatis saat tenant pertama kali membuka modul legal.
 * Tenant bebas menambah, mengganti nama, atau menonaktifkannya.
 */
export const DEFAULT_LEGAL_CATEGORIES: ReadonlyArray<{
  name: string;
  documentType: LegalDocumentType;
  confidentiality: LegalConfidentiality;
}> = [
  { name: "PKS Reseller", documentType: "KONTRAK", confidentiality: "BIASA" },
  { name: "PKS Mitra", documentType: "KONTRAK", confidentiality: "BIASA" },
  { name: "Kontrak Pelanggan Korporat", documentType: "KONTRAK", confidentiality: "BIASA" },
  { name: "Kontrak Vendor", documentType: "KONTRAK", confidentiality: "BIASA" },
  { name: "Perjanjian Upstream/Bandwidth", documentType: "KONTRAK", confidentiality: "BIASA" },
  { name: "NDA", documentType: "KONTRAK", confidentiality: "BIASA" },
  { name: "Sewa Lahan/Tower", documentType: "SEWA_LAHAN", confidentiality: "BIASA" },
  { name: "Izin Pemilik Gedung", documentType: "SEWA_LAHAN", confidentiality: "BIASA" },
  { name: "NIB", documentType: "IZIN", confidentiality: "BIASA" },
  { name: "Izin Penyelenggaraan (Komdigi)", documentType: "IZIN", confidentiality: "BIASA" },
  { name: "Izin Tiang/Galian Pemda", documentType: "IZIN", confidentiality: "BIASA" },
  { name: "PBG", documentType: "IZIN", confidentiality: "BIASA" },
  { name: "PSE", documentType: "IZIN", confidentiality: "BIASA" },
  { name: "Akta Perusahaan", documentType: "KORPORAT", confidentiality: "RAHASIA" },
  { name: "Notulen RUPS", documentType: "KORPORAT", confidentiality: "RAHASIA" },
  { name: "Surat Kuasa", documentType: "KORPORAT", confidentiality: "BIASA" },
];
