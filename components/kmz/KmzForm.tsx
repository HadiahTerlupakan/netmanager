"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'

export function KmzForm() {
  const router = useRouter()
  const { show } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lineColor, setLineColor] = useState('#3388ff')
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'>('AKTIF')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!file) {
      show({ type: 'error', title: 'Error', message: 'Pilih file KMZ terlebih dahulu' })
      return
    }

    if (!name.trim()) {
      show({ type: 'error', title: 'Error', message: 'Nama wajib diisi' })
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name.trim())
      formData.append('lineColor', lineColor)
      formData.append('status', status)
      if (description.trim()) {
        formData.append('description', description.trim())
      }

      const res = await fetch('/api/kmz', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        show({ type: 'success', title: 'Berhasil', message: 'File KMZ berhasil diupload' })
        setName('')
        setDescription('')
        setLineColor('#3388ff')
        setFile(null)
        // Redirect ke halaman list setelah berhasil upload
        router.push('/admin/ftth/kmz')
        router.refresh()
      } else {
        const json = await res.json()
        const errorMessage = typeof json.error === 'string' ? json.error : 'Gagal mengupload file KMZ'
        show({
          type: 'error',
          title: 'Gagal',
          message: errorMessage,
        })
      }
    } catch (error: any) {
      show({ type: 'error', title: 'Error', message: error.message || 'Terjadi kesalahan' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload File KMZ</h2>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Nama <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          placeholder="Masukkan nama file KMZ"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Deskripsi
        </label>
        <textarea
          name="description"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          placeholder="Masukkan deskripsi (opsional)"
        />
      </div>

      <div>
        <label htmlFor="lineColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Warna Garis
        </label>
        <div className="mt-1 flex items-center gap-3">
          <input
            name="lineColor"
            id="lineColor"
            type="color"
            value={lineColor}
            onChange={(e) => setLineColor(e.target.value)}
            className="h-10 w-20 cursor-pointer rounded-md border border-gray-300 dark:border-gray-700"
          />
          <input
            name="lineColorText"
            type="text"
            value={lineColor}
            onChange={(e) => {
              const value = e.target.value
              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                setLineColor(value)
              }
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            placeholder="#3388ff"
            maxLength={7}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Pilih warna untuk garis/polygon KMZ (default: #3388ff)
        </p>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Status
        </label>
        <select
          name="status"
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE')}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="AKTIF">Aktif</option>
          <option value="NONAKTIF">Nonaktif</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      </div>

      <div>
        <label htmlFor="file" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          File KMZ <span className="text-red-500">*</span>
        </label>
        <input
          name="file"
          id="file"
          type="file"
          accept=".kmz"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          required
        />
        {file && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            File: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {uploading ? 'Mengupload...' : 'Upload KMZ'}
      </button>
    </form>
  )
}

