import AttendancePageContent from '@/components/attendance/AttendancePageContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Absensi | Portal Karyawan',
    description: 'Halaman absensi harian karyawan',
}

export default function AbsensiPage() {
    return (
        <AttendancePageContent />
    )
}
