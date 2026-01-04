import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'
import { FiCheckCircle, FiXCircle, FiSettings, FiZap } from 'react-icons/fi'
import { Modal, ModalFooter } from '@/components/ui/Modal'

type StatusChangeButtonProps = {
  id: string
  currentStatus: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  apiEndpoint: string
  entityName: string
}

export function StatusChangeButton({ id, currentStatus, apiEndpoint, entityName }: StatusChangeButtonProps) {
  const router = useRouter()
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleUpdate(newStatus: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE') {
    if (loading) return

    setLoading(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        show({
          type: 'success',
          title: 'Berhasil',
          message: `Status ${entityName} berhasil diubah menjadi ${newStatus}`,
        })
        router.refresh()
        setOpen(false)
      } else {
        const json = await res.json()
        const errorMessage = typeof json.error === 'string' ? json.error : 'Gagal mengubah status'
        show({
          type: 'error',
          title: 'Gagal',
          message: errorMessage,
        })
      }
    } catch (error: any) {
      show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Terjadi kesalahan',
      })
    } finally {
      setLoading(false)
    }
  }

  // Render icon-only button to save space
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center h-8 w-8 rounded border transition-colors cursor-pointer ${
          currentStatus === 'AKTIF'
            ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:text-green-400 dark:bg-green-900/20'
            : currentStatus === 'MAINTENANCE'
            ? 'border-yellow-200 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 dark:border-yellow-800 dark:text-yellow-400 dark:bg-yellow-900/20'
            : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20'
        }`}
        title={`Ubah Status (${currentStatus})`}
        aria-label="Ubah Status"
      >
        <FiZap className="h-4 w-4 shrink-0" />
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Update Status ${entityName}`}
        size="sm"
      >
        <div className="space-y-2">
          <button
            onClick={() => handleUpdate('AKTIF')}
            disabled={loading}
            className={`w-full flex items-center justify-between px-4 py-3 rounded border text-left transition-colors ${
              currentStatus === 'AKTIF'
                ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <FiCheckCircle className="w-5 h-5 text-green-500" />
              AKTIF
            </span>
            {currentStatus === 'AKTIF' && <span className="text-xs font-bold text-green-600">CURRENT</span>}
          </button>
          
          <button
            onClick={() => handleUpdate('NONAKTIF')}
            disabled={loading}
            className={`w-full flex items-center justify-between px-4 py-3 rounded border text-left transition-colors ${
              currentStatus === 'NONAKTIF'
                ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <FiXCircle className="w-5 h-5 text-red-500" />
              NONAKTIF
            </span>
            {currentStatus === 'NONAKTIF' && <span className="text-xs font-bold text-red-600">CURRENT</span>}
          </button>

          <button
            onClick={() => handleUpdate('MAINTENANCE')}
            disabled={loading}
            className={`w-full flex items-center justify-between px-4 py-3 rounded border text-left transition-colors ${
              currentStatus === 'MAINTENANCE'
                ? 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <FiSettings className="w-5 h-5 text-yellow-500" />
              MAINTENANCE
            </span>
            {currentStatus === 'MAINTENANCE' && <span className="text-xs font-bold text-yellow-600">CURRENT</span>}
          </button>
        </div>
        <ModalFooter>
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Batal
          </button>
        </ModalFooter>
      </Modal>
    </>
  )
}

