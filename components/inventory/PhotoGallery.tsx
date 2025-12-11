'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { PhotoThumbnail, PhotoThumbnailWithCount } from './PhotoThumbnail'
import {
  HiXMark,
  HiChevronLeft,
  HiChevronRight,
  HiMagnifyingGlassMinus,
  HiMagnifyingGlassPlus,
  HiArrowDownTray,
  HiMiniPhoto
} from 'react-icons/hi2'

interface Photo {
  id: string
  url: string
  name?: string
  size?: number
  uploadedAt?: string
}

interface PhotoGalleryProps {
  photos: Photo[]
  onDelete?: (photoId: string) => void
  showDeleteButton?: boolean
  columns?: number
  gap?: number
  maxThumbnails?: number
  className?: string
  emptyMessage?: string
  disabled?: boolean
}

export function PhotoGallery({
  photos,
  onDelete,
  showDeleteButton = true,
  columns = 4,
  gap = 4,
  maxThumbnails,
  className = '',
  emptyMessage = 'Tidak ada foto',
  disabled = false
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reset zoom when photo changes
  useEffect(() => {
    setZoomLevel(1)
  }, [selectedPhoto])

  const handlePhotoClick = useCallback((photo: Photo) => {
    const index = photos.findIndex(p => p.id === photo.id)
    setCurrentIndex(index)
    setSelectedPhoto(photo)
  }, [photos])

  const handleClose = useCallback(() => {
    setSelectedPhoto(null)
    setZoomLevel(1)
  }, [])

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      setSelectedPhoto(photos[newIndex])
    }
  }, [currentIndex, photos])

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      setSelectedPhoto(photos[newIndex])
    }
  }, [currentIndex, photos])

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5))
  }, [])

  const handleDownload = useCallback(async () => {
    if (!selectedPhoto?.url) return

    try {
      // Create a temporary link element
      const link = document.createElement('a')
      link.href = selectedPhoto.url
      link.download = selectedPhoto.name || `photo-${selectedPhoto.id}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }, [selectedPhoto])

  const handleDeleteFromModal = useCallback(() => {
    if (selectedPhoto && onDelete) {
      onDelete(selectedPhoto.id)
      handleClose()
    }
  }, [selectedPhoto, onDelete, handleClose])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPhoto) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case '+':
        case '=':
          e.preventDefault()
          handleZoomIn()
          break
        case '-':
        case '_':
          e.preventDefault()
          handleZoomOut()
          break
        case 'Escape':
          e.preventDefault()
          handleClose()
          break
      }
    }

    if (selectedPhoto) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedPhoto, handlePrevious, handleNext, handleZoomIn, handleZoomOut, handleClose])

  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  }

  const gapClasses = {
    1: 'gap-1',
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8'
  }

  const displayPhotos = maxThumbnails ? photos.slice(0, maxThumbnails) : photos

  if (photos.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <HiMiniPhoto className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Photo Grid */}
      <div className={`grid ${gridClasses[columns as keyof typeof gridClasses] || gridClasses[4]} ${gapClasses[gap as keyof typeof gapClasses] || gapClasses[4]}`}>
        {displayPhotos.map((photo) => (
          <PhotoThumbnail
            key={photo.id}
            photo={photo}
            onClick={handlePhotoClick}
            onDelete={onDelete}
            showDeleteButton={showDeleteButton}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Show more indicator */}
      {maxThumbnails && photos.length > maxThumbnails && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setSelectedPhoto(photos[0])}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Lihat {photos.length - maxThumbnails} foto lagi
          </button>
        </div>
      )}

      {/* Full Screen Modal */}
      {selectedPhoto && (
        <Modal
          isOpen={!!selectedPhoto}
          onClose={handleClose}
          size="4xl"
          showCloseButton={false}
          title={undefined}
        >
          <div className="relative w-full h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
              <div className="flex-1">
                <h3 className="text-lg font-semibold truncate">
                  {selectedPhoto.name || `Photo ${currentIndex + 1}`}
                </h3>
                {selectedPhoto.size && (
                  <p className="text-sm text-gray-400">
                    {(selectedPhoto.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center bg-gray-800 rounded-lg">
                  <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-gray-700 rounded-l-lg transition-colors"
                    title="Zoom out (-)"
                  >
                    <HiMagnifyingGlassMinus className="w-5 h-5" />
                  </button>
                  <span className="px-3 text-sm">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-gray-700 rounded-r-lg transition-colors"
                    title="Zoom in (+)"
                  >
                    <HiMagnifyingGlassPlus className="w-5 h-5" />
                  </button>
                </div>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Download foto"
                >
                  <HiArrowDownTray className="w-5 h-5" />
                </button>

                {/* Delete Button */}
                {showDeleteButton && onDelete && (
                  <button
                    onClick={handleDeleteFromModal}
                    className="p-2 hover:bg-red-600 rounded-lg transition-colors text-red-400 hover:text-white"
                    title="Hapus foto"
                  >
                    <HiXMark className="w-5 h-5" />
                  </button>
                )}

                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Tutup (Esc)"
                >
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Photo Viewer */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              {/* Previous Button */}
              {currentIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 z-10 p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all"
                  title="Previous (←)"
                >
                  <HiChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Photo */}
              <div className="relative max-w-full max-h-full overflow-hidden">
                <div
                  className="transition-transform duration-200 ease-out"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <Image
                    src={selectedPhoto.url}
                    alt={selectedPhoto.name || 'Photo'}
                    width={1200}
                    height={800}
                    className="max-w-full max-h-[calc(100vh-120px)] object-contain"
                    priority
                  />
                </div>
              </div>

              {/* Next Button */}
              {currentIndex < photos.length - 1 && (
                <button
                  onClick={handleNext}
                  className="absolute right-4 z-10 p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all"
                  title="Next (→)"
                >
                  <HiChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-900 text-white">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {currentIndex + 1} dari {photos.length}
                </div>

                {/* Thumbnail Navigation */}
                <div className="flex gap-1 max-w-md overflow-x-auto">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        setCurrentIndex(index)
                        setSelectedPhoto(photo)
                      }}
                      className={`
                        relative w-12 h-12 rounded overflow-hidden border-2 transition-all
                        ${index === currentIndex
                          ? 'border-blue-500 scale-110'
                          : 'border-gray-600 hover:border-gray-400'
                        }
                      `}
                    >
                      <Image
                        src={photo.url}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Compact Gallery for use in tables or forms
interface CompactGalleryProps {
  photos: Photo[]
  maxVisible?: number
  onViewAll?: (photos: Photo[]) => void
  className?: string
}

export function CompactGallery({
  photos,
  maxVisible = 3,
  onViewAll,
  className = ''
}: CompactGalleryProps) {
  if (photos.length === 0) {
    return null
  }

  const handleClick = () => {
    onViewAll?.(photos)
  }

  return (
    <PhotoThumbnailWithCount
      photos={photos}
      maxVisible={maxVisible}
      onClick={() => onViewAll?.(photos)}
      size="sm"
      className={className}
    />
  )
}