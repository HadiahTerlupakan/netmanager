'use client'

import { useState } from 'react'
import { FiX, FiCalendar, FiPackage, FiHome, FiUser, FiEdit3, FiPaperclip, FiCamera, FiCheckCircle, FiAlertTriangle, FiXCircle, FiMinusCircle, FiFileText, FiZoomIn } from 'react-icons/fi'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface BarangKeluar {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  isHilang?: boolean
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
  purpose?: string | null
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

interface DetailKeluarModalProps {
  keluar: BarangKeluar | null
  isOpen: boolean
  onClose: () => void
  onEdit?: ((keluar: BarangKeluar) => void) | undefined
}

export function DetailKeluarModal({ keluar, isOpen, onClose, onEdit }: DetailKeluarModalProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  if (!isOpen || !keluar) return null

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

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
    switch (kondisi) {
      case 'BARU': return <span className="flex items-center gap-1"><FiCheckCircle className="w-3 h-3" /> Baru</span>
      case 'BEKAS': return <span className="flex items-center gap-1"><FiAlertTriangle className="w-3 h-3" /> Bekas</span>
      case 'RUSAK': return <span className="flex items-center gap-1"><FiXCircle className="w-3 h-3" /> Rusak</span>
      default: return kondisi
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detail Barang Keluar"
      size="2xl"
    >
      <div className="p-6 space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FiCalendar className="h-4 w-4 mr-1" />
              Tanggal
            </label>
            <p className="text-gray-900 dark:text-white">
              {formatDate(keluar.tanggal)}
            </p>
          </div>
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FiEdit3 className="h-4 w-4 mr-1" />
              Dibuat Pada
            </label>
            <p className="text-gray-900 dark:text-white">
              {formatDate(keluar.createdAt)}
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
              <p className="font-medium text-gray-900 dark:text-white">{keluar.barang.kode}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Nama Barang</label>
              <p className="font-medium text-gray-900 dark:text-white">{keluar.barang.nama}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Jumlah</label>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                -{keluar.jumlah} {keluar.barang.satuan}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Kondisi</label>
              <div className="mt-1 flex flex-col gap-1">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getKondisiBadge(keluar.kondisi)}`}>
                  {getKondisiLabel(keluar.kondisi)}
                </span>
                {keluar.isHilang && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                    <FiMinusCircle className="w-3 h-3" /> HILANG
                  </span>
                )}
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
              <p className="font-medium text-gray-900 dark:text-white">{keluar.gudang.kode}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Nama Gudang</label>
              <p className="font-medium text-gray-900 dark:text-white">{keluar.gudang.nama}</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            <FiUser className="h-4 w-4 mr-2" />
            Diambil Oleh
          </h3>
          {keluar.user ? (
            <div>
              <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <FiUser className="w-4 h-4" /> {keluar.user.name || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {keluar.user.email}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Admin</p>
          )}
        </div>

        {/* Keterangan */}
        {(keluar.keterangan || keluar.purpose) && (
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Keterangan
            </label>
            <div className="space-y-2">
              {keluar.keterangan && (
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  {keluar.keterangan}
                </p>
              )}
              {keluar.purpose && (
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <span className="font-medium flex items-center gap-1"><FiFileText className="w-3 h-3" /> Tujuan: </span>{keluar.purpose}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Foto Bukti */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <FiPaperclip className="h-4 w-4 mr-2" />
            Foto Bukti
          </label>
          {keluar.fotoBukti && keluar.fotoBukti.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>{keluar.fotoBukti.length} foto terlampir</span>
                {keluar.fotoMetadata && (
                  <span>Diupload: {formatDate(keluar.fotoMetadata.uploadedAt || keluar.createdAt)}</span>
                )}
              </div>

              {/* Photo Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {keluar.fotoBukti.map((url, index) => (
                  <div key={index}>
                    {/* Image Container */}
                    <div
                      className="group relative overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                      style={{ minHeight: '200px' }}
                      onClick={() => openLightbox(index)}
                    >
                      <img
                        src={url}
                        alt={`Foto bukti ${index + 1}`}
                        className="w-full h-48 object-contain bg-white dark:bg-gray-900"
                        onError={(e) => {
                          console.error('Failed to load image:', url);
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
                      {/* Hover overlay with zoom icon */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-white/90 text-gray-700">
                          <FiZoomIn className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
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

        {/* Image Lightbox */}
        <ImageLightbox
          images={keluar.fotoBukti || []}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          alt="Foto bukti barang keluar"
        />
      </div>

      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Tutup
        </button>
        {onEdit && (
          <button
            onClick={() => {
              onEdit(keluar)
              onClose()
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center"
          >
            <FiEdit3 className="h-4 w-4 mr-2" />
            Edit
          </button>
        )}
      </ModalFooter>
    </Modal >
  )
}