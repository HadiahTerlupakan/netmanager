export interface MitraIdCardDTO {
  id: string;
  name: string | null;
  mitraType: "MITRA_TEKNISI" | "MITRA_SALES";
  nik: string | null;
  fotoDiri: string | null;
  phone: string | null;
  createdAt: string;
  sites: { name: string } | null;
}
