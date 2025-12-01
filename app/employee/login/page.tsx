'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineUser, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeSlash } from 'react-icons/hi2'

export default function KaryawanLoginPage() {
    const router = useRouter()
    const [employeeId, setEmployeeId] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const result = await signIn('credentials', {
                username: employeeId,
                password: password,
                redirect: false,
            })

            if (result?.error) {
                setError('Invalid Employee ID or Password')
            } else if (result?.ok) {
                router.push('/employee')
            }
        } catch (err) {
            setError('Login failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            {/* Login Card */}
            <div className="relative w-full max-w-md">
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
                    {/* Logo & Title */}
                    <div className="text-center mb-8">
                        <div className="inline-block p-4 bg-white/20 backdrop-blur rounded-2xl mb-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-white to-indigo-100 rounded-xl flex items-center justify-center">
                                <span className="text-3xl font-bold text-indigo-600">E</span>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Employee Portal</h1>
                        <p className="text-indigo-100">Sign in to access your dashboard</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl backdrop-blur">
                            <p className="text-red-100 text-sm text-center">{error}</p>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                        {/* Employee ID */}
                        <div>
                            <label className="block text-white text-base sm:text-sm font-medium mb-2 sm:mb-2">
                                Employee ID
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                                    <HiOutlineUser className="w-6 h-6 sm:w-5 sm:h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    placeholder="Enter your Employee ID"
                                    autoComplete="username"
                                    className="w-full pl-14 sm:pl-12 pr-4 py-4 sm:py-3 min-h-[56px] sm:min-h-[48px] bg-white/20 border border-white/30 rounded-xl text-base sm:text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur transition-all touch-manipulation"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-white text-base sm:text-sm font-medium mb-2 sm:mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                                    <HiOutlineLockClosed className="w-6 h-6 sm:w-5 sm:h-5" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    className="w-full pl-14 sm:pl-12 pr-14 sm:pr-12 py-4 sm:py-3 min-h-[56px] sm:min-h-[48px] bg-white/20 border border-white/30 rounded-xl text-base sm:text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur transition-all touch-manipulation"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <HiOutlineEyeSlash className="w-6 h-6 sm:w-5 sm:h-5" />
                                    ) : (
                                        <HiOutlineEye className="w-6 h-6 sm:w-5 sm:h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                            <label className="flex items-center touch-manipulation cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 sm:w-4 sm:h-4 rounded border-white/30 bg-white/20 text-indigo-600 focus:ring-white/50 touch-manipulation"
                                />
                                <span className="ml-2 text-base sm:text-sm text-white">Remember me</span>
                            </label>
                            <a href="#" className="text-base sm:text-sm text-white hover:text-indigo-100 transition-colors touch-manipulation min-h-[44px] flex items-center">
                                Forgot password?
                            </a>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 sm:py-3.5 min-h-[56px] sm:min-h-[48px] bg-white text-indigo-600 rounded-xl font-semibold text-base sm:text-sm shadow-lg hover:shadow-xl hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-6 h-6 sm:w-5 sm:h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Additional Info */}
                    <div className="mt-6 sm:mt-8 text-center">
                        <p className="text-white/70 text-base sm:text-sm">
                            Don't have access?{' '}
                            <a href="#" className="text-white font-medium hover:text-indigo-100 transition-colors touch-manipulation">
                                Contact HR
                            </a>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-white/60 text-sm">
                        © 2024 NetManager. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}
