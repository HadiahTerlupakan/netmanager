"use client"
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HiArrowPath, HiLockClosed } from 'react-icons/hi2'
import { getAdminUrl, getSubdomainFromWindow } from '@/lib/utils/subdomain-client'

const schema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Email tidak valid'),
  password: z.string().min(6, 'Minimal 6 karakter'),
})

type FormValues = z.infer<typeof schema>

export default function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const callbackUrlParam = search.get('callbackUrl') || '/admin'
  
  // Dapatkan URL lengkap dengan subdomain untuk callback
  const getCallbackUrl = () => {
    const subdomain = getSubdomainFromWindow()
    // Jika sudah di admin subdomain, gunakan path relatif
    if (subdomain === 'admin') {
      return callbackUrlParam
    }
    // Jika tidak di subdomain atau di subdomain lain, redirect ke admin subdomain
    return getAdminUrl(callbackUrlParam)
  }

  const callbackUrl = getCallbackUrl()
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    const res = await signIn('credentials', {
      redirect: false,
      email: values.email,
      password: values.password,
      callbackUrl: callbackUrlParam, // Kirim path relatif ke NextAuth
    })
    if (!res) return
    if (res.error) {
      setError('password', { message: 'Email atau password salah' })
      return
    }
    
    // Cek apakah kita sudah di admin subdomain
    const subdomain = getSubdomainFromWindow()
    // Extract path dari res.url (bisa berisi URL lengkap atau path relatif)
    let targetPath = res.url 
      ? (res.url.startsWith('http') ? new URL(res.url).pathname : res.url)
      : callbackUrlParam
    
    // Pastikan targetPath adalah path admin
    if (!targetPath.startsWith('/admin')) {
      targetPath = '/admin'
    }
    
    // Jika sudah di admin subdomain, gunakan path relatif (akan tetap di subdomain yang sama)
    if (subdomain === 'admin') {
      router.push(targetPath)
      return
    }
    
    // Jika tidak di admin subdomain, redirect ke admin subdomain dengan URL lengkap
    // Ini penting untuk memastikan user tetap di subdomain yang benar
    const adminUrl = getAdminUrl(targetPath)
    // Selalu gunakan window.location.href untuk cross-subdomain redirect
    window.location.href = adminUrl
  }

  return (
    <form className="w-full space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          placeholder="masukkan email Anda"
          {...register('email')}
        />
        {errors.email?.message && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          placeholder="masukkan password Anda"
          {...register('password')}
        />
        {errors.password?.message && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1">{errors.password.message}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
  )
}


