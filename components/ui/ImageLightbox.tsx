'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { FiX, FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut, FiDownload } from 'react-icons/fi'

interface ImageLightboxProps {
  images: string[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
  alt?: string
}

export function ImageLightbox({ images, initialIndex = 0, isOpen, onClose, alt = 'Image' }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      // Defer state updates to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setCurrentIndex(initialIndex)
        setZoom(1)
        setPosition({ x: 0, y: 0 })
      })
    }
  }, [isOpen, initialIndex])

  // Define navigation functions before the keyboard effect
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [images.length])

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1)
      if (newZoom === 1) setPosition({ x: 0, y: 0 })
      return newZoom
    })
  }, [])

  // Keyboard navigation - now uses the functions defined above
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          goToPrevious()
          break
        case 'ArrowRight':
          goToNext()
          break
        case '+':
        case '=':
          handleZoomIn()
          break
        case '-':
          handleZoomOut()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, goToPrevious, goToNext, handleZoomIn, handleZoomOut, onClose])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDownload = () => {
    const imageUrl = images[currentIndex]
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `image-${currentIndex + 1}.jpg`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen || images.length === 0) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-linear-to-b from-black/60 to-transparent">
          <div className="text-white text-sm font-medium">
            {images.length > 1 && (
              <span>{currentIndex + 1} / {images.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom Out (-)"
            >
              <FiZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white text-sm min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom In (+)"
            >
              <FiZoomIn className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-white/20 mx-2" />
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Download"
            >
              <FiDownload className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Close (Esc)"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation - Previous */}
        {images.length > 1 && (
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Previous (←)"
          >
            <FiChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Container */}
        <div
          className="flex-1 flex items-center justify-center p-16 overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <div
            className="relative max-w-full max-h-full transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            }}
          >
              <Image
                src={images[currentIndex] ?? ''}
                alt={`${alt} ${currentIndex + 1}`}
              width={1200}
              height={800}
              className="max-w-full max-h-[80vh] object-contain select-none"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Navigation - Next */}
        {images.length > 1 && (
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Next (→)"
          >
            <FiChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center p-4 bg-linear-to-t from-black/60 to-transparent">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentIndex(idx)
                    setZoom(1)
                    setPosition({ x: 0, y: 0 })
                  }}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentIndex
                      ? 'border-white scale-110'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
