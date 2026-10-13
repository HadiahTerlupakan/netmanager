"use client";

import { Modal } from "@/components/ui/Modal";
import { useApi } from "@/lib/hooks/useApi";

import {
  formatBulanSo,
  formatWaktuSo,
  LABEL_AKSI_RIWAYAT,
  LABEL_FIELD_OPNAME,
  type RiwayatPerubahanOpname,
} from "./jadwalSoTypes";

const PENANDA_KOSONG = "—";

interface ModalRiwayatSoProps {
  gudang: { id: string; nama: string } | null;
  periode: string;
  onClose: () => void;
}

/** Nilai field pada riwayat; nilai kosong ditampilkan sebagai tanda pisah. */
function nilaiTampil(nilai: string | number | null): string {
  return nilai === null || nilai === "" ? PENANDA_KOSONG : String(nilai);
}

/**
 * Jejak perubahan catatan stock opname satu gudang pada satu bulan.
 *
 * Menjawab pertanyaan yang tidak bisa dijawab kolom "SO terakhir": bukan hanya
 * siapa yang terakhir menyentuh, tetapi apa persisnya yang ia ubah.
 */
export function ModalRiwayatSo({
  gudang,
  periode,
  onClose,
}: ModalRiwayatSoProps) {
  const { data, isLoading, error } = useApi<{
    riwayat: RiwayatPerubahanOpname[];
  }>(
    gudang
      ? `/api/inventory/opname/riwayat?gudangId=${gudang.id}&periode=${periode}`
      : null,
  );
  const riwayat = data?.riwayat ?? [];

  return (
    <Modal
      isOpen={!!gudang}
      onClose={onClose}
      title={gudang ? `Riwayat perubahan — ${gudang.nama}` : ""}
      description={`Stock opname ${formatBulanSo(periode)}`}
      size="2xl"
    >
      {isLoading && <p className="text-sm text-gray-500">Memuat…</p>}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.message || "Gagal memuat riwayat perubahan"}
        </p>
      )}

      {!isLoading && !error && riwayat.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Belum ada jejak perubahan untuk bulan ini. Catatan yang dibuat sebelum
          fitur ini aktif tidak memiliki riwayat.
        </p>
      )}

      {riwayat.length > 0 && (
        <ol className="space-y-3 max-h-[60vh] overflow-y-auto">
          {riwayat.map((peristiwa) => (
            <li
              key={peristiwa.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${LABEL_AKSI_RIWAYAT[peristiwa.aksi].kelas}`}
                >
                  {LABEL_AKSI_RIWAYAT[peristiwa.aksi].teks}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {peristiwa.namaBarang}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {peristiwa.namaPelaku} ·{" "}
                  {formatWaktuSo(peristiwa.dilakukanPada)}
                </span>
              </div>

              <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {Object.entries(peristiwa.perubahan).map(([field, nilai]) => (
                  <div key={field} className="text-sm flex gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {LABEL_FIELD_OPNAME[field] ?? field}:
                    </dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {peristiwa.aksi === "DIUBAH" ? (
                        <>
                          <span className="line-through text-gray-400">
                            {nilaiTampil(nilai.dari)}
                          </span>{" "}
                          → {nilaiTampil(nilai.ke)}
                        </>
                      ) : (
                        nilaiTampil(
                          peristiwa.aksi === "DIHAPUS" ? nilai.dari : nilai.ke,
                        )
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
