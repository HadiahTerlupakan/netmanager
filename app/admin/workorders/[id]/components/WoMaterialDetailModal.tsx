import { Modal, ModalFooter } from '@/components/ui/Modal'
import type { MaterialDetailData } from '../types'

interface WoMaterialDetailModalProps {
    isOpen: boolean
    onClose: () => void
    data: MaterialDetailData | null
    loading: boolean
}

export function WoMaterialDetailModal({ isOpen, onClose, data, loading }: WoMaterialDetailModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={data?.type === 'keluar' ? 'Detail Barang Keluar' : 'Detail Barang Masuk'}
            size="lg"
        >
            {loading ? (
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    <span className="ml-2 text-gray-600">Memuat detail...</span>
                </div>
            ) : data ? (
                <div className="space-y-5">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                📅 Tanggal
                            </label>
                            <p className="text-gray-900 dark:text-white">
                                {data.tanggal ? new Date(data.tanggal).toLocaleString('id-ID', {
                                    day: '2-digit', month: 'long', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                }) : '-'}
                            </p>
                        </div>
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ✏️ Dibuat Pada
                            </label>
                            <p className="text-gray-900 dark:text-white">
                                {data.createdAt ? new Date(data.createdAt).toLocaleString('id-ID', {
                                    day: '2-digit', month: 'long', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                }) : '-'}
                            </p>
                        </div>
                    </div>

                    {/* Barang Info */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            📦 Informasi Barang
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400">Kode Barang</label>
                                <p className="font-medium text-gray-900 dark:text-white">{data.barang?.kode || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400">Nama Barang</label>
                                <p className="font-medium text-gray-900 dark:text-white">{data.barang?.nama || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400">Jumlah</label>
                                <p className={`text-lg font-bold ${data.type === 'keluar' ? 'text-orange-600' : 'text-green-600'}`}>
                                    {data.type === 'keluar' ? '-' : '+'}{data.jumlah} {data.barang?.satuan || ''}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400">Kondisi</label>
                                <div className="mt-1">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                        data.kondisi === 'BARU'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                            : data.kondisi === 'BEKAS'
                                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>
                                        ✓ {data.kondisi === 'BARU' ? 'Baru' : data.kondisi === 'BEKAS' ? 'Bekas' : 'Rusak'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gudang Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            🏠 Informasi Gudang
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400">Kode Gudang</label>
                                <p className="font-medium text-gray-900 dark:text-white">{data.gudang?.kode || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400">Nama Gudang</label>
                                <p className="font-medium text-gray-900 dark:text-white">{data.gudang?.nama || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* User Info */}
                    {data.user && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                            <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                👤 {data.type === 'keluar' ? 'Diambil Oleh' : 'Dikembalikan Oleh'}
                            </h3>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                    {data.user.name || 'Unknown'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {data.user.email}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Keterangan */}
                    {data.keterangan && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                Keterangan
                            </label>
                            <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-sm">
                                {data.keterangan}
                            </p>
                        </div>
                    )}

                    {/* Foto Bukti */}
                    {data.fotoBukti && data.fotoBukti.length > 0 ? (
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                📎 Foto Bukti
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                {data.fotoBukti.map((url, idx) => (
                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                        <img src={url} alt={`Bukti ${idx + 1}`} className="rounded-lg border-2 border-gray-200 dark:border-gray-600 h-32 w-full object-cover hover:border-indigo-500 transition-colors" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-3xl">📷</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tidak ada foto bukti</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center text-gray-500">
                    Data tidak ditemukan
                </div>
            )}
            <ModalFooter>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                >
                    Tutup
                </button>
            </ModalFooter>
        </Modal>
    )
}
