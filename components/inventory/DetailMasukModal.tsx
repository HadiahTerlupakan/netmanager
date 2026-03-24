import React, { useState } from 'react'
import Modal from '../common/Modal'
import { HiArrowDownTray, HiCalendar, HiUser, HiInformationCircle, HiChatBubbleLeftEllipsis, HiOutlineDocumentText } from 'react-icons/hi2'
import { FiPaperclip, FiZoomIn } from 'react-icons/fi'
import Image from 'next/image'
import { ImageLightbox } from '../ui/ImageLightbox'

interface DetailMasukModalProps {
  isOpen: boolean
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit?: (masuk: any) => void 
  masuk: {
    id?: string
    barangId?: string
    gudangId?: string
    jenis?: string
    kondisi?: string
    tanggal?: string | Date
    createdAt: string | Date
    barang?: {
      nama: string
      satuan: string
      kode?: string
    }
    gudang?: {
      nama: string
      kode?: string
    }
    jumlah: number
    supplier?: string
    noNota?: string
    user?: {
      name: string | null
      role?: string
    } | null
    keterangan?: string | null
    fotoBukti?: string[]
    fotoMetadata?: {
      uploadedAt?: string | Date
    }
  } | null
}

const DetailMasukModal: React.FC<DetailMasukModalProps> = ({ isOpen, onClose, masuk, onEdit }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  if (!masuk) return null

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Detail Barang Masuk">
      <div className="space-y-6">
        {/* Status and Date Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
              {masuk.jenis || 'MASUK'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <HiCalendar className="mr-1.5 h-4 w-4" />
              {formatDate(masuk.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose()
                  onEdit(masuk)
                }}
                className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
              >
                Edit Data
              </button>
            )}
            <button
              onClick={() => {}} 
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              title="Download PDF"
            >
              <HiArrowDownTray className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Information */}
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center">
                <HiInformationCircle className="mr-2 h-4 w-4" />
                Informasi Utama
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Nama Barang</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{masuk.barang?.nama || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Jumlah</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{masuk.jumlah} {masuk.barang?.satuan || 'Unit'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Supplier</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{masuk.supplier || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Nomor Nota</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{masuk.noNota || '-'}</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center">
                <HiUser className="mr-2 h-4 w-4" />
                Dibuat Oleh
              </h3>
              <div className="flex items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {masuk.user?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{masuk.user?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-500">{masuk.user?.role || 'Staff Gudang'}</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center">
                <HiChatBubbleLeftEllipsis className="mr-2 h-4 w-4" />
                Keterangan
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                  &quot;{masuk.keterangan || 'Tidak ada keterangan tambahan.'}&quot;
                </p>
              </div>
            </section>
          </div>

          {/* Right Column: Photos */}
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center">
                <FiPaperclip className="mr-2 h-4 w-4" />
                Foto Bukti & Dokumen
              </h3>
              
              {masuk.fotoBukti && masuk.fotoBukti.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{masuk.fotoBukti.length} foto terlampir</span>
                    {masuk.fotoMetadata && (
                      <span>Diupload: {formatDate(masuk.fotoMetadata.uploadedAt || masuk.createdAt)}</span>
                    )}
                  </div>

                  {/* Photo Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {masuk.fotoBukti.map((url: string, index: number) => (
                      <div
                        key={index}
                        className="group relative overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors h-48"
                        onClick={() => openLightbox(index)}
                      >
                        <Image 
                          fill
                          sizes="(max-width: 640px) 100vw, 300px"
                          src={url}
                          alt={`Foto bukti ${index + 1}`}
                          className="object-contain bg-white dark:bg-gray-900"
                          onError={(e) => {
                            console.error('Failed to load image:', url);
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="flex flex-col items-center justify-center h-full text-gray-400">
                                <svg class="h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p class="text-[10px]">Gagal memuat gambar</p>
                              </div>
                            `;
                          }}
                          loading="eager"
                        />
                        {/* Hover overlay with zoom icon */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-white/90 text-gray-700 shadow-sm">
                            <FiZoomIn className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-gray-400">
                  <HiOutlineDocumentText className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Tidak ada foto bukti terlampir</p>
                  <p className="text-xs mt-1">Gunakan fitur upload foto saat input barang masuk.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <ImageLightbox
        images={masuk.fotoBukti || []}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        initialIndex={lightboxIndex}
      />
    </Modal>
  )
}

export default DetailMasukModal