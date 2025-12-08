# Inventory Image Upload Guide

This guide explains how to use the extended image upload utility for inventory transactions in the NetManager system.

## Overview

The image upload utility has been extended to support inventory photos for both `inventory-masuk` (inventory in) and `inventory-keluar` (inventory out) transactions. The utility provides:

- Automatic WebP conversion for optimized storage
- Support for both R2 cloud storage and local storage
- Multiple photo uploads per transaction
- Validation for file types and sizes
- Organized folder structure

## Upload Types

The utility now supports two new upload types:

1. **`inventory-masuk`**: For photos when items are added to inventory
   - Storage path: `uploads/inventory/masuk/`
   - Supports sub-foldering by transaction ID

2. **`inventory-keluar`**: For photos when items are removed from inventory
   - Storage path: `uploads/inventory/keluar/`
   - Supports sub-foldering by transaction ID

## Usage Examples

### Basic Upload

```typescript
import { uploadInventoryPhotos, validateInventoryPhotos } from '@/lib/utils/image-upload'

// Validate photos first
const validation = validateInventoryPhotos(files, 5, 5) // max 5 photos, 5MB each
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors)
  return
}

// Upload photos
const uploadedUrls = await uploadInventoryPhotos(
  files,
  'TXN12345', // transaction ID
  'inventory-masuk', // or 'inventory-keluar'
  'public/uploads/inventory/masuk' // local storage directory
)
```

### In API Route

```typescript
import { NextRequest } from 'next/server'
import { handleInventoryMasukPhotos } from '@/lib/utils/inventory-upload-example'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const transactionId = formData.get('transactionId') as string
    const userId = formData.get('userId') as string

    // Extract photos from form data
    const photos = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('photo_') && value instanceof File) {
        photos.push(value)
      }
    }

    // Upload photos
    const result = await handleInventoryMasukPhotos(photos, transactionId, userId)

    if (!result.success) {
      return Response.json(
        { error: 'Upload failed', errors: result.errors },
        { status: 400 }
      )
    }

    // Save photo metadata to database
    await prisma.inventoryMasuk.update({
      where: { id: transactionId },
      data: {
        fotoMetadata: result.photos
      }
    })

    return Response.json({ success: true, photos: result.photos })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Frontend Component Example

```tsx
'use client'

import { useState } from 'react'
import { PhotoMetadata } from '@/types/inventory'

export function InventoryPhotoUpload({ transactionId, type }: {
  transactionId: string
  type: 'masuk' | 'keluar'
}) {
  const [photos, setPhotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoMetadata[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    setUploading(true)
    const formData = new FormData()

    photos.forEach((photo, index) => {
      formData.append(`photo_${index}`, photo)
    })
    formData.append('transactionId', transactionId)
    formData.append('userId', 'current-user-id')

    try {
      const response = await fetch(`/api/inventory/${type}/upload-photos`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setUploadedPhotos(result.photos)
        setPhotos([])
      } else {
        alert('Upload failed: ' + result.errors.join(', '))
      }
    } catch (error) {
      alert('Upload error: ' + error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h3>Upload Photos</h3>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
      />
      <button onClick={handleUpload} disabled={uploading || photos.length === 0}>
        {uploading ? 'Uploading...' : 'Upload Photos'}
      </button>

      {uploadedPhotos.length > 0 && (
        <div>
          <h4>Uploaded Photos:</h4>
          {uploadedPhotos.map((photo, index) => (
            <div key={index}>
              <img src={photo.url} alt={photo.filename} style={{ maxWidth: '200px' }} />
              <p>{photo.caption || photo.filename}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## File Structure

### R2 Cloud Storage
```
uploads/
├── inventory/
│   ├── masuk/
│   │   ├── TXN12345/
│   │   │   ├── 1234567890_TXN12345_photo_1.webp
│   │   │   └── 1234567890_TXN12345_photo_2.webp
│   │   └── TXN12346/
│   │       └── 1234567891_TXN12346_photo_1.webp
│   └── keluar/
│       ├── TXN12347/
│       │   ├── 1234567892_TXN12347_photo_1.webp
│       │   └── 1234567892_TXN12347_photo_2.webp
│       └── ...
└── ...
```

### Local Storage
```
public/uploads/
├── inventory/
│   ├── masuk/
│   │   ├── TXN12345_photo_1.webp
│   │   └── TXN12345_photo_2.webp
│   └── keluar/
│       ├── TXN12346_photo_1.webp
│       └── ...
└── ...
```

## Photo Metadata

When photos are uploaded, their metadata is stored in the database as JSON:

```typescript
interface PhotoMetadata {
  url: string           // Public URL of the photo
  filename: string      // Original filename
  size: number         // File size in bytes
  format: string       // File format (always 'webp' after conversion)
  uploadedAt: string   // ISO timestamp
  uploadedBy?: string  // User ID who uploaded
  caption?: string     // Optional caption
}
```

## Validation Rules

- **File types**: Only image files are accepted (image/*)
- **File size**: Default maximum 5MB per photo
- **Number of photos**: Default maximum 5 photos per transaction
- **Format conversion**: All images are converted to WebP for optimization

## Error Handling

The utility provides comprehensive error handling:

```typescript
try {
  const urls = await uploadInventoryPhotos(files, transactionId, type, uploadDir)
  // Success
} catch (error) {
  // Handle error
  console.error('Upload failed:', error.message)
}
```

Common errors:
- "Tidak ada file gambar yang valid" - No valid image files provided
- "Gagal mengupload foto inventaris: ..." - Upload failed with specific error
- "Maksimal 5 foto yang diizinkan" - Too many photos uploaded
- "File terlalu besar. Maksimal 5MB" - File size exceeded

## Testing

Run the tests to verify functionality:

```bash
npm test -- lib/utils/__tests__/inventory-upload.test.ts
```

## Best Practices

1. Always validate files before upload
2. Use meaningful transaction IDs for photo organization
3. Include user ID for audit trail
4. Handle errors gracefully and provide feedback to users
5. Consider implementing progress indicators for multiple photo uploads
6. Clean up unused photos when transactions are cancelled or deleted