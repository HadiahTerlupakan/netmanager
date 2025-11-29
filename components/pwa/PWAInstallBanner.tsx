'use client'

import { usePWA } from '@/lib/hooks/usePWA'
import { HiOutlineArrowDownTray } from 'react-icons/hi2'

export function PWAInstallBanner() {
    const { canInstall, installPWA } = usePWA()

    if (!canInstall) return null

    const handleInstall = async () => {
        const installed = await installPWA()
        if (installed) {
            // Show success message
            console.log('App installed successfully!')
        }
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
                    <HiOutlineArrowDownTray className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold mb-1">Install Employee Portal</h3>
                    <p className="text-sm text-indigo-100 mb-3">
                        Get quick access from your home screen
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleInstall}
                            className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                        >
                            Install
                        </button>
                        <button
                            onClick={() => {
                                const banner = document.querySelector('.animate-slide-up')
                                if (banner) {
                                    ; (banner as HTMLElement).style.display = 'none'
                                }
                            }}
                            className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
