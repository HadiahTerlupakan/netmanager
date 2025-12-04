'use client'

import { useState, useEffect, Suspense } from 'react'

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { HiPlus, HiPencil, HiTrash, HiEye, HiBanknotes } from 'react-icons/hi2'
import Modal from '@/components/common/Modal'
import ConfirmDialog from '@/components/common/ConfirmDialog'

interface BankAccount {
  id: string
  namaBank: string
  nomorRekening: string
  namaPemilik: string
  saldoAwal: string
  saldoSaatIni: string
  mataUang: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface BankAccountFormData {
  namaBank: string
  nomorRekening: string
  namaPemilik: string
  saldoAwal: string
  mataUang: string
  isActive: boolean
}

function BankAccountsContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [formData, setFormData] = useState<BankAccountFormData>({
    namaBank: '',
    nomorRekening: '',
    namaPemilik: '',
    saldoAwal: '0',
    mataUang: 'IDR',
    isActive: true,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchBankAccounts()
  }, [])

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/finance/bank-accounts')
      const data = await response.json()

      if (response.ok) {
        setBankAccounts(data.data)
      } else {
        setError(data.error || 'Gagal mengambil data rekening bank')
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
      setError('Terjadi kesalahan saat mengambil data rekening bank')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const url = isEditing
        ? `/api/finance/bank-accounts/${selectedAccount?.id}`
        : '/api/finance/bank-accounts'

      const method = isEditing ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message || 'Berhasil menyimpan rekening bank')
        setIsModalOpen(false)
        setIsEditing(false)
        setFormData({
          namaBank: '',
          nomorRekening: '',
          namaPemilik: '',
          saldoAwal: '0',
          mataUang: 'IDR',
          isActive: true,
        })
        fetchBankAccounts()
      } else {
        setError(data.error || 'Gagal menyimpan rekening bank')
      }
    } catch (error) {
      console.error('Error saving bank account:', error)
      setError('Terjadi kesalahan saat menyimpan rekening bank')
    }
  }

  const handleEdit = (account: BankAccount) => {
    setSelectedAccount(account)
    setFormData({
      namaBank: account.namaBank,
      nomorRekening: account.nomorRekening,
      namaPemilik: account.namaPemilik,
      saldoAwal: account.saldoAwal,
      mataUang: account.mataUang,
      isActive: account.isActive,
    })
    setIsEditing(true)
    setIsModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleDelete = async () => {
    if (!selectedAccount) return

    try {
      const response = await fetch(`/api/finance/bank-accounts/${selectedAccount.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message || 'Berhasil menghapus rekening bank')
        setIsDeleteModalOpen(false)
        setSelectedAccount(null)
        fetchBankAccounts()
      } else {
        setError(data.error || 'Gagal menghapus rekening bank')
      }
    } catch (error) {
      console.error('Error deleting bank account:', error)
      setError('Terjadi kesalahan saat menghapus rekening bank')
    }
  }

  const formatRupiah = (amount: string) => {
    const numAmount = Number(amount)
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(numAmount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Akses Ditolak
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Anda harus login untuk mengakses halaman ini
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate">
            Manajemen Rekening Bank
          </h1>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => {
              setIsEditing(false)
              setFormData({
                namaBank: '',
                nomorRekening: '',
                namaPemilik: '',
                saldoAwal: '0',
                mataUang: 'IDR',
                isActive: true,
              })
              setError('')
              setSuccess('')
              setIsModalOpen(true)
            }}
          >
            <HiPlus className="inline-block h-4 w-4 mr-2" />
            Tambah Rekening
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <HiTrash className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <HiBanknotes className="h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Sukses</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>{success}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nama Bank
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nomor Rekening
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nama Pemilik
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Saldo Awal
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Saldo Saat Ini
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="relative px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Memuat data...
                      </td>
                    </tr>
                  ) : bankAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Tidak ada data rekening bank
                      </td>
                    </tr>
                  ) : (
                    bankAccounts.map((account) => (
                      <tr key={account.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                          {account.namaBank}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                          {account.nomorRekening}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                          {account.namaPemilik}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                          {formatRupiah(account.saldoAwal)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                          {formatRupiah(account.saldoSaatIni)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${account.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                            {account.isActive ? 'Aktif' : 'Tidak Aktif'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              className="text-indigo-600 hover:text-indigo-900"
                              onClick={() => router.push(`/finance/bank-accounts/${account.id}`)}
                            >
                              <HiEye className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="text-indigo-600 hover:text-indigo-900"
                              onClick={() => handleEdit(account)}
                            >
                              <HiPencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-900"
                              onClick={() => {
                                setSelectedAccount(account)
                                setIsDeleteModalOpen(true)
                              }}
                            >
                              <HiTrash className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal untuk tambah/edit rekening bank */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Rekening Bank' : 'Tambah Rekening Bank'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="namaBank" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nama Bank
            </label>
            <input
              id="namaBank"
              type="text"
              value={formData.namaBank}
              onChange={(e) => setFormData({ ...formData, namaBank: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="nomorRekening" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nomor Rekening
            </label>
            <input
              id="nomorRekening"
              type="text"
              value={formData.nomorRekening}
              onChange={(e) => setFormData({ ...formData, nomorRekening: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="namaPemilik" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nama Pemilik
            </label>
            <input
              id="namaPemilik"
              type="text"
              value={formData.namaPemilik}
              onChange={(e) => setFormData({ ...formData, namaPemilik: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="saldoAwal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Saldo Awal
            </label>
            <input
              id="saldoAwal"
              type="number"
              value={formData.saldoAwal}
              onChange={(e) => setFormData({ ...formData, saldoAwal: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="mataUang" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Mata Uang
            </label>
            <select
              id="mataUang"
              value={formData.mataUang}
              onChange={(e) => setFormData({ ...formData, mataUang: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="IDR">IDR - Rupiah</option>
              <option value="USD">USD - Dollar</option>
              <option value="EUR">EUR - Euro</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900 dark:text-white">
              Aktif
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {isEditing ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal konfirmasi hapus */}
      <ConfirmDialog
        open={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Rekening Bank"
        description={`Apakah Anda yakin ingin menghapus rekening bank ${selectedAccount?.namaBank} - ${selectedAccount?.nomorRekening}?`}
        confirmText="Hapus"
        cancelText="Batal"
      />
    </div>
  )
}

// Wrapper component with Suspense boundary
export default function BankAccountsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <BankAccountsContent />
    </Suspense>
  )
}
