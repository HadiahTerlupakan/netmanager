import { HiArrowPath } from 'react-icons/hi2'

type PppClientDocumentUploadSidebarProps = {
  fileKTP: File | null
  fileRumahSekitar: File | null
  fileBAST: File | null
  scanningKTP: boolean
  ktpScanError: string | null
  ktpScanSuccess: boolean
  onKtpFileChange: (file: File | null) => void | Promise<void>
  onRumahSekitarFileChange: (file: File | null) => void
  onBASTFileChange: (file: File | null) => void
  roundedClassName: string
}

export function PppClientDocumentUploadSidebar({
  fileKTP,
  fileRumahSekitar,
  fileBAST,
  scanningKTP,
  ktpScanError,
  ktpScanSuccess,
  onKtpFileChange,
  onRumahSekitarFileChange,
  onBASTFileChange,
  roundedClassName,
}: PppClientDocumentUploadSidebarProps) {
  return (
    <>
      <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
        Upload Dokumen
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="fileKTP-sidebar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload KTP
          </label>
          <input
            id="fileKTP-sidebar"
            name="fileKTP"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => {
              void onKtpFileChange(e.target.files?.[0] || null)
            }}
            disabled={scanningKTP}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:${roundedClassName} file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400 dark:hover:file:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {fileKTP && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{fileKTP.name} ({(fileKTP.size / 1024).toFixed(2)} KB)</p>
              {scanningKTP && (
                <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  <span>Memproses KTP dan mengisi form otomatis...</span>
                </div>
              )}
              {ktpScanSuccess && (
                <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ${roundedClassName} p-2`}>
                  <p className="text-xs text-green-800 dark:text-green-400">✓ Data KTP berhasil diekstrak dan form telah diisi otomatis</p>
                </div>
              )}
              {ktpScanError && (
                <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${roundedClassName} p-2`}>
                  <p className="text-xs text-red-800 dark:text-red-400">{ktpScanError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="fileRumahSekitar-sidebar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload Rumah Sekitar
          </label>
          <input
            id="fileRumahSekitar-sidebar"
            name="fileRumahSekitar"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => onRumahSekitarFileChange(e.target.files?.[0] || null)}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:${roundedClassName} file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400 dark:hover:file:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
          />
          {fileRumahSekitar && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{fileRumahSekitar.name} ({(fileRumahSekitar.size / 1024).toFixed(2)} KB)</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="fileBAST-sidebar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload BAST
          </label>
          <input
            id="fileBAST-sidebar"
            name="fileBAST"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => onBASTFileChange(e.target.files?.[0] || null)}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:${roundedClassName} file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400 dark:hover:file:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
          />
          {fileBAST && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{fileBAST.name} ({(fileBAST.size / 1024).toFixed(2)} KB)</p>
          )}
        </div>
      </div>
    </>
  )
}
