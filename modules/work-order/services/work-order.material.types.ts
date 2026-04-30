export interface MobileWorkOrderMaterialReturnInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: "BARU" | "BEKAS" | "RUSAK";
}

export interface MobileWorkOrderMaterialReturnResult {
  id: string;
  nama: string;
  jumlah: number;
  satuan: string;
  kondisi: string;
  barangId: string;
  gudangId: string;
}
