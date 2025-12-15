'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdArrowBack,
    MdMailOutline,
    MdLockOutline,
    MdVisibility,
    MdVisibilityOff
} from 'react-icons/md'
import Link from 'next/link'
import Image from 'next/image'

export default function KaryawanLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { login } = useKaryawanAuth()
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const result = await login(email, password)
            if (result.success) {
                // Use window.location for full page reload to ensure session is loaded
                window.location.href = '/karyawan/dashboard'
            } else {
                setError(result.error || 'Login gagal')
            }
        } catch {
            setError('Terjadi kesalahan. Silakan coba lagi.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] font-sans text-[#111418] dark:text-white overflow-x-hidden antialiased flex flex-col items-center justify-center">
            <div className="relative flex h-full w-full max-w-md mx-auto flex-col bg-white dark:bg-[#101922] shadow-sm min-h-screen md:min-h-0 md:h-auto md:rounded-xl md:shadow-xl md:my-8 overflow-hidden">
                {/* Header */}
                <div className="flex items-center p-4 pb-2 justify-between sticky top-0 z-10 bg-white/90 dark:bg-[#101922]/90 backdrop-blur-sm">
                    <Link href="/" className="text-[#111418] dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <MdArrowBack className="text-2xl" />
                    </Link>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
                        Portal Karyawan
                    </h2>
                </div>

                <div className="flex-1 flex flex-col w-full justify-center">
                    {/* Hero Logo */}
                    <div className="flex items-center justify-center px-4 pt-4 pb-4">
                        <div className="relative w-80 h-32">
                            <Image
                                src="/images/logo-sbl.png"
                                alt="Logo NetManager"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>

                    {/* Welcome Text */}
                    <div className="px-4 pb-2 pt-4">
                        <h1 className="text-[#111418] dark:text-white tracking-tight text-[28px] font-bold leading-tight text-center">
                            Portal Karyawan
                        </h1>
                        <p className="text-[#617589] dark:text-gray-400 text-base font-normal leading-normal pt-2 text-center">
                            Masuk untuk mengakses work order dan inventaris
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-6">
                        <label className="flex flex-col min-w-40 flex-1">
                            <p className="text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2">Email</p>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#617589]">
                                    <MdMailOutline className="text-[20px]" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-0 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 h-12 placeholder:text-[#617589] pl-12 pr-4 text-base font-normal leading-normal transition-all"
                                    placeholder="email@perusahaan.com"
                                    required
                                />
                            </div>
                        </label>

                        <label className="flex flex-col min-w-40 flex-1">
                            <div className="flex justify-between items-center pb-2">
                                <p className="text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal">Kata Sandi</p>
                            </div>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#617589]">
                                    <MdLockOutline className="text-[20px]" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-0 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 h-12 placeholder:text-[#617589] pl-12 pr-12 text-base font-normal leading-normal transition-all"
                                    placeholder="Masukkan kata sandi"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#617589] hover:text-blue-500 transition-colors"
                                >
                                    {showPassword ? (
                                        <MdVisibilityOff className="text-[20px]" />
                                    ) : (
                                        <MdVisibility className="text-[20px]" />
                                    )}
                                </button>
                            </div>
                        </label>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50">
                                <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-blue-600 text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-blue-700 transition-colors shadow-md mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <span className="truncate">
                                {isLoading ? 'Memproses...' : 'Masuk'}
                            </span>
                        </button>
                    </form>

                    <div className="p-4 pb-8 text-center mt-auto">
                        <p className="text-[#617589] dark:text-gray-400 text-sm">
                            Lupa kata sandi?
                            <span className="text-blue-600 font-semibold hover:underline ml-1 cursor-pointer">Hubungi Admin</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
