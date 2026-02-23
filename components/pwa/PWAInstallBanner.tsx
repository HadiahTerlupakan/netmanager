'use client'

import { useState, useEffect } from 'react'
import { usePWA } from '@/lib/hooks/usePWA'
import { Button } from '@/components/ui/Button'
import { HiOutlineArrowDownTray, HiOutlineShare, HiOutlinePlusCircle, HiXMark } from 'react-icons/hi2'

export function PWAInstallBanner() {
    const { canInstall, installPWA, isInstalled } = usePWA()
    const [dismissed, setDismissed] = useState(true) // Start hidden to avoid flash
    const [isIOS, setIsIOS] = useState(false)
    const [showIOSInstructions, setShowIOSInstructions] = useState(false)

    useEffect(() => {
        // Check if already dismissed
        const wasDismissed = localStorage.getItem('pwa-banner-dismissed')

        // Detect iOS
        const userAgent = navigator.userAgent || navigator.vendor
        const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
        const isAndroidDevice = /android/i.test(userAgent)

        // Use setTimeout to avoid synchronous setState
        setTimeout(() => {
            if (wasDismissed) {
                setDismissed(true)
            } else {
                setDismissed(false)
            }
            
            setIsIOS(isIOSDevice)
        }, 0)

        console.log('[PWA Banner] Device detection:', { isIOS: isIOSDevice, isAndroid: isAndroidDevice })
    }, [])

    const handleDismiss = () => {
        localStorage.setItem('pwa-banner-dismissed', 'true')
        setDismissed(true)
    }

    const handleInstall = async () => {
        const installed = await installPWA()
        if (installed) {
            console.log('App installed successfully!')
            handleDismiss()
        }
    }

    // Don't show if already installed or dismissed
    if (isInstalled || dismissed) return null

    // For iOS - show instructions banner (since beforeinstallprompt is not supported)
    if (isIOS) {
        return (
            <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 text-white/70 hover:text-white"
                >
                    <HiXMark className="w-5 h-5" />
                </Button>
                <div className="flex items-start gap-4">
                    <div className="shrink-0 p-2 bg-white/20 rounded-lg">
                        <HiOutlineArrowDownTray className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold mb-1">Install App</h3>
                        {!showIOSInstructions ? (
                            <>
                                <p className="text-sm text-indigo-100 mb-3">
                                    Tambahkan ke Home Screen untuk akses cepat
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowIOSInstructions(true)}
                                    className="bg-white text-indigo-600 border-0 hover:bg-indigo-50"
                                >
                                    Cara Install
                                </Button>
                            </>
                        ) : (
                            <div className="text-sm space-y-2 text-indigo-100">
                                <p className="flex items-center gap-2">
                                    <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                                    <span>Tap <HiOutlineShare className="inline w-4 h-4" /> (Share button)</span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                                    <span>Pilih &quot;Add to Home Screen&quot; <HiOutlinePlusCircle className="inline w-4 h-4" /></span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
                                    <span>Tap &quot;Add&quot;</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // For Android - show install button only if beforeinstallprompt fired
    if (!canInstall) return null

    return (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDismiss}
                className="absolute top-2 right-2 text-white/70 hover:text-white"
            >
                <HiXMark className="w-5 h-5" />
            </Button>
            <div className="flex items-start gap-4">
                <div className="shrink-0 p-2 bg-white/20 rounded-lg">
                    <HiOutlineArrowDownTray className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold mb-1">Install Employee Portal</h3>
                    <p className="text-sm text-indigo-100 mb-3">
                        Akses cepat dari home screen
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleInstall}
                            className="bg-white text-indigo-600 border-0 hover:bg-indigo-50"
                        >
                            Install
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDismiss}
                            className="bg-white/20 text-white hover:bg-white/30"
                        >
                            Nanti
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

