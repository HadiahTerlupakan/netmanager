'use client'
import Image from 'next/image';

import { useState, useRef } from 'react'
import { MdCameraAlt, MdClose, MdImage } from 'react-icons/md'
import { Button } from '@/components/ui/Button'

interface ImageUploadProps {
    images: File[]
    onImagesChange: (images: File[]) => void
    maxImages?: number
}

export function ImageUpload({ images, onImagesChange, maxImages = 5 }: ImageUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previews, setPreviews] = useState<string[]>([])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        const newFiles: File[] = []
        const newPreviews: string[] = []

        for (let i = 0; i < files.length; i++) {
            if (images.length + newFiles.length >= maxImages) break
            const file = files[i]
            if (file && file.type.startsWith('image/')) {
                newFiles.push(file)
                newPreviews.push(URL.createObjectURL(file))
            }
        }

        onImagesChange([...images, ...newFiles])
        setPreviews([...previews, ...newPreviews])

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const removeImage = (index: number) => {
        const newImages = [...images]
        const newPreviews = [...previews]

        // Revoke URL to prevent memory leaks
        const previewUrl = newPreviews[index]
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }

        newImages.splice(index, 1)
        newPreviews.splice(index, 1)

        onImagesChange(newImages)
        setPreviews(newPreviews)
    }

    const openCamera = () => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = 'image/*'
            fileInputRef.current.capture = 'environment'
            fileInputRef.current.click()
        }
    }

    const openGallery = () => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = 'image/*'
            fileInputRef.current.removeAttribute('capture')
            fileInputRef.current.click()
        }
    }

    return (
        <div>
            <label className="block text-sm font-medium mb-2">
                Foto Bukti (Maks. {maxImages})
            </label>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Preview Grid */}
            {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {previews.map((preview, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <Image 
                                fill
                                sizes="33vw"
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="object-cover"
                            />
                            <Button type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                            >
                                <MdClose className="text-sm" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Buttons */}
            {images.length < maxImages && (
                <div className="flex gap-2">
                    <Button variant="outline"
                        type="button"
                        onClick={openCamera}
                         className="flex-1"
                    >
                        <MdCameraAlt className="text-xl text-blue-600" />
                        <span className="text-sm font-medium">Kamera</span>
                    </Button>
                    <Button variant="outline"
                        type="button"
                        onClick={openGallery}
                         className="flex-1"
                    >
                        <MdImage className="text-xl text-green-600" />
                        <span className="text-sm font-medium">Galeri</span>
                    </Button>
                </div>
            )}
        </div>
    )
}
