import Link from "next/link";

/**
 * Pesan aksi tagihan dari respons simpan: ada bila "Batalkan & Buat Tagihan
 * Baru" tidak mengganti tagihan (pelanggan sedang membayar) atau gagal.
 */
export async function readInvoiceActionNotice(
  response: Response,
): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      data?: { invoiceActionMessage?: unknown };
    };
    const message = body.data?.invoiceActionMessage;
    return typeof message === "string" ? message : null;
  } catch {
    return null;
  }
}

/** Kotak peringatan yang menahan admin di form sampai pesannya terbaca. */
export function InvoiceActionNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
    >
      <p className="font-semibold">
        Data pelanggan tersimpan, tagihan tidak diganti
      </p>
      <p className="mt-1">{message}</p>
      <Link
        href="/admin/pelanggan/ppp"
        className="mt-2 inline-block font-medium underline"
      >
        Kembali ke daftar pelanggan
      </Link>
    </div>
  );
}
