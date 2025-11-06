"use client"
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

const schema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Email tidak valid'),
  password: z.string().min(6, 'Minimal 6 karakter'),
})

type FormValues = z.infer<typeof schema>

export default function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const callbackUrl = search.get('callbackUrl') || '/admin'
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
      callbackUrl,
    })
    if (!res) return
    if (res.error) {
      setError('password', { message: 'Email atau password salah' })
      return
    }
    router.push(res.url || callbackUrl)
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
            <span className="animate-spin">⏳</span>
            Memproses...
          </>
        ) : (
          <>
            <span>🔐</span>
            Masuk
          </>
        )}
      </button>
    </form>
  )
}


