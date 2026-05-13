export interface BillingTemplateParams {
  customerName: string;
  invoiceNumber?: string;
  amountDue?: number;
  dueDate?: string;
  packageName?: string;
  username?: string;
  reminderType?: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
}

export interface EmailContent {
  subject: string;
  body: string;
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
      `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} sebesar ${formatRupiah(p.amountDue)} telah dibuat${p.dueDate ? `. Jatuh tempo ${p.dueDate}` : ""}.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nTagihan baru:${p.invoiceNumber ? `\nNomor: ${p.invoiceNumber}` : ""}\nJumlah: ${formatRupiah(p.amountDue)}${p.dueDate ? `\nJatuh tempo: ${p.dueDate}` : ""}\n\nSilakan bayar sebelum jatuh tempo.`,
    email: (p) => ({
      subject: `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} - ${formatRupiah(p.amountDue)}`,
      body: `Halo ${p.customerName},\n\nTagihan baru telah dibuat.\nJumlah: ${formatRupiah(p.amountDue)}${p.dueDate ? `\nJatuh tempo: ${p.dueDate}` : ""}`,
    }),
    push: (p) =>
      `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""}: ${formatRupiah(p.amountDue)}`,
  },
  invoiceReminder: {
    title: "Pengingat tagihan",
    inApp: (p) =>
      `Tagihan${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""} (${formatRupiah(p.amountDue)}) ${p.reminderType === "OVERDUE" ? "sudah lewat jatuh tempo" : `akan jatuh tempo ${p.dueDate}`}.`,
    whatsapp: (p) => {
      const head =
        p.reminderType === "OVERDUE"
          ? "Tagihan Anda sudah lewat jatuh tempo."
          : p.reminderType === "DUE_TODAY"
            ? "Tagihan Anda jatuh tempo hari ini."
            : "Pengingat tagihan Anda.";
      return `Halo ${p.customerName},\n\n${head}\n${p.invoiceNumber ?? "Tagihan"} - ${formatRupiah(p.amountDue)}${p.dueDate ? `\nJatuh tempo: ${p.dueDate}` : ""}\n\nAbaikan jika sudah membayar.`;
    },
    email: (p) => ({
      subject: `Reminder: ${p.invoiceNumber ?? "tagihan"}`,
      body: `Tagihan ${p.invoiceNumber ?? ""} sebesar ${formatRupiah(p.amountDue)} ${p.reminderType === "OVERDUE" ? "sudah lewat jatuh tempo" : `akan jatuh tempo ${p.dueDate}`}.`,
    }),
    push: (p) =>
      `Reminder: ${p.invoiceNumber ?? "tagihan"} ${p.reminderType === "OVERDUE" ? "lewat" : (p.dueDate ?? "")}`,
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
  customerIsolated: {
    title: "Layanan diisolir",
    inApp: () =>
      "Layanan internet Anda telah diisolir karena tunggakan. Silakan bayar tagihan untuk reaktivasi.",
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda telah diisolir karena tunggakan.${p.invoiceNumber ? `\n\nTagihan: ${p.invoiceNumber}\nJumlah: ${formatRupiah(p.amountDue)}` : ""}\n\nSilakan bayar untuk reaktivasi.`,
    email: (p) => ({
      subject: "Layanan diisolir - butuh pembayaran",
      body: `Halo ${p.customerName},\n\nLayanan Anda diisolir.${p.invoiceNumber ? ` Silakan bayar ${p.invoiceNumber}.` : ""}`,
    }),
    push: () => "Layanan Anda diisolir",
  },
  customerActivated: {
    title: "Layanan aktif kembali",
    inApp: () =>
      "Layanan internet Anda telah aktif kembali. Terima kasih atas pembayarannya.",
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda telah aktif kembali.\nTerima kasih atas pembayarannya.`,
    email: (p) => ({
      subject: "Layanan aktif kembali",
      body: `Halo ${p.customerName},\n\nLayanan Anda aktif kembali. Terima kasih.`,
    }),
    push: () => "Layanan Anda aktif kembali",
  },
} satisfies Record<string, BillingTemplate>;

export type BillingTemplateKey = keyof typeof BILLING_TEMPLATES;
