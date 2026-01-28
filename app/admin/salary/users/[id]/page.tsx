import type { Metadata } from 'next'
import SalaryUserDetailClient from './SalaryUserDetailClient'

export const metadata: Metadata = {
    title: 'Detail Penggajian Karyawan | NetManager',
    description: 'Konfigurasi gaji dan riwayat slip gaji karyawan'
}

export default function SalaryUserDetailPage() {
    return <SalaryUserDetailClient />
}
