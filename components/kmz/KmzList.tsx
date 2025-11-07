"use client"

import { useEffect, useState } from 'react'
import { KmzActions } from './KmzActions'

type KmzFile = {
  id: string
  name: string
  filename: string
  description: string | null
  lineColor: string
  isActive: boolean
  fileSize: number
  createdAt: string
  updatedAt: string
}

export function KmzList() {
  const [kmzFiles, setKmzFiles] = useState<KmzFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchKmzFiles() {
      try {
        const res = await fetch('/api/kmz', { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          setKmzFiles(json.kmzFiles || [])
        }
      } catch (error) {
        console.error('Error fetching KMZ files:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchKmzFiles()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-600 dark:text-gray-400">Memuat data...</div>
      </div>
    )
  }

  if (kmzFiles.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400">Belum ada file KMZ yang diupload</p>
      </div>
    )
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daftar File KMZ</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Nama</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">File</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Ukuran</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Status</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Tanggal Upload</th>
              <th className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {kmzFiles.map((kmzFile) => (
              <tr key={kmzFile.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{kmzFile.name}</div>
                  {kmzFile.description && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{kmzFile.description}</div>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Warna:</span>
                    <div
                      className="h-4 w-8 rounded border border-gray-300 dark:border-gray-700"
                      style={{ backgroundColor: kmzFile.lineColor || '#3388ff' }}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{kmzFile.lineColor || '#3388ff'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{kmzFile.filename}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatFileSize(kmzFile.fileSize)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      kmzFile.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {kmzFile.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(kmzFile.createdAt)}</td>
                <td className="px-4 py-3">
                  <KmzActions kmzFile={kmzFile} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

