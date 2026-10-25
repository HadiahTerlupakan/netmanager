import type { IsolirPreview, IsolirRouterStatus } from "./useIsolirPage";

const DROPPED_MESSAGES: Record<IsolirPreview["dropped"][number], string> = {
  logo: "Logo tidak dimuat karena halaman melebihi 24 KiB",
  message: "Pesan dipotong karena halaman melebihi 24 KiB",
};

const CARD_CLASS =
  "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5";

function formatSyncedAt(value: string | null): string {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

/** Pratinjau memakai HTML yang sama persis dengan file di router. */
export function IsolirPreviewPanel({ preview }: { preview: IsolirPreview }) {
  return (
    <section className={CARD_CLASS}>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
        Pratinjau
      </h3>
      {preview.dropped.map((item) => (
        <p
          key={item}
          role="alert"
          className="mb-3 rounded-md bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          {DROPPED_MESSAGES[item]}
        </p>
      ))}
      {/* sandbox kosong: halaman tidak memuat skrip, tautannya pun tidak perlu jalan di pratinjau. */}
      <iframe
        title="Pratinjau halaman isolir"
        srcDoc={preview.html}
        sandbox=""
        className="w-full h-[560px] rounded-md border border-gray-200 dark:border-gray-700 bg-white"
      />
    </section>
  );
}

export function IsolirSyncStatusTable({
  routers,
}: {
  routers: IsolirRouterStatus[];
}) {
  return (
    <section className={CARD_CLASS}>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        Status pengiriman ke router
      </h3>
      <p className="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
        Router yang gagal akan diperbarui saat Reconfigurasi Mikrotik
      </p>
      {routers.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Belum ada router dengan mode halaman di router
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">Router</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Terakhir terkirim</th>
                <th className="py-2 font-medium">Galat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {routers.map((router) => (
                <tr key={router.id} className="text-gray-900 dark:text-white">
                  <td className="py-2 pr-4">{router.name}</td>
                  <td className="py-2 pr-4">
                    {router.synced ? (
                      <span className="text-green-700 dark:text-green-400">
                        Terkini
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        Belum terkini
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {formatSyncedAt(router.isolirPageSyncedAt)}
                  </td>
                  <td className="py-2 text-red-600 dark:text-red-400">
                    {router.isolirPageError ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
