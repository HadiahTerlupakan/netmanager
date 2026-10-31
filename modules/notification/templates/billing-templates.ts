export interface BillingTemplateParams {
  customerName: string;
  invoiceNumber?: string;
  amountDue?: number;
  dueDate?: string;
  packageName?: string;
  username?: string;
  reminderType?: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
  /** Nomor tagihan yang dibatalkan dan digantikan tagihan ini. */
  replacesInvoiceNumber?: string;
}

export interface EmailContent {
  subject: string;
  /** Plain text body — kirim sebagai parameter `text` ke transporter agar newline preserved. */
  body: string;
  /** Opsional HTML body. Kalau diisi, override rendering plain text. */
  html?: string;
}

export interface BillingTemplate {
  title: string;
  inApp: (p: BillingTemplateParams) => string;
  whatsapp: (p: BillingTemplateParams) => string;
  email: (p: BillingTemplateParams) => EmailContent;
  push: (p: BillingTemplateParams) => string;
}

/** Format angka ke format Rupiah Indonesia. */
const formatRupiah = (n: number | undefined): string =>
  `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/**
 * Jatuh tempo dikirim sebagai timestamp ISO; pelanggan dulu membaca
 * "2026-10-28T01:02:01.521Z". Teks yang bukan tanggal dibiarkan apa adanya.
 */
const formatJatuhTempo = (dueDate: string | undefined): string => {
  if (!dueDate) return "";
  const tanggal = new Date(dueDate);
  return Number.isNaN(tanggal.getTime())
    ? dueDate
    : FORMAT_TANGGAL.format(tanggal);
};

/** " (INV-001, Rp 150.000)" bila tagihan tunggakannya diketahui. */
const formatTunggakan = (p: BillingTemplateParams): string =>
  p.invoiceNumber ? ` (${p.invoiceNumber}, ${formatRupiah(p.amountDue)})` : "";

/** "Tagihan jatuh tempo 1 Nov 2026", atau "Tagihan Anda" tanpa jatuh tempo. */
const formatTagihanSiklus = (p: BillingTemplateParams): string =>
  p.dueDate
    ? `Tagihan jatuh tempo ${formatJatuhTempo(p.dueDate)}`
    : "Tagihan Anda";

/**
 * Tagihan siklus yang diterbitkan ulang setelah paket siklusnya berubah atau
 * perubahannya dibatalkan. Tanpa template ini pelanggan menerima dua "Tagihan
 * baru dibuat" untuk siklus yang sama dan tidak tahu yang pertama sudah batal.
 * `describeChange` melanjutkan "Tagihan jatuh tempo ..." dengan nominal baru.
 */
function buildInvoiceReplacedTemplate(
  describeChange: (amount: string) => string,
): BillingTemplate {
  const summarize = (p: BillingTemplateParams) =>
    `${formatTagihanSiklus(p)} ${describeChange(formatRupiah(p.amountDue))}`;
  const detail = (p: BillingTemplateParams) =>
    `Halo ${p.customerName},\n\n${summarize(p)}.${p.invoiceNumber ? `\nNomor: ${p.invoiceNumber}` : ""}\nJumlah: ${formatRupiah(p.amountDue)}${p.replacesInvoiceNumber ? `\nMenggantikan: ${p.replacesInvoiceNumber}` : ""}\n\nTagihan ${p.replacesInvoiceNumber ?? "sebelumnya"} tidak perlu dibayar.`;

  return {
    title: "Tagihan diperbarui",
    inApp: (p) =>
      `${summarize(p)}${p.replacesInvoiceNumber ? ` (menggantikan ${p.replacesInvoiceNumber})` : ""}.`,
    whatsapp: detail,
    email: (p) => ({
      subject: `Tagihan diperbarui - ${formatRupiah(p.amountDue)}`,
      body: detail(p),
    }),
    push: summarize,
  };
}

/**
 * Registry template notifikasi billing.
 * Setiap key mewakili satu event lifecycle billing/pelanggan.
 */
export const BILLING_TEMPLATES = {
  customerWelcome: {
    title: "Selamat datang",
    inApp: (p) =>
      `Halo ${p.customerName}, akun PPPoE Anda telah aktif${p.username ? `. Username: ${p.username}` : ""}.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nSelamat! Akun PPPoE Anda telah aktif.${p.username ? `\n\nUsername: ${p.username}` : ""}${p.packageName ? `\nPaket: ${p.packageName}` : ""}\n\nHubungi admin jika butuh bantuan setup.`,
    email: (p) => ({
      subject: "Akun PPPoE Anda telah aktif",
      body: `Halo ${p.customerName},\n\nSelamat datang. Akun Anda:${p.username ? `\n- Username: ${p.username}` : ""}${p.packageName ? `\n- Paket: ${p.packageName}` : ""}\n\nTerima kasih.`,
    }),
    push: (p) =>
      p.username
        ? `Akun PPPoE ${p.username} telah aktif`
        : "Akun Anda telah aktif",
  },
  invoiceCreated: {
    title: "Tagihan baru dibuat",
    inApp: (p) =>
      `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} sebesar ${formatRupiah(p.amountDue)} telah dibuat${p.dueDate ? `. Jatuh tempo ${formatJatuhTempo(p.dueDate)}` : ""}.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nTagihan baru:${p.invoiceNumber ? `\nNomor: ${p.invoiceNumber}` : ""}\nJumlah: ${formatRupiah(p.amountDue)}${p.dueDate ? `\nJatuh tempo: ${formatJatuhTempo(p.dueDate)}` : ""}\n\nSilakan bayar sebelum jatuh tempo.`,
    email: (p) => ({
      subject: `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} - ${formatRupiah(p.amountDue)}`,
      body: `Halo ${p.customerName},\n\nTagihan baru telah dibuat.\nJumlah: ${formatRupiah(p.amountDue)}${p.dueDate ? `\nJatuh tempo: ${formatJatuhTempo(p.dueDate)}` : ""}`,
    }),
    push: (p) =>
      `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""}: ${formatRupiah(p.amountDue)}`,
  },
  invoiceRepriced: buildInvoiceReplacedTemplate(
    (amount) => `diperbarui ke ${amount} mengikuti perubahan paket`,
  ),
  invoiceRepriceReverted: buildInvoiceReplacedTemplate(
    (amount) => `dikembalikan ke ${amount} karena perubahan paket dibatalkan`,
  ),
  invoiceReminder: {
    title: "Pengingat tagihan",
    inApp: (p) =>
      `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} (${formatRupiah(p.amountDue)}) ${p.reminderType === "OVERDUE" ? "sudah lewat jatuh tempo" : `akan jatuh tempo ${formatJatuhTempo(p.dueDate)}`}.`,
    whatsapp: (p) => {
      const head =
        p.reminderType === "OVERDUE"
          ? "Tagihan Anda sudah lewat jatuh tempo."
          : p.reminderType === "DUE_TODAY"
            ? "Tagihan Anda jatuh tempo hari ini."
            : "Pengingat tagihan Anda.";
      return `Halo ${p.customerName},\n\n${head}\n${p.invoiceNumber ?? "Tagihan"} - ${formatRupiah(p.amountDue)}${p.dueDate ? `\nJatuh tempo: ${formatJatuhTempo(p.dueDate)}` : ""}\n\nAbaikan jika sudah membayar.`;
    },
    email: (p) => ({
      subject: `Reminder: ${p.invoiceNumber ?? "tagihan"}`,
      body: `Tagihan ${p.invoiceNumber ?? ""} sebesar ${formatRupiah(p.amountDue)} ${p.reminderType === "OVERDUE" ? "sudah lewat jatuh tempo" : `akan jatuh tempo ${formatJatuhTempo(p.dueDate)}`}.`,
    }),
    push: (p) =>
      `Reminder: ${p.invoiceNumber ?? "tagihan"} ${p.reminderType === "OVERDUE" ? "lewat" : formatJatuhTempo(p.dueDate)}`,
  },
  invoicePaid: {
    title: "Pembayaran berhasil",
    inApp: (p) =>
      `Pembayaran${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} sebesar ${formatRupiah(p.amountDue)} berhasil. Terima kasih.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nPembayaran Anda telah kami terima:${p.invoiceNumber ? `\n${p.invoiceNumber}` : ""} - ${formatRupiah(p.amountDue)}\n\nLayanan akan aktif segera. Terima kasih.`,
    email: (p) => ({
      subject: `Pembayaran${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} berhasil`,
      body: `Halo ${p.customerName},\n\nPembayaran Anda sebesar ${formatRupiah(p.amountDue)} telah diterima.\n\nTerima kasih.`,
    }),
    push: (p) =>
      `Pembayaran${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} berhasil`,
  },
  paymentExpired: {
    title: "Waktu pembayaran habis",
    inApp: (p) =>
      `Pembayaran${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} sebesar ${formatRupiah(p.amountDue)} belum selesai dan batas waktunya habis. Silakan bayar lagi lewat menu Tagihan.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nBatas waktu pembayaran${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} (${formatRupiah(p.amountDue)}) sudah habis. Silakan bayar lagi lewat menu Tagihan di portal pelanggan.`,
    email: (p) => ({
      subject: `Waktu pembayaran${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} habis`,
      body: `Halo ${p.customerName},\n\nPembayaran sebesar ${formatRupiah(p.amountDue)} belum selesai dan batas waktunya habis. Silakan bayar lagi lewat portal pelanggan.`,
    }),
    push: (p) =>
      `Waktu bayar${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} habis, silakan bayar lagi`,
  },
  overpaymentCredited: {
    title: "Kelebihan bayar menjadi saldo",
    inApp: (p) =>
      `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} terbayar lebih dari sekali. Kelebihan ${formatRupiah(p.amountDue)} kami simpan sebagai saldo dan otomatis memotong tagihan berikutnya.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nTagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} terbayar lebih dari sekali. Kelebihan ${formatRupiah(p.amountDue)} kami simpan sebagai saldo dan otomatis memotong tagihan berikutnya.\n\nHubungi kami bila Anda ingin dana tersebut dikembalikan.`,
    email: (p) => ({
      subject: "Kelebihan bayar disimpan sebagai saldo",
      body: `Halo ${p.customerName},\n\nTagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} terbayar lebih dari sekali. Kelebihan ${formatRupiah(p.amountDue)} kami simpan sebagai saldo dan otomatis memotong tagihan berikutnya.\n\nHubungi kami bila Anda ingin dana tersebut dikembalikan.`,
    }),
    push: (p) => `Kelebihan bayar ${formatRupiah(p.amountDue)} menjadi saldo`,
  },
  // Hanya untuk isolir yang memang karena tagihan lewat jatuh tempo; isolir
  // tanpa tunggakan memakai `customerIsolatedByAdmin`.
  customerIsolated: {
    title: "Layanan diisolir",
    inApp: (p) =>
      `Layanan internet Anda diisolir karena tunggakan${formatTunggakan(p)}. Silakan bayar tagihan untuk mengaktifkannya kembali.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda diisolir karena tunggakan.${p.invoiceNumber ? `\n\nTagihan: ${p.invoiceNumber}\nJumlah: ${formatRupiah(p.amountDue)}` : ""}\n\nSilakan bayar untuk mengaktifkannya kembali.`,
    email: (p) => ({
      subject: "Layanan diisolir - butuh pembayaran",
      body: `Halo ${p.customerName},\n\nLayanan internet Anda diisolir karena tunggakan${formatTunggakan(p)}.\n\nSilakan bayar tagihan untuk mengaktifkannya kembali.`,
    }),
    push: () => "Layanan Anda diisolir karena tunggakan",
  },
  customerIsolatedByAdmin: {
    title: "Layanan diisolir",
    inApp: () =>
      "Layanan internet Anda diisolir oleh admin. Hubungi customer service untuk informasi lebih lanjut.",
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda saat ini diisolir oleh admin.\nHubungi customer service kami untuk informasi lebih lanjut.`,
    email: (p) => ({
      subject: "Layanan Anda diisolir",
      body: `Halo ${p.customerName},\n\nLayanan internet Anda saat ini diisolir oleh admin.\nHubungi customer service kami untuk informasi lebih lanjut.`,
    }),
    push: () => "Layanan Anda diisolir oleh admin",
  },
  // Netral: aktivasi juga datang dari admin, bukan hanya dari pelunasan, dan
  // pelunasan sudah punya notifikasi `invoicePaid` sendiri.
  customerActivated: {
    title: "Layanan aktif kembali",
    inApp: () => "Layanan internet Anda sudah aktif kembali.",
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda sudah aktif kembali.\nHubungi kami bila masih ada kendala.`,
    email: (p) => ({
      subject: "Layanan aktif kembali",
      body: `Halo ${p.customerName},\n\nLayanan internet Anda sudah aktif kembali.`,
    }),
    push: () => "Layanan Anda aktif kembali",
  },
  customerDeactivated: {
    title: "Layanan dinonaktifkan",
    inApp: () =>
      "Layanan internet Anda sedang dinonaktifkan. Hubungi customer service untuk informasi lebih lanjut.",
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda sedang dinonaktifkan.\nHubungi customer service kami untuk informasi lebih lanjut.`,
    email: (p) => ({
      subject: "Layanan Anda dinonaktifkan",
      body: `Halo ${p.customerName},\n\nLayanan internet Anda sedang dinonaktifkan.\nHubungi customer service kami untuk informasi lebih lanjut.`,
    }),
    push: () => "Layanan Anda dinonaktifkan",
  },
  customerMaintenance: {
    title: "Layanan dalam pemeliharaan",
    inApp: () =>
      "Layanan internet Anda sedang dalam pemeliharaan oleh teknisi kami. Kami akan memberi tahu Anda begitu layanan aktif kembali.",
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda sedang dalam pemeliharaan oleh teknisi kami.\nKami akan memberi tahu Anda begitu layanan aktif kembali.`,
    email: (p) => ({
      subject: "Layanan Anda dalam pemeliharaan",
      body: `Halo ${p.customerName},\n\nLayanan internet Anda sedang dalam pemeliharaan oleh teknisi kami.\nKami akan memberi tahu Anda begitu layanan aktif kembali.`,
    }),
    push: () => "Layanan Anda dalam pemeliharaan",
  },
  // Kalimat inti sama dengan pesan login/refresh untuk pelanggan DISMANTLE
  // (`CUSTOMER_DISMANTLED_MESSAGE` di lib/customer-portal-access.ts).
  customerDismantled: {
    title: "Langganan berakhir",
    inApp: () =>
      "Layanan Anda sudah berhenti berlangganan. Hubungi admin bila ini keliru.",
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda sudah berhenti berlangganan, dan akses ke aplikasi pelanggan ditutup.\nHubungi admin bila ini keliru. Terima kasih telah berlangganan.`,
    email: (p) => ({
      subject: "Langganan Anda berakhir",
      body: `Halo ${p.customerName},\n\nLayanan internet Anda sudah berhenti berlangganan, dan akses ke aplikasi pelanggan ditutup.\nHubungi admin bila ini keliru. Terima kasih telah berlangganan.`,
    }),
    push: () => "Layanan Anda sudah berhenti berlangganan",
  },
  packageChanged: {
    title: "Paket internet berubah",
    inApp: (p) =>
      `Paket internet Anda telah diubah${p.packageName ? ` ke ${p.packageName}` : ""}. Perubahan berlaku segera.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nPaket internet Anda telah diubah${p.packageName ? ` ke ${p.packageName}` : ""}.\nPerubahan berlaku segera. Hubungi kami jika ada pertanyaan.`,
    email: (p) => ({
      subject: "Paket internet Anda telah diubah",
      body: `Halo ${p.customerName},\n\nPaket internet Anda telah diubah${p.packageName ? ` ke ${p.packageName}` : ""}.\nPerubahan berlaku segera.`,
    }),
    push: (p) =>
      `Paket Anda diubah${p.packageName ? ` ke ${p.packageName}` : ""}`,
  },
} satisfies Record<string, BillingTemplate>;

export type BillingTemplateKey = keyof typeof BILLING_TEMPLATES;
