import { HiCheckCircle } from 'react-icons/hi2'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface WoActionModalsProps {
    showRejectModal: boolean
    setShowRejectModal: (v: boolean) => void
    rejectReason: string
    setRejectReason: (v: string) => void
    handleReject: () => void

    showCancelModal: boolean
    setShowCancelModal: (v: boolean) => void
    cancelReason: string
    setCancelReason: (v: string) => void
    handleCancel: () => void

    showVerifyModal: boolean
    setShowVerifyModal: (v: boolean) => void
    processVerify: () => void

    showDeleteModal: boolean
    setShowDeleteModal: (v: boolean) => void
    handleDelete: () => void

    processingApproval: boolean
}

export function WoActionModals({
    showRejectModal,
    setShowRejectModal,
    rejectReason,
    setRejectReason,
    handleReject,
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    handleCancel,
    showVerifyModal,
    setShowVerifyModal,
    processVerify,
    showDeleteModal,
    setShowDeleteModal,
    handleDelete,
    processingApproval,
}: WoActionModalsProps) {
    return (
        <>
            {/* Reject Modal */}
            <Modal
                isOpen={showRejectModal}
                onClose={() => {
                    setShowRejectModal(false)
                    setRejectReason('')
                }}
                title="Tolak Hasil Pekerjaan"
                description="Work order akan dikembalikan ke status In Progress. Silakan berikan alasan penolakan untuk petugas."
            >
                <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Alasan penolakan (wajib diisi)..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                />
                <ModalFooter>
                    <button
                        onClick={() => {
                            setShowRejectModal(false)
                            setRejectReason('')
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={processingApproval || !rejectReason.trim()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        {processingApproval ? 'Memproses...' : 'Tolak & Kembalikan'}
                    </button>
                </ModalFooter>
            </Modal>

            {/* Cancel Modal */}
            <Modal
                isOpen={showCancelModal}
                onClose={() => {
                    setShowCancelModal(false)
                    setCancelReason('')
                }}
                title="Batalkan Work Order"
                description="Tindakan ini tidak dapat dibatalkan. Work order akan ditandai sebagai Cancelled."
            >
                <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Alasan pembatalan (wajib diisi)..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                />
                <ModalFooter>
                    <button
                        onClick={() => {
                            setShowCancelModal(false)
                            setCancelReason('')
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Kembali
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={processingApproval || !cancelReason.trim()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        {processingApproval ? 'Memproses...' : 'Batalkan WO'}
                    </button>
                </ModalFooter>
            </Modal>

            {/* Verify Modal */}
            <Modal
                isOpen={showVerifyModal}
                onClose={() => setShowVerifyModal(false)}
                title=""
                showCloseButton={false}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <HiCheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Verifikasi Work Order</h3>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Apakah Anda yakin ingin memverifikasi work order ini?
                    <br />
                    <span className="font-medium text-gray-900 dark:text-white">Status akan berubah menjadi VERIFIED dan stok barang akan terpotong secara permanen.</span>
                </p>

                <ModalFooter>
                    <button
                        onClick={() => setShowVerifyModal(false)}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                        disabled={processingApproval}
                    >
                        Batal
                    </button>
                    <button
                        onClick={processVerify}
                        disabled={processingApproval}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
                    >
                        {processingApproval ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Memproses...
                            </>
                        ) : (
                            'Ya, Verifikasi'
                        )}
                    </button>
                </ModalFooter>
            </Modal>

            {/* Delete Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Hapus Permanen Work Order?"
                description="Tindakan ini tidak dapat dibatalkan. Work Order beserta seluruh data terkait (tasks, history, lampiran) akan dihapus permanen dari database."
            >
                <ModalFooter>
                    <button
                        onClick={() => setShowDeleteModal(false)}
                        disabled={processingApproval}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={processingApproval}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        {processingApproval ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                    </button>
                </ModalFooter>
            </Modal>
        </>
    )
}
