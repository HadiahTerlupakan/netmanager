import Modal from '@/components/common/Modal'
import { SiteFilter } from '@/components/common/SiteFilter'

import type { BandwidthFormData, BandwidthStatus, BandwidthUnit } from '@/app/admin/paket/bandwidth/lib/bandwidthTypes'

type BandwidthFormModalProps = {
  open: boolean
  editingBandwidthName: string | null
  formData: BandwidthFormData
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
  onFieldChange: <K extends keyof BandwidthFormData>(field: K, value: BandwidthFormData[K]) => void
}

const UNIT_OPTIONS: BandwidthUnit[] = ['k', 'M', 'G', 'T']
const STATUS_OPTIONS: BandwidthStatus[] = ['AKTIF', 'NONAKTIF', 'MAINTENANCE']

function RatePairSection(props: {
  title: string
  required?: boolean
  downloadValue: string
  downloadUnit: BandwidthUnit
  uploadValue: string
  uploadUnit: BandwidthUnit
  onDownloadValueChange: (value: string) => void
  onDownloadUnitChange: (value: BandwidthUnit) => void
  onUploadValueChange: (value: string) => void
  onUploadUnitChange: (value: BandwidthUnit) => void
  placeholders: { download: string; upload: string }
}) {
  const { title, required, downloadValue, downloadUnit, uploadValue, uploadUnit, onDownloadValueChange, onDownloadUnitChange, onUploadValueChange, onUploadUnitChange, placeholders } = props

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {title} Download {required && <span className="text-red-500">*</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              required={required}
              min="0"
              step="0.1"
              value={downloadValue}
              onChange={(event) => onDownloadValueChange(event.target.value)}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder={placeholders.download}
            />
            <select
              value={downloadUnit}
              onChange={(event) => onDownloadUnitChange(event.target.value as BandwidthUnit)}
              className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {title} Upload {required && <span className="text-red-500">*</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              required={required}
              min="0"
              step="0.1"
              value={uploadValue}
              onChange={(event) => onUploadValueChange(event.target.value)}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder={placeholders.upload}
            />
            <select
              value={uploadUnit}
              onChange={(event) => onUploadUnitChange(event.target.value as BandwidthUnit)}
              className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BandwidthFormModal({
  open,
  editingBandwidthName,
  formData,
  onClose,
  onSubmit,
  onFieldChange,
}: BandwidthFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingBandwidthName ? 'Edit Bandwidth' : 'Tambah Bandwidth'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Site <span className="text-red-500">*</span>
          </label>
          <SiteFilter
            isInput
            value={formData.siteId}
            onSiteChange={(id) => onFieldChange('siteId', id || '')}
            resource="bandwidth"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Bandwidth ini akan dikaitkan dengan site yang dipilih.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Bandwidth <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(event) => onFieldChange('name', event.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="Contoh: 10 Mbps"
          />
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Format Queue MikroTik:</strong> Pengaturan ini akan digunakan untuk konfigurasi Simple Queue di MikroTik RouterOS.
            Format: angka + unit (contoh: 10M, 10240k, 1G)
          </p>
        </div>

        <RatePairSection
          title="Max Limit"
          required
          downloadValue={formData.maxLimitDownloadValue}
          downloadUnit={formData.maxLimitDownloadUnit}
          uploadValue={formData.maxLimitUploadValue}
          uploadUnit={formData.maxLimitUploadUnit}
          onDownloadValueChange={(value) => onFieldChange('maxLimitDownloadValue', value)}
          onDownloadUnitChange={(value) => onFieldChange('maxLimitDownloadUnit', value)}
          onUploadValueChange={(value) => onFieldChange('maxLimitUploadValue', value)}
          onUploadUnitChange={(value) => onFieldChange('maxLimitUploadUnit', value)}
          placeholders={{ download: '10', upload: '10' }}
        />

        <RatePairSection
          title="Burst Limit"
          downloadValue={formData.burstLimitDownloadValue}
          downloadUnit={formData.burstLimitDownloadUnit}
          uploadValue={formData.burstLimitUploadValue}
          uploadUnit={formData.burstLimitUploadUnit}
          onDownloadValueChange={(value) => onFieldChange('burstLimitDownloadValue', value)}
          onDownloadUnitChange={(value) => onFieldChange('burstLimitDownloadUnit', value)}
          onUploadValueChange={(value) => onFieldChange('burstLimitUploadValue', value)}
          onUploadUnitChange={(value) => onFieldChange('burstLimitUploadUnit', value)}
          placeholders={{ download: '15', upload: '15' }}
        />

        <RatePairSection
          title="Min Limit"
          downloadValue={formData.minLimitDownloadValue}
          downloadUnit={formData.minLimitDownloadUnit}
          uploadValue={formData.minLimitUploadValue}
          uploadUnit={formData.minLimitUploadUnit}
          onDownloadValueChange={(value) => onFieldChange('minLimitDownloadValue', value)}
          onDownloadUnitChange={(value) => onFieldChange('minLimitDownloadUnit', value)}
          onUploadValueChange={(value) => onFieldChange('minLimitUploadValue', value)}
          onUploadUnitChange={(value) => onFieldChange('minLimitUploadUnit', value)}
          placeholders={{ download: '5', upload: '5' }}
        />

        <RatePairSection
          title="Burst Threshold"
          downloadValue={formData.burstThresholdDownloadValue}
          downloadUnit={formData.burstThresholdDownloadUnit}
          uploadValue={formData.burstThresholdUploadValue}
          uploadUnit={formData.burstThresholdUploadUnit}
          onDownloadValueChange={(value) => onFieldChange('burstThresholdDownloadValue', value)}
          onDownloadUnitChange={(value) => onFieldChange('burstThresholdDownloadUnit', value)}
          onUploadValueChange={(value) => onFieldChange('burstThresholdUploadValue', value)}
          onUploadUnitChange={(value) => onFieldChange('burstThresholdUploadUnit', value)}
          placeholders={{ download: '12', upload: '12' }}
        />

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Burst Time Download (detik)</label>
            <input
              type="number"
              min="0"
              value={formData.burstTimeDownload || ''}
              onChange={(event) => onFieldChange('burstTimeDownload', event.target.value ? parseInt(event.target.value, 10) : undefined)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="15"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Burst Time Upload (detik)</label>
            <input
              type="number"
              min="0"
              value={formData.burstTimeUpload || ''}
              onChange={(event) => onFieldChange('burstTimeUpload', event.target.value ? parseInt(event.target.value, 10) : undefined)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="15"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority (1-8)</label>
            <input
              type="number"
              min="1"
              max="8"
              value={formData.priority || ''}
              onChange={(event) => onFieldChange('priority', event.target.value ? parseInt(event.target.value, 10) : undefined)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="8"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
          <textarea
            value={formData.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            rows={3}
            placeholder="Deskripsi bandwidth"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(event) => onFieldChange('status', event.target.value as BandwidthStatus)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {editingBandwidthName ? 'Update' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
