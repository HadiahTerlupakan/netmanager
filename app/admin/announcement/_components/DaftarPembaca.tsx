import { RECENT_READER_LIMIT } from "@/modules/notification";

interface Pembaca {
  readerName: string;
  userId: string | null;
  pelangganId: string | null;
  portal: string | null;
  readAt: Date | string;
}

interface DaftarPembacaProps {
  jumlahPembaca: number;
  pembacaTerbaru: Pembaca[];
}

const LABEL_PORTAL: Record<string, string> = {
  admin: "Admin",
  employee: "Karyawan",
  customer: "Pelanggan",
  mobile: "Aplikasi",
};

/**
 * Kunci React untuk satu baris pembaca. `AnnouncementRead` punya kolom id,
 * tetapi entity domainnya sengaja tidak memuatnya; pasangan pengumuman +
 * identitas pembaca sendiri sudah unik (lihat @@unique di skema Prisma).
 */
function kunciPembaca(pembaca: Pembaca) {
  return `${pembaca.userId ?? pembaca.pelangganId ?? "anonim"}-${new Date(
    pembaca.readAt,
  ).getTime()}`;
}

function formatWaktuBaca(waktu: Date | string) {
  return new Date(waktu).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Panel siapa saja yang sudah membaca pengumuman.
 *
 * Angka "Dibaca N orang" di daftar pengumuman sebelumnya berdiri sendiri tanpa
 * cara apa pun melihat orangnya, padahal service sudah lama menyediakan nama
 * pembacanya lewat `getAnnouncementReadStats`.
 */
export function DaftarPembaca({
  jumlahPembaca,
  pembacaTerbaru,
}: DaftarPembacaProps) {
  return (
    <section className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Pembaca</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {jumlahPembaca} orang
        </span>
      </div>

      {pembacaTerbaru.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Belum ada yang membaca pengumuman ini.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {pembacaTerbaru.map((pembaca) => (
              <li
                key={kunciPembaca(pembaca)}
                className="flex items-center justify-between py-2.5"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {pembaca.readerName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {(pembaca.portal && LABEL_PORTAL[pembaca.portal]) ??
                      pembaca.portal ??
                      "Tidak diketahui"}
                  </div>
                </div>
                <time className="text-xs text-gray-500 dark:text-gray-400">
                  {formatWaktuBaca(pembaca.readAt)}
                </time>
              </li>
            ))}
          </ul>
          {jumlahPembaca > pembacaTerbaru.length && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Menampilkan {RECENT_READER_LIMIT} pembaca terbaru dari{" "}
              {jumlahPembaca} orang.
            </p>
          )}
        </>
      )}
    </section>
  );
}
