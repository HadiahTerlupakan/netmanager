import Modal from '@/components/common/Modal'
import { MapPickerWithSearch } from '@/components/common/MapPicker'

type PppClientMapPickerModalProps = {
  open: boolean
  onClose: () => void
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lon: number) => void
  roundedClassName: string
}

export function PppClientMapPickerModal({
  open,
  onClose,
  latitude,
  longitude,
  onChange,
  roundedClassName,
}: PppClientMapPickerModalProps) {
  return (
    <Modal
      open={open}
      title="Pilih Titik Koordinat dari Peta"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 ${roundedClassName} hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
          >
            Tutup
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Klik pada peta untuk memilih koordinat. Anda juga dapat mencari alamat menggunakan fitur pencarian.
        </p>
        <MapPickerWithSearch lat={latitude} lon={longitude} height={500} onChange={onChange} />
        {latitude && longitude && (
          <div className={`mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 ${roundedClassName}`}>
            <p className="text-xs font-medium text-indigo-900 dark:text-indigo-300 mb-1">Koordinat Terpilih:</p>
            <p className="text-sm text-indigo-700 dark:text-indigo-400">
              Latitude: {latitude.toFixed(6)}, Longitude: {longitude.toFixed(6)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
