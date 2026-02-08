import Link from 'next/link'
import { HiOutlineShieldExclamation } from 'react-icons/hi2'

export default async function ForbiddenPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const reason = searchParams.reason;
  const debug = searchParams.debug;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl">
        <div className="flex justify-center">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
            <HiOutlineShieldExclamation className="w-16 h-16" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Akses Terbatas</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Anda tidak memiliki izin yang cukup untuk mengakses halaman ini.
            Silakan hubungi administrator jika Anda merasa ini adalah kesalahan.
          </p>
          {reason && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100 font-mono">
              {decodeURIComponent(reason)}
            </div>
          )}
          {debug && process.env.NODE_ENV === 'development' && (
             <div className="mt-2 p-2 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200 font-mono break-all">
               Debug: {decodeURIComponent(debug)}
             </div>
          )}
        </div>

        <div className="pt-4 space-y-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors w-full"
          >
            Kembali ke Dashboard
          </Link>
          <Link
             href="/admin/debug-auth"
             className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline w-full"
          >
             Debug Permissions
          </Link>
        </div>
      </div>
    </div>
  )
}
