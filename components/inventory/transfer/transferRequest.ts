import { OFFLINE_MESSAGE } from "@/components/inventory/form-shared/inventoryRequestMessages";

/** Pesan saat permintaan tidak sampai ke server sama sekali. */
export const PESAN_TANPA_KONEKSI = OFFLINE_MESSAGE;

/** Pesan saat server menjawab dengan sesuatu yang tidak bisa dibaca. */
export const PESAN_JAWABAN_RUSAK =
  "Server sedang bermasalah dan jawabannya tidak bisa dibaca. Tunggu sebentar, lalu coba lagi. Kalau masih gagal, lapor ke admin.";

/**
 * Gagal permintaan transfer. `isServerRejection` benar bila server menjawab
 * dan menolak — artinya pasti tidak ada yang tersimpan. Bila salah, koneksi
 * atau jawaban server bermasalah dan hasilnya tidak bisa dipastikan.
 */
export class TransferRequestError extends Error {
  constructor(
    message: string,
    readonly isServerRejection: boolean,
  ) {
    super(message);
    this.name = "TransferRequestError";
  }
}

interface TransferApiEnvelope<T> {
  success?: boolean;
  error?: string;
  data?: T;
}

/**
 * Kirim permintaan API transfer dan kembalikan isi `data`.
 * Gagal apa pun menjadi {@link TransferRequestError} dengan pesan yang bisa dibaca petugas:
 * pesan dari server bila ada, atau penjelasan soal koneksi / server.
 */
export async function requestTransferApi<T>(
  send: () => Promise<Response>,
  fallbackMessage: string,
): Promise<T> {
  let response: Response;
  try {
    response = await send();
  } catch {
    throw new TransferRequestError(PESAN_TANPA_KONEKSI, false);
  }

  let body: TransferApiEnvelope<T>;
  try {
    body = (await response.json()) as TransferApiEnvelope<T>;
  } catch {
    throw new TransferRequestError(PESAN_JAWABAN_RUSAK, false);
  }

  if (!body?.success) {
    throw new TransferRequestError(body?.error || fallbackMessage, true);
  }
  return (body.data ?? body) as T;
}
