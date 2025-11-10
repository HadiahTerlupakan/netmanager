"use client"
import { useEffect, useState, use } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { userUpdateSchema } from '@/lib/validations/user'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiArrowPath } from 'react-icons/hi2'

type FormValues = z.infer<typeof userUpdateSchema>

export default function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [user, setUser] = useState<any>(null)
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(userUpdateSchema) })

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/users')
      const data = await res.json()
      const usr = data.users.find((u: any) => u.id === id)
      if (usr) {
        setUser(usr)
        setValue('name', usr.name ?? '')
        setValue('role', usr.role)
      }
    })()
  }, [id, setValue])

  const onSubmit = async (values: FormValues) => {
    const res = await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
    if (res.ok) router.push('/admin/users')
  }

  const onDelete = async () => {
    if (!confirm('Hapus user ini? Tindakan ini tidak dapat dibatalkan.')) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/users')
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <HiArrowPath className="mb-4 w-12 h-12 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data user...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit User</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ubah informasi pengguna: {user.email}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Email tidak dapat diubah</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama
            </label>
            <input
              id="name"
              type="text"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              placeholder="Nama Lengkap"
              {...register('name')}
            />
            {errors.name?.message && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{String(errors.name.message)}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password Baru
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              placeholder="Kosongkan jika tidak ingin mengubah password"
              {...register('password')}
            />
            {errors.password?.message && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{String(errors.password.message)}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">Minimal 6 karakter jika ingin mengubah password</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              id="role"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              {...register('role')}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div className="flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Menyimpan...
                </>
              ) : (
                <>
                  <span>💾</span>
                  Simpan Perubahan
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              <span>🗑️</span>
              Hapus
            </button>
            <Link
              href="/admin/users"
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}


