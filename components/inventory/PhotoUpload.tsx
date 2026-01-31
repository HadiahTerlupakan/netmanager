'use client'

import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import Image from 'next/image'

interface PhotoUploadProps {
  transactionId?: string
  transactionType: 'inventory-masuk' | 'inventory-keluar' | 'inventory-transfer' | 'finance-transaction'
  onPhotosChange?: (photos: UploadedPhoto[]) => void
  maxPhotos?: number
  maxSizeMB?: number
  disabled?: boolean
  className?: string
}

export interface UploadedPhoto {
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  url?: string
  error?: string
}

export interface PhotoUploadRef {
  uploadPhotos: () => Promise<string[]>
  getPhotos: () => UploadedPhoto[]
  resetPhotos: () => void
}

export const PhotoUpload = forwardRef<PhotoUploadRef, PhotoUploadProps>(({
  transactionId,
  transactionType,
  onPhotosChange,
  maxPhotos = 5,
  maxSizeMB = 5,
  disabled = false,
  className = ''
}: PhotoUploadProps, ref) => {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Notify parent component when photos change
  const notifyPhotosChange = useCallback((newPhotos: UploadedPhoto[]) => {
    onPhotosChange?.(newPhotos)
  }, [onPhotosChange])

  // Validate files
  const validateFiles = useCallback((files: File[]): { validFiles: File[]; errors: string[] } => {
    const errors: string[] = []
    const validFiles: File[] = []

    files.forEach((file, _index) => {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        errors.push(`File "${file.name}" bukan gambar yang valid`)
        return
      }

      // Check file size
      const maxSizeBytes = maxSizeMB * 1024 * 1024
      if (file.size > maxSizeBytes) {
        errors.push(`File "${file.name}" terlalu besar. Maksimal ${maxSizeMB}MB`)
        return
      }

      validFiles.push(file)
    })

    return { validFiles, errors }
  }, [maxSizeMB])

  // Create preview for a file
  const createPreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  // Add photos to the list
  const addPhotos = useCallback(async (files: File[]) => {
    if (disabled) return

    const { validFiles, errors } = validateFiles(files)

    if (errors.length > 0) {
      setUploadError(errors.join('; '))
      setTimeout(() => setUploadError(null), 5000)
      return
    }

    // Check if adding these files would exceed the max limit
    if (photos.length + validFiles.length > maxPhotos) {
      setUploadError(`Maksimal ${maxPhotos} foto yang diizinkan. Anda sudah memiliki ${photos.length} foto.`)
      setTimeout(() => setUploadError(null), 5000)
      return
    }

    // Create previews and add to state
    const newPhotos: UploadedPhoto[] = []

    for (const file of validFiles) {
      try {
        const preview = await createPreview(file)
        newPhotos.push({
          file,
          preview,
          progress: 0,
          status: 'pending'
        })
      } catch (error) {
        console.error('Error creating preview:', error)
      }
    }

    const updatedPhotos = [...photos, ...newPhotos]
    setPhotos(updatedPhotos)
    notifyPhotosChange(updatedPhotos)
    setUploadError(null)
  }, [photos, maxPhotos, disabled, validateFiles, createPreview, notifyPhotosChange])

  // Remove a photo from the list
  const removePhoto = useCallback((index: number) => {
    if (disabled) return

    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    notifyPhotosChange(newPhotos)
  }, [photos, disabled, notifyPhotosChange])

  // Upload photos to server (automatic upload)
  const uploadPhotos = useCallback(async () => {
    if (photos.length === 0) {
      return []
    }

    // Generate temporary transaction ID if not provided
    const tempTransactionId = transactionId || `temp-${Date.now()}`

    // Update photos status to uploading
    const uploadingPhotos = photos.map(photo => ({
      ...photo,
      status: 'uploading' as const,
      progress: 0
    }))
    setPhotos(uploadingPhotos)

    try {
      const formData = new FormData()

      // Add all photos to FormData
      photos.forEach((photo, _index) => {
        formData.append('photos', photo.file)
      })

      formData.append('transactionId', tempTransactionId)
      formData.append('transactionType', transactionType)

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setPhotos(prev => prev.map(photo =>
          photo.status === 'uploading' && photo.progress < 90
            ? { ...photo, progress: Math.min(photo.progress + 10, 90) }
            : photo
        ))
      }, 200)

      const response = await fetch('/api/inventory/upload-photo', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload gagal')
      }

      const result = await response.json()

      // Update photos with success status and URLs
      const successPhotos = uploadingPhotos.map((photo, index) => ({
        ...photo,
        status: 'success' as const,
        progress: 100,
        url: result.data.urls[index] || ''
      }))

      setPhotos(successPhotos)
      notifyPhotosChange(successPhotos)

      return result.data.urls

    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat upload'

      // Update all photos with error status
      const errorPhotos = uploadingPhotos.map(photo => ({
        ...photo,
        status: 'error' as const,
        error: errorMessage
      }))

      setPhotos(errorPhotos)
      setUploadError(errorMessage)
      throw error
    }
  }, [transactionId, transactionType, photos, notifyPhotosChange])

  // Public method to trigger upload from parent component
  const triggerUpload = useCallback(async () => {
    if (photos.length === 0) {
      return []
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const urls = await uploadPhotos()
      return urls
    } catch (error) {
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [uploadPhotos, photos.length])

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    uploadPhotos: triggerUpload,
    getPhotos: () => photos,
    resetPhotos: () => {
      setPhotos([])
      setUploadError(null)
      notifyPhotosChange([])
    }
  }), [triggerUpload, photos, notifyPhotosChange])

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading && photos.length < maxPhotos) {
      setDragActive(true)
    }
  }, [disabled, isUploading, photos.length, maxPhotos])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled || isUploading) return

    const files = Array.from(e.dataTransfer.files)
    addPhotos(files)
  }, [disabled, isUploading, addPhotos])

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || isUploading) return

    const files = Array.from(e.target.files || [])
    addPhotos(files)

    // Reset the input value to allow selecting the same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [disabled, isUploading, addPhotos])

  // Get status color for progress bar
  const getProgressColor = (status: UploadedPhoto['status']) => {
    switch (status) {
      case 'uploading': return 'bg-blue-500'
      case 'success': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled || isUploading || photos.length >= maxPhotos
            ? 'opacity-50 cursor-not-allowed'
            : ''
          }
          ${uploadError ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          disabled={disabled || isUploading || photos.length >= maxPhotos}
          className="hidden"
        />

        <div className="space-y-3">
          <div className="flex justify-center">
            {isUploading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            ) : (
              <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>

          <div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {isUploading
                ? 'Mengunggah foto...'
                : photos.length >= maxPhotos
                  ? `Maksimal ${maxPhotos} foto tercapai`
                  : 'Seret & lepas foto di sini'
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isUploading
                ? 'Harap tunggu hingga selesai'
                : photos.length >= maxPhotos
                  ? `Maksimal ${maxPhotos} foto tercapai`
                  : `atau klik untuk memilih file (Maks ${maxPhotos} foto, ${maxSizeMB}MB per foto)`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          <div className="flex">
            <svg className="h-5 w-5 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">{uploadError}</span>
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Foto ({photos.length}/{maxPhotos})
            </h3>
            {isUploading && (
              <span className="text-sm text-blue-600 dark:text-blue-400">
                Mengunggah otomatis...
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                {/* Photo Preview */}
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <Image
                    src={photo.preview}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                  />

                  {/* Overlay for status and actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {/* Status indicator */}
                    {photo.status === 'success' && (
                      <div className="absolute top-2 left-2">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {photo.status === 'error' && (
                      <div className="absolute top-2 left-2">
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Remove button */}
                    {!disabled && (
                      <button
                        onClick={() => removePhoto(index)}
                        disabled={isUploading}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {photo.status === 'uploading' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600">
                    <div
                      className={`h-full ${getProgressColor(photo.status)} transition-all duration-300`}
                      style={{ width: `${photo.progress}%` }}
                    />
                  </div>
                )}

                {/* Photo info */}
                <div className="mt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {photo.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {(photo.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {photo.status === 'error' && photo.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {photo.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {photos.length === 0 && !isUploading && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Format yang didukung: JPEG, PNG, GIF, WebP</p>
          <p>Ukuran maksimal per file: {maxSizeMB}MB</p>
        </div>
      )}
    </div>
  )
})

PhotoUpload.displayName = 'PhotoUpload'