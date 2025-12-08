'use client'

import { useState } from 'react'
import { PhotoUpload } from '@/components/inventory/PhotoUpload'

export default function TestPhotoUploadPage() {
  const [transactionId] = useState('test-transaction-' + Date.now())
  const [photos, setPhotos] = useState<any[]>([])
  const [transactionType, setTransactionType] = useState<'inventory-masuk' | 'inventory-keluar'>('inventory-masuk')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Test PhotoUpload Component
          </h1>

          {/* Transaction Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transaction Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="inventory-masuk"
                  checked={transactionType === 'inventory-masuk'}
                  onChange={(e) => setTransactionType(e.target.value as 'inventory-masuk')}
                  className="mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">Barang Masuk</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="inventory-keluar"
                  checked={transactionType === 'inventory-keluar'}
                  onChange={(e) => setTransactionType(e.target.value as 'inventory-keluar')}
                  className="mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">Barang Keluar</span>
              </label>
            </div>
          </div>

          {/* Transaction ID Display */}
          <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Transaction ID:
            </p>
            <p className="text-lg font-mono text-gray-900 dark:text-white">
              {transactionId}
            </p>
          </div>

          {/* PhotoUpload Component */}
          <PhotoUpload
            transactionId={transactionId}
            transactionType={transactionType}
            onPhotosChange={setPhotos}
            maxPhotos={5}
            maxSizeMB={5}
            disabled={false}
            className="mb-6"
          />

          {/* Debug Info */}
          {photos.length > 0 && (
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Debug Info:
              </h3>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                {JSON.stringify(photos, null, 2)}
              </pre>
            </div>
          )}

          {/* Usage Instructions */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              How to use:
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Drag and drop photos onto the dropzone area</li>
              <li>• Click to select photos from your device</li>
              <li>• Maximum 5 photos per transaction</li>
              <li>• Maximum 5MB per photo</li>
              <li>• Supported formats: JPEG, PNG, GIF, WebP</li>
              <li>• Click the "Upload Sekarang" button to upload to server</li>
              <li>• Hover over photos to see the remove button</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}