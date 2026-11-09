/** Semua teks halaman daftar belanja publik, dalam bahasa awam. */
export const BELANJA_TEXTS = {
  title: "Daftar Belanja",
  subtitle: (requestNumber: string, warehouseName: string) =>
    `Pengajuan ${requestNumber} · untuk ${warehouseName}`,
  instructions:
    "Centang barang yang sudah Anda beli di satu toko, isi jumlahnya, lalu tanda tangan di bawah. Kalau belanja di beberapa toko, simpan satu per satu untuk tiap toko.",
  loading: "Memuat daftar belanja…",
  itemSummary: (
    needed: number,
    purchased: number,
    remaining: number,
    unit: string,
  ) =>
    `Butuh ${needed}${unit ? ` ${unit}` : ""} · Sudah dibeli ${purchased} · Sisa ${remaining}`,
  itemDone: "Sudah dibeli semua",
  storeBreakdown: (
    storeName: string,
    date: string,
    quantity: number,
    unit: string,
  ) => `Dibeli di ${storeName}, ${date}: ${quantity}${unit ? ` ${unit}` : ""}`,
  itemsLegend: "Barang yang dibeli",
  quantityLabel: "Jumlah yang dibeli",
  quantityHint: (remaining: number) => `Paling banyak ${remaining}`,
  priceLabel: "Harga satuan (boleh kosong)",
  priceHint: "Contoh: 12000",
  storeLabel: "Nama toko",
  storePlaceholder: "Contoh: Toko Sinar Jaya",
  dateLabel: "Tanggal belanja",
  notesLabel: "Catatan (boleh kosong)",
  buyerLabel: "Nama Anda (yang belanja)",
  buyerHint: "Nama ini dicetak di laporan barang datang.",
  signatureLabel: "Tanda tangan",
  signatureHint:
    "Tanda tangan dengan jari di layar HP, atau dengan mouse di komputer.",
  submit: "Simpan belanja",
  submitting: "Menyimpan…",
  problemsTitle: "Belum bisa disimpan:",
  problems: {
    noItem: "Centang dulu barang yang Anda beli.",
    noStore: "Isi nama toko.",
    noBuyer: "Isi nama Anda.",
    noSignature: "Tanda tangan dulu di kotak tanda tangan.",
    noDate: "Isi tanggal belanja.",
    futureDate: "Tanggal belanja tidak boleh setelah hari ini.",
    tooMany: (name: string, remaining: number) =>
      `Jumlah ${name} paling banyak ${remaining}.`,
    tooFew: (name: string) => `Jumlah ${name} minimal 1.`,
    badPrice: (name: string) =>
      `Harga ${name} tidak terbaca. Tulis angka saja, contoh 12000.`,
    priceTooHigh: (name: string) =>
      `Harga ${name} terlalu besar. Periksa lagi angkanya.`,
  },
  saved: (buyerName: string) => `Tersimpan. Terima kasih, ${buyerName}.`,
  allPurchasedTitle: "Semua barang sudah dibeli",
  allPurchasedBody:
    "Terima kasih. Tidak ada lagi yang perlu dibeli dari daftar ini.",
  inactiveTitle: "Link ini sudah tidak berlaku",
  inactiveBody:
    "Mungkin barangnya sudah datang semua, belanjanya dibatalkan, atau link-nya sudah diganti. Kalau masih perlu belanja, minta link baru ke admin gudang.",
  errorTitle: "Daftar belanja belum bisa dibuka",
  offline:
    "Tidak tersambung ke internet. Isian Anda masih ada, coba kirim lagi.",
  offlineLoad: "Tidak tersambung ke internet. Periksa sinyal, lalu coba lagi.",
  serverError: "Ada gangguan. Coba lagi sebentar lagi.",
  retry: "Coba lagi",
} as const;
