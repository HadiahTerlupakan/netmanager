'use client'

import DaftarBarangDipinjam from '../../../components/inventory/DaftarBarangDipinjam'
import { HiOutlineArrowPath } from 'react-icons/hi2'
import Link from 'next/link'

export default function ReturnsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiOutlineArrowPath className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Barang Dipinjam</h1>
              <p className="text-green-100">
                Kelola pengembalian barang ke gudang
              </p>
            </div>
          </div>
          <Link
            href="/employee/inventory"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
          >
            Kembali ke Form
          </Link>
        </div>
      </div>

      {/* Content */}
      <DaftarBarangDipinjam />
    </div>
  )
}