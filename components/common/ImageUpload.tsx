"use client"

import { useState, useRef } from 'react'
import { HiCloudArrowUp, HiTrash } from 'react-icons/hi2'
import Image from 'next/image'

interface ImageUploadProps {
  value?: string[]
  onChange: (urls: string[]) => void
  folder?: string
  label?: string
  maxFiles?: number
}

export default function ImageUpload({ value = [], onChange, folder = 'uploads', label = 'Foto', maxFiles = 5 }: ImageUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (value.length + files.length > maxFiles) {
      setError(`Maksimal ${maxFiles} foto yang diizinkan`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newUrls: string[] = []
      
      // Upload files in one request
      const formData = new FormData()
      formData.append('folder', folder)
      
      let validFilesCount = 0
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.type.startsWith('image/')) {
          formData.append('files', file)
          validFilesCount++
        }
      }

      if (validFilesCount === 0) return

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Gagal mengupload gambar')
      }

      const data = await res.json()
      if (data.urls) {
        newUrls.push(...data.urls)
      } else if (data.url) {
        newUrls.push(data.url)
      }

      onChange([...value, ...newUrls])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = (indexToRemove: number) => {
    onChange(value.filter((_, index) => index !== indexToRemove))
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} ({value.length}/{maxFiles})
      </label>
      
      {/* Grid Display */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
              <Image 
                src={url} 
                alt={`Uploaded ${index + 1}`} 
                fill 
                className="object-cover" 
                sizes="(max-width: 768px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                  title="Hapus foto"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {value.length < maxFiles && (
        <div className="w-full">
          <div 
            onClick={() => !loading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              loading 
                ? 'border-gray-300 bg-gray-50 opacity-50 cursor-wait' 
                : 'border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:hover:border-indigo-400 dark:hover:bg-gray-800'
            }`}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
            ) : (
              <HiCloudArrowUp className="w-8 h-8 text-gray-400 mb-2" />
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {loading ? 'Mengupload...' : 'Klik untuk upload foto'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP (Max 5MB)</p>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
        disabled={loading}
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
