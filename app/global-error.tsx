'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { HiOutlineExclamationTriangle, HiOutlineHome } from 'react-icons/hi2'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error ke error tracking service (jika ada)
    console.error('Global application error:', error)
  }, [error])

  return (
    <html lang="id">
      <body>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <HiOutlineExclamationTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Terjadi Kesalahan Sistem
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Maaf, terjadi kesalahan kritis pada aplikasi. Tim teknis telah diberitahu dan sedang menangani masalah ini.
            </p>

            {process.env.NODE_ENV === 'development' && error.message && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-left">
                <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-2">
                  Error Details (Development Only):
                </p>
                <p className="text-sm font-mono text-red-800 dark:text-red-200 break-all">
                  {error.message}
                </p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-700 dark:text-red-300 cursor-pointer">
                      Stack Trace
                    </summary>
                    <pre className="text-xs font-mono text-red-800 dark:text-red-200 mt-2 overflow-auto max-h-40">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Coba Lagi
              </button>
              
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                <HiOutlineHome className="w-5 h-5" />
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

