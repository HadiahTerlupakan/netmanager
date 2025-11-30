'use client'

import { HiOutlineShieldExclamation } from 'react-icons/hi2'
import { useRouter } from 'next/navigation'

export default function AccessDeniedPage() {
    const router = useRouter()

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
                    <HiOutlineShieldExclamation className="w-16 h-16 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">
                    You don't have permission to access the Helpdesk Portal.
                    This portal is only accessible to employees in the IT, Support, or Technical departments.
                </p>
                <div className="space-y-3">
                    <button
                        onClick={() => router.push('/employee')}
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Go to Employee Portal
                    </button>
                    <button
                        onClick={() => router.push('/helpdesk/login')}
                        className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    )
}
