export type RestockSettingRecord = {
  id: string;
  tenantId: string | null;
  barangId: string;
  gudangId: string;
  minStok: number;
  maxStok: number;
  barang: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  gudang: {
    id: string;
    kode: string;
    nama: string;
  };
};
