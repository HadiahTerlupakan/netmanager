'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineExclamationTriangle, HiOutlineArrowLeft, HiOutlineClock } from 'react-icons/hi2'
import { useEffect, useState, Suspense } from 'react'

function AuthErrorPageContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  // Decode error message dari URL
  const errorMessage = error ? decodeURIComponent(error) : 'Terjadi kesalahan saat autentikasi'
  const isRateLimitError = errorMessage.includes('Terlalu banyak percobaan')

  const [countdown, setCountdown] = useState<number | null>(isRateLimitError ? 300 : null)

  // Jika error terkait rate limiting, tampilkan countdown
  useEffect(() => {
    if (isRateLimitError) {
      // Rate limit adalah 5 menit (300 detik)
      // setCountdown(300) // Initial value is now set in useState

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [isRateLimitError])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isRateLimitError 
                  ? 'bg-orange-100 dark:bg-orange-900/30' 
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {isRateLimitError ? (
                  <HiOutlineClock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                ) : (
                  <HiOutlineExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                )}
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isRateLimitError ? 'Terlalu Banyak Percobaan' : 'Kesalahan Autentikasi'}
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {errorMessage}
            </p>

            {isRateLimitError && countdown !== null && countdown > 0 && (
              <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                  Silakan coba lagi dalam:
                </p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatTime(countdown)}
                </p>
              </div>
            )}

            {isRateLimitError && countdown === 0 && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Anda sekarang dapat mencoba login lagi.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <HiOutlineArrowLeft className="w-4 h-4" />
              Kembali ke Halaman Login
            </Link>

            {isRateLimitError && (
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Untuk keamanan, sistem membatasi percobaan login. 
                  Setelah waktu tunggu selesai, Anda dapat mencoba lagi.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Wrapper component with Suspense boundary
export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthErrorPageContent />
    </Suspense>
  )
}

