import TemplateForm from '@/components/workorder/TemplateForm'
import Link from 'next/link'
import { HiArrowLeft } from 'react-icons/hi2'

export default function NewTemplatePage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/workorders/templates"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                    <HiArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buat Template Baru</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Buat standar tugas untuk work order.</p>
                </div>
            </div>

            <TemplateForm />
        </div>
    )
}
