'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body className="bg-gray-50 dark:bg-gray-900">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <span className="text-4xl">⚠️</span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Terjadi Kesalahan Sistem
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Maaf, terjadi kesalahan yang tidak terduga. Kami telah mencatat kejadian ini dan akan segera memperbaikinya.
              </p>
              {error.digest && (
                <p className="text-xs font-mono text-gray-400">
                  ID Error: {error.digest}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => reset()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium cursor-pointer"
              >
                Coba Lagi
              </button>
              <a
                href="/admin"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Kembali ke Beranda
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
