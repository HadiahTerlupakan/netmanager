"use client"

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { HiArrowPath, HiLockClosed, HiEye, HiEyeSlash, HiExclamationCircle } from 'react-icons/hi2'
import Link from 'next/link'

const schema = z.object({
  idPelanggan: z
    .string()
    .min(1, 'ID Pelanggan wajib diisi')
    .regex(/^\d{8}$/, 'ID Pelanggan harus 8 digit angka'),
  password: z.string().min(1, 'Password wajib diisi').min(4, 'Password minimal 4 karakter'),
})

type FormValues = z.infer<typeof schema>

export default function PelangganLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  // Auto-format ID Pelanggan: hanya angka, max 8 digit
  const handleIdPelangganChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 8)
    e.target.value = value
    setValue('idPelanggan', value, { shouldValidate: true })
  }

  const onSubmit = async (values: FormValues) => {
    setApiError(null)

    try {
      const res = await fetch('/api/pelanggan/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idPelanggan: values.idPelanggan.trim(),
          password: values.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMessage = data.error || 'ID Pelanggan atau password salah'
        setApiError(errorMessage)
        setError('password', { message: errorMessage })
        return
      }

      // Simpan token/session
      if (data.token) {
        localStorage.setItem('pelanggan_token', data.token)
        localStorage.setItem('pelanggan_data', JSON.stringify(data.pelanggan))
      }

      // Redirect ke dashboard pelanggan
      router.push('/pelanggan')
    } catch (err: any) {
      const errorMessage = err.message || 'Terjadi kesalahan saat login'
      setApiError(errorMessage)
      setError('password', { message: errorMessage })
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">NetManager</h1>
          <p className="text-gray-600 dark:text-gray-400">Portal Pelanggan</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Masuk Sebagai Pelanggan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gunakan ID Pelanggan dan password Anda untuk masuk
            </p>
          </div>

          <form className="w-full space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {apiError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-400">{apiError}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="idPelanggan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ID Pelanggan
              </label>
              <input
                id="idPelanggan"
                type="text"
                inputMode="numeric"
                maxLength={8}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Masukkan ID Pelanggan (8 digit)"
                {...register('idPelanggan', {
                  onChange: handleIdPelangganChange,
                })}
              />
              {errors.idPelanggan?.message && (
                <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                  <HiExclamationCircle className="w-4 h-4" />
                  {errors.idPelanggan.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="Masukkan password Anda"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-manipulation p-1"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <HiEyeSlash className="w-5 h-5" />
                  ) : (
                    <HiEye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password?.message && (
                <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                  <HiExclamationCircle className="w-4 h-4" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm touch-manipulation active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <HiLockClosed className="w-4 h-4" />
                  Masuk
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lupa ID Pelanggan atau password?{' '}
              <Link href="/admin" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Hubungi Admin
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

