import { useState } from 'react'

import { isSupportedKtpImage, mergeKtpDataIntoPppForm, scanKtpOcr } from '@/app/admin/pelanggan/ppp/shared/ktpScan'

type CommonPppFormData = {
  nama: string
  noDokumen: string
  alamat: string
  kabupatenKota: string
  kelurahanDesa: string
  kecamatan: string
  provinsi: string
}

type UsePppDocumentUploadsOptions<T extends CommonPppFormData> = {
  setFormData: React.Dispatch<React.SetStateAction<T>>
  setActiveTab: React.Dispatch<React.SetStateAction<'paket' | 'info'>>
}

export function usePppDocumentUploads<T extends CommonPppFormData>({ setFormData, setActiveTab }: UsePppDocumentUploadsOptions<T>) {
  const [fileKTP, setFileKTP] = useState<File | null>(null)
  const [fileRumahSekitar, setFileRumahSekitar] = useState<File | null>(null)
  const [fileBAST, setFileBAST] = useState<File | null>(null)
  const [scanningKTP, setScanningKTP] = useState(false)
  const [ktpScanError, setKtpScanError] = useState<string | null>(null)
  const [ktpScanSuccess, setKtpScanSuccess] = useState(false)

  const handleScanKTP = async (file?: File) => {
    const fileToScan = file || fileKTP

    if (!fileToScan) {
      setKtpScanError('Silakan pilih file KTP terlebih dahulu')
      return
    }

    if (!isSupportedKtpImage(fileToScan)) {
      setKtpScanError('File harus berupa gambar (PNG, JPG, JPEG)')
      return
    }

    try {
      setScanningKTP(true)
      setKtpScanError(null)
      const ktpData = await scanKtpOcr(fileToScan)
      setFormData((prev) => mergeKtpDataIntoPppForm(prev, ktpData))
      setKtpScanError(null)
      setKtpScanSuccess(true)
      setTimeout(() => {
        setKtpScanSuccess(false)
      }, 3000)
    } catch (err: unknown) {
      console.error('Error scanning KTP:', err)
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses KTP'
      setKtpScanError(errorMessage)
      setKtpScanSuccess(false)
    } finally {
      setScanningKTP(false)
    }
  }

  const handleSidebarKtpFileChange = async (file: File | null) => {
    setFileKTP(file)
    setKtpScanError(null)
    setKtpScanSuccess(false)

    if (file && file.type.startsWith('image/')) {
      setActiveTab('info')
      setTimeout(async () => {
        try {
          await handleScanKTP(file)
        } catch (error) {
          console.error('Error in onChange handler:', error)
          setKtpScanError('Terjadi kesalahan saat memproses KTP')
          setScanningKTP(false)
        }
      }, 100)
      return
    }

    if (file) {
      setKtpScanError('File harus berupa gambar (PNG, JPG, JPEG)')
    }
  }

  return {
    fileKTP,
    fileRumahSekitar,
    fileBAST,
    scanningKTP,
    ktpScanError,
    ktpScanSuccess,
    setFileKTP,
    setFileRumahSekitar,
    setFileBAST,
    handleScanKTP,
    handleSidebarKtpFileChange,
    handleSidebarRumahSekitarFileChange: (file: File | null) => setFileRumahSekitar(file),
    handleSidebarBASTFileChange: (file: File | null) => setFileBAST(file),
  }
}
