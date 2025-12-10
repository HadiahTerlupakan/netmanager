'use client'

import { FiX, FiCalendar, FiPackage, FiHome, FiUser, FiEdit3, FiPaperclip, FiCamera } from 'react-icons/fi'

interface BarangMasuk {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
  fotoBukti: string[]
  fotoMetadata?: any
  barang: {
    id: string
    kode: string
    nama: string
    satuan: string
  }
  gudang: {
    id: string
    kode: string
    nama: string
  }
  user?: {
    id: string
    name: string | null
    email: string
  } | null
}

interface DetailMasukModalProps {
  masuk: BarangMasuk | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (masuk: BarangMasuk) => void
}

export function DetailMasukModal({ masuk, isOpen, onClose, onEdit }: DetailMasukModalProps) {
  if (!isOpen || !masuk) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getKondisiBadge = (kondisi: string) => {
    const styles = {
      BARU: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      BEKAS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      RUSAK: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    }
    return styles[kondisi as keyof typeof styles] || styles.BARU
  }

  const getKondisiLabel = (kondisi: string) => {
    const labels = {
      BARU: '🟢 Baru',
      BEKAS: '🟡 Bekas',
      RUSAK: '🔴 Rusak'
    }
    return labels[kondisi as keyof typeof labels] || labels.BARU
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 ease-out scale-100 opacity-100">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Detail Barang Masuk
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-all duration-200"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FiCalendar className="h-4 w-4 mr-1" />
                  Tanggal
                </label>
                <p className="text-gray-900 dark:text-white">
                  {formatDate(masuk.tanggal)}
                </p>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FiEdit3 className="h-4 w-4 mr-1" />
                  Dibuat Pada
                </label>
                <p className="text-gray-900 dark:text-white">
                  {formatDate(masuk.createdAt)}
                </p>
              </div>
            </div>

            {/* Barang Info */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <FiPackage className="h-4 w-4 mr-2" />
                Informasi Barang
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Kode Barang</label>
                  <p className="font-medium text-gray-900 dark:text-white">{masuk.barang.kode}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Nama Barang</label>
                  <p className="font-medium text-gray-900 dark:text-white">{masuk.barang.nama}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Jumlah</label>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    +{masuk.jumlah} {masuk.barang.satuan}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Kondisi</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getKondisiBadge(masuk.kondisi)}`}>
                      {getKondisiLabel(masuk.kondisi)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gudang Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <FiHome className="h-4 w-4 mr-2" />
                Informasi Gudang
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Kode Gudang</label>
                  <p className="font-medium text-gray-900 dark:text-white">{masuk.gudang.kode}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Nama Gudang</label>
                  <p className="font-medium text-gray-900 dark:text-white">{masuk.gudang.nama}</p>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <FiUser className="h-4 w-4 mr-2" />
                Diproses Oleh
              </h3>
              {masuk.user ? (
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    👤 {masuk.user.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {masuk.user.email}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">System</p>
              )}
            </div>

            {/* Keterangan */}
            {masuk.keterangan && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Keterangan
                </label>
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  {masuk.keterangan}
                </p>
              </div>
            )}

            {/* Foto Bukti */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <FiPaperclip className="h-4 w-4 mr-2" />
                Foto Bukti
              </label>
              {masuk.fotoBukti && masuk.fotoBukti.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{masuk.fotoBukti.length} foto terlampir</span>
                    {masuk.fotoMetadata && (
                      <span>Diupload: {formatDate(masuk.fotoMetadata.uploadedAt || masuk.createdAt)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {masuk.fotoBukti.map((url, index) => (
                      <div
                        key={index}
                        className="relative overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer"
                        style={{ minHeight: '200px' }}
                        onClick={() => window.open(url, '_blank')}
                      >
                        <img
                          src={url}
                          alt={`Foto bukti ${index + 1}`}
                          className="w-full h-48 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="flex flex-col items-center justify-center h-48 text-gray-400">
                                <svg class="h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p class="text-sm">Gagal memuat gambar</p>
                              </div>
                            `;
                          }}
                          loading="eager"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <FiCamera className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada foto bukti</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
            >
              Tutup
            </button>
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(masuk)
                  onClose()
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center"
              >
                <FiEdit3 className="h-4 w-4 mr-2" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}