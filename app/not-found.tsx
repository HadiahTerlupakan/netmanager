'use client'

import Link from 'next/link'
import { HiOutlineHome, HiOutlineArrowLeft, HiOutlineExclamationCircle } from 'react-icons/hi2'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <HiOutlineExclamationCircle className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          404
        </h1>
        
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Halaman Tidak Ditemukan
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Maaf, halaman yang Anda cari tidak ditemukan. Halaman mungkin telah dipindahkan atau dihapus.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <HiOutlineHome className="w-5 h-5" />
            Kembali ke Dashboard
          </Link>
          
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.back()
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            <HiOutlineArrowLeft className="w-5 h-5" />
            Kembali
          </button>
        </div>
      </div>
    </div>
  )
}

