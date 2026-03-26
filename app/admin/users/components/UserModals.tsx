import { Modal, ModalFooter } from '@/components/ui/Modal'
import { HiOutlineTrash, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2'

interface UserModalsProps {
    deleteUserId: string | null
    setDeleteUserId: (id: string | null) => void
    deleting: boolean
    handleDelete: (id: string) => void
    
    forceLogoutUserId: string | null
    setForceLogoutUserId: (id: string | null) => void
    forcingLogout: boolean
    handleForceLogout: (id: string) => void
}

export default function UserModals({
    deleteUserId,
    setDeleteUserId,
    deleting,
    handleDelete,
    forceLogoutUserId,
    setForceLogoutUserId,
    forcingLogout,
    handleForceLogout
}: UserModalsProps) {
    return (
        <>
            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteUserId}
                onClose={() => setDeleteUserId(null)}
                title="Hapus Pengguna?"
                size="md"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <HiOutlineTrash className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Tindakan ini tidak dapat dibatalkan. Semua data terkait pengguna ini akan dihapus secara permanen.
                    </p>
                </div>
                <ModalFooter>
                    <button
                        onClick={() => setDeleteUserId(null)}
                        disabled={deleting}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => handleDelete(deleteUserId!)}
                        disabled={deleting}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                    </button>
                </ModalFooter>
            </Modal>

            {/* Force Logout Confirmation Modal */}
            <Modal
                isOpen={!!forceLogoutUserId}
                onClose={() => setForceLogoutUserId(null)}
                title="Force Logout User?"
                size="md"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <HiOutlineArrowRightOnRectangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        User ini akan di-logout paksa dari semua perangkat (Web & Mobile). User harus login ulang untuk mengakses sistem.
                    </p>
                </div>
                <ModalFooter>
                    <button
                        onClick={() => setForceLogoutUserId(null)}
                        disabled={forcingLogout}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => handleForceLogout(forceLogoutUserId!)}
                        disabled={forcingLogout}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                        {forcingLogout ? 'Memproses...' : 'Ya, Force Logout'}
                    </button>
                </ModalFooter>
            </Modal>
        </>
    )
}
