/**
 * Dari mana barang yang dikembalikan itu berasal.
 *
 * Dua perpindahan yang berbeda dulu memakai satu jalur yang sama, dan karena
 * itu tidak ada satu pun yang bisa dibatasi: sisa material punya batas alami
 * (tidak mungkin mengembalikan lebih dari yang diambil), sedangkan perangkat
 * yang ditarik dari pelanggan tidak pernah keluar dari gudang sehingga tidak
 * punya pembanding. Memisahkannya membuat yang pertama bisa dikunci ketat.
 */
export type AsalPengembalian = "SISA_MATERIAL" | "TARIKAN_PELANGGAN";

export interface MobileWorkOrderMaterialReturnInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: "BARU" | "BEKAS" | "RUSAK";
  /** Default `SISA_MATERIAL`: jalur yang dibatasi jumlah pengambilan. */
  asal?: AsalPengembalian;
}

export interface MobileWorkOrderMaterialReturnResult {
  id: string;
  nama: string;
  jumlah: number;
  satuan: string;
  kondisi: string;
  barangId: string;
  gudangId: string;
  /**
   * Ikut disimpan ke `work_orders.returnedMaterials` karena perhitungan jatah
   * sisa material membaca riwayat itu: tanpa penanda ini, tarikan pelanggan
   * akan ikut memotong jatah pengembalian sisa.
   */
  asal: AsalPengembalian;
}
