'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { HiPlus, HiPencil, HiTrash, HiArrowLeft, HiBanknotes } from 'react-icons/hi2'
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
  transactions: Transaction[]
}

interface Transaction {
  id: string
  bankAccountId: string
  tanggal: string
  tipeTransaksi: string
  kategori: string
  deskripsi: string
  jumlah: string
  saldoSebelumnya: string
  saldoSetelahnya: string
  nomorReferensi?: string
  createdAt: string
  updatedAt: string
}

interface TransactionFormData {
  bankAccountId: string
  tanggal: string
  tipeTransaksi: string
  kategori: string
  deskripsi: string
  jumlah: string
  nomorReferensi: string
}

export default function BankAccountDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState<TransactionFormData>({
    bankAccountId: params.id as string,
    tanggal: new Date().toISOString().split('T')[0],
    tipeTransaksi: 'DEBIT',
    kategori: '',
    deskripsi: '',
    jumlah: '0',
    nomorReferensi: '',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchBankAccount()
  }, [params.id])

  const fetchBankAccount = async () => {
    try {
      const response = await fetch(`/api/finance/bank-accounts/${params.id}`)
      const data = await response.json()
      
      if (response.ok) {
        setBankAccount(data.data)
      } else {
        setError(data.error || 'Gagal mengambil data rekening bank')
      }
    } catch (error) {
      console.error('Error fetching bank account:', error)
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
      const response = await fetch('/api/finance/bank-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      
      if (response.ok) {
        setSuccess(data.message || 'Berhasil membuat transaksi bank')
        setIsModalOpen(false)
        setIsEditing(false)
        setFormData({
          bankAccountId: params.id as string,
          tanggal: new Date().toISOString().split('T')[0],
          tipeTransaksi: 'DEBIT',
          kategori: '',
          deskripsi: '',
          jumlah: '0',
          nomorReferensi: '',
        })
        fetchBankAccount()
      } else {
        setError(data.error || 'Gagal membuat transaksi bank')
      }
    } catch (error) {
      console.error('Error creating bank transaction:', error)
      setError('Terjadi kesalahan saat membuat transaksi bank')
    }
  }

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return

    try {
      const response = await fetch(`/api/finance/bank-transactions/${selectedTransaction.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      
      if (response.ok) {
        setSuccess(data.message || 'Berhasil menghapus transaksi bank')
        setIsDeleteModalOpen(false)
        setSelectedTransaction(null)
        fetchBankAccount()
      } else {
        setError(data.error || 'Gagal menghapus transaksi bank')
      }
    } catch (error) {
      console.error('Error deleting bank transaction:', error)
      setError('Terjadi kesalahan saat menghapus transaksi bank')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Memuat data...
          </p>
        </div>
      </div>
    )
  }

  if (!bankAccount) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Data Tidak Ditemukan
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Rekening bank tidak ditemukan
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => router.back()}
          >
            <HiArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </button>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => {
              setIsEditing(false)
              setFormData({
                bankAccountId: params.id as string,
                tanggal: new Date().toISOString().split('T')[0],
                tipeTransaksi: 'DEBIT',
                kategori: '',
                deskripsi: '',
                jumlah: '0',
                nomorReferensi: '',
              })
              setError('')
              setSuccess('')
              setIsModalOpen(true)
            }}
          >
            <HiPlus className="inline-block h-4 w-4 mr-2" />
            Tambah Transaksi
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
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
        <div className="rounded-md bg-green-50 p-4 mb-6">
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

      {/* Informasi Rekening Bank */}
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            Informasi Rekening Bank
          </h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nama Bank
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {bankAccount.namaBank}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nomor Rekening
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {bankAccount.nomorRekening}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nama Pemilik
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {bankAccount.namaPemilik}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Saldo Awal
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {formatRupiah(bankAccount.saldoAwal)}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Saldo Saat Ini
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {formatRupiah(bankAccount.saldoSaatIni)}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  bankAccount.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {bankAccount.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Dibuat
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {formatDate(bankAccount.createdAt)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Tabel Transaksi */}
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            Riwayat Transaksi
          </h3>
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tanggal
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipe
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Kategori
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Deskripsi
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Jumlah
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Saldo Sebelumnya
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Saldo Setelahnya
                      </th>
                      <th scope="col" className="relative px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {bankAccount.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          Tidak ada transaksi
                        </td>
                      </tr>
                    ) : (
                      bankAccount.transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            {formatDate(transaction.tanggal)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.tipeTransaksi === 'DEBIT'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.tipeTransaksi}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            {transaction.kategori}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            {transaction.deskripsi}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            {formatRupiah(transaction.jumlah)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            {formatRupiah(transaction.saldoSebelumnya)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            {formatRupiah(transaction.saldoSetelahnya)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                className="text-indigo-600 hover:text-indigo-900"
                                onClick={() => {
                                  setSelectedTransaction(transaction)
                                  setIsEditing(true)
                                  setFormData({
                                    bankAccountId: transaction.bankAccountId,
                                    tanggal: new Date(transaction.tanggal).toISOString().split('T')[0],
                                    tipeTransaksi: transaction.tipeTransaksi,
                                    kategori: transaction.kategori,
                                    deskripsi: transaction.deskripsi,
                                    jumlah: transaction.jumlah,
                                    nomorReferensi: transaction.nomorReferensi || '',
                                  })
                                  setError('')
                                  setSuccess('')
                                  setIsModalOpen(true)
                                }}
                              >
                                <HiPencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-900"
                                onClick={() => {
                                  setSelectedTransaction(transaction)
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
      </div>

      {/* Modal untuk tambah/edit transaksi */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Transaksi Bank' : 'Tambah Transaksi Bank'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tanggal
            </label>
            <input
              id="tanggal"
              type="date"
              value={formData.tanggal}
              onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="tipeTransaksi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipe Transaksi
            </label>
            <select
              id="tipeTransaksi"
              value={formData.tipeTransaksi}
              onChange={(e) => setFormData({ ...formData, tipeTransaksi: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="DEBIT">DEBIT - Masuk</option>
              <option value="KREDIT">KREDIT - Keluar</option>
            </select>
          </div>

          <div>
            <label htmlFor="kategori" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Kategori
            </label>
            <input
              id="kategori"
              type="text"
              value={formData.kategori}
              onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="deskripsi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Deskripsi
            </label>
            <input
              id="deskripsi"
              type="text"
              value={formData.deskripsi}
              onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Jumlah
            </label>
            <input
              id="jumlah"
              type="number"
              value={formData.jumlah}
              onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="nomorReferensi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nomor Referensi
            </label>
            <input
              id="nomorReferensi"
              type="text"
              value={formData.nomorReferensi}
              onChange={(e) => setFormData({ ...formData, nomorReferensi: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
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
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteTransaction}
        title="Hapus Transaksi Bank"
        message={`Apakah Anda yakin ingin menghapus transaksi ${selectedTransaction?.deskripsi}?`}
        confirmText="Hapus"
        cancelText="Batal"
      />
    </div>
  )
}
