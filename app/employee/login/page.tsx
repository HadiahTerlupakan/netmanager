'use client'

import { signIn, useSession } from 'next-auth/react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  HiOutlineUser,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlineExclamationTriangle,
  HiOutlineShieldCheck,
  HiOutlineKey
} from 'react-icons/hi2'

// Form validation types
interface FormErrors {
  identifier?: string
  password?: string
  general?: string
}


// Password recovery types
interface RecoveryStep {
  email: string
  code: string
  newPassword: string
  confirmPassword: string
}

export default function KaryawanLoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/employee'

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl)
    }
  }, [status, router, callbackUrl])

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({})

  // Password recovery state
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryStep, setRecoveryStep] = useState(1)
  const [recoveryData, setRecoveryData] = useState<RecoveryStep>({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoverySuccess, setRecoverySuccess] = useState('')

  // Refs for accessibility
  const identifierRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Debounce for validation
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout
    return (...args: any[]) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func(...args), delay)
    }
  }, [])


  // Form validation
  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case 'identifier':
        if (!value.trim()) return 'Employee ID or Email is required'

        // Check if it's an email format
        if (value.includes('@')) {
          // Email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) {
            return 'Please enter a valid email address'
          }
        } else {
          // Employee ID validation
          if (!/^[A-Z0-9]{4,10}$/i.test(value)) {
            return 'Employee ID must be 4-10 alphanumeric characters'
          }
        }
        break
      case 'password':
        if (!value) return 'Password is required'
        break
    }
    return undefined
  }, [])

  // Real-time validation with debouncing
  const debouncedValidation = useCallback(debounce((field: string, value: string) => {
    const error = validateField(field, value)
    setErrors(prev => ({ ...prev, [field]: error }))
  }, 300), [validateField, debounce])

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    switch (field) {
      case 'identifier':
        setIdentifier(value)
        break
      case 'password':
        setPassword(value)
        break
    }

    if (touched[field]) {
      debouncedValidation(field, value)
    }
  }

  // Handle field blur
  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    const value = field === 'identifier' ? identifier : password
    const error = validateField(field, value)
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  // Check if form is valid
  const isFormValid = identifier.trim() &&
    password.trim() &&
    !errors.identifier &&
    !errors.password

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check for autofill values that might not have triggered state updates
    let currentIdentifier = identifier
    let currentPassword = password

    if (identifierRef.current && identifierRef.current.value !== identifier) {
      currentIdentifier = identifierRef.current.value
      setIdentifier(currentIdentifier)
    }

    if (passwordRef.current && passwordRef.current.value !== password) {
      currentPassword = passwordRef.current.value
      setPassword(currentPassword)
    }

    // Validate all fields using potentially updated values
    const identifierError = validateField('identifier', currentIdentifier)
    const passwordError = validateField('password', currentPassword)

    setErrors({
      identifier: identifierError,
      password: passwordError,
      general: identifierError || passwordError ? 'Please fix the errors above' : ''
    })

    if (identifierError || passwordError) {
      // Focus on first error field
      if (identifierError && identifierRef.current) {
        identifierRef.current.focus()
      } else if (passwordError && passwordRef.current) {
        passwordRef.current.focus()
      }
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const result = await signIn('credentials', {
        username: currentIdentifier,
        password: currentPassword,
        redirect: false,
      })

      if (result?.error) {
        // Handle different types of errors with specific messages
        if (result.error.includes('Terlalu banyak percobaan')) {
          setErrors({ general: 'Terlalu banyak percobaan login. Silakan coba lagi dalam beberapa menit.' })
        } else if (result.error.includes('Database connection error')) {
          setErrors({ general: 'Sistem sedang bermasalah. Silakan coba lagi dalam beberapa saat.' })
        } else if (result.error.includes('Employee account is not properly linked')) {
          setErrors({ general: 'Akun karyawan belum terhubung dengan benar. Silakan hubungi HR.' })
        } else if (result.error.includes('rate limit')) {
          setErrors({ general: 'Terlalu banyak percobaan login. Akun sementara diblokir.' })
        } else {
          setErrors({ general: 'Employee ID/Email atau Password tidak valid. Silakan periksa kembali.' })
        }
      } else if (result?.ok) {
        // Use window.location.href like Admin login to ensure session cookie is properly set
        // router.push doesn't force a full page reload which can cause session issues
        const targetPath = callbackUrl || '/employee'
        console.log('[EMPLOYEE-LOGIN] Login successful, redirecting to:', targetPath)
        window.location.href = targetPath
      } else {
        setErrors({ general: 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.' })
      }
    } catch (err: any) {
      console.error('[LOGIN] Error during sign in:', err)

      // Handle network errors or other exceptions
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setErrors({ general: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' })
      } else if (err.message) {
        setErrors({ general: err.message })
      } else {
        setErrors({ general: 'Login gagal. Silakan coba lagi nanti.' })
      }
    } finally {
      setLoading(false)
    }
  }

  // Password recovery handlers
  const handleRecoveryStep1 = async () => {
    if (!recoveryData.email) {
      setRecoveryError('Email or Employee ID is required')
      return
    }

    // Validate email or employee ID format
    if (recoveryData.email.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(recoveryData.email)) {
        setRecoveryError('Please enter a valid email address')
        return
      }
    } else {
      if (!/^[A-Z0-9]{4,10}$/i.test(recoveryData.email)) {
        setRecoveryError('Employee ID must be 4-10 alphanumeric characters')
        return
      }
    }

    setRecoveryLoading(true)
    setRecoveryError('')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      setRecoveryStep(2)
      setRecoverySuccess('Recovery code sent to your email')
    } catch (error) {
      setRecoveryError('Failed to send recovery code')
    } finally {
      setRecoveryLoading(false)
    }
  }

  const handleRecoveryStep2 = async () => {
    if (!recoveryData.code) {
      setRecoveryError('Verification code is required')
      return
    }

    setRecoveryLoading(true)
    setRecoveryError('')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      setRecoveryStep(3)
      setRecoverySuccess('Code verified. Please set a new password.')
    } catch (error) {
      setRecoveryError('Invalid verification code')
    } finally {
      setRecoveryLoading(false)
    }
  }

  const handleRecoveryStep3 = async () => {
    if (!recoveryData.newPassword || !recoveryData.confirmPassword) {
      setRecoveryError('All fields are required')
      return
    }

    if (recoveryData.newPassword !== recoveryData.confirmPassword) {
      setRecoveryError('Passwords do not match')
      return
    }

    setRecoveryLoading(true)
    setRecoveryError('')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      setRecoveryStep(4)
      setRecoverySuccess('Password reset successful! Redirecting to login...')

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        setShowRecovery(false)
        setRecoveryStep(1)
        setRecoveryData({
          email: '',
          code: '',
          newPassword: '',
          confirmPassword: ''
        })
        setRecoverySuccess('')
      }, 3000)
    } catch (error) {
      setRecoveryError('Failed to reset password')
    } finally {
      setRecoveryLoading(false)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showRecovery) {
        setShowRecovery(false)
        setRecoveryStep(1)
        setRecoveryError('')
        setRecoverySuccess('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showRecovery])

  // Focus management for error announcements
  useEffect(() => {
    if (errors.general && errorRef.current) {
      errorRef.current.focus()
    }
  }, [errors.general])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 safe-area-inset-top safe-area-inset-bottom">
      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="glass-card p-8 md:p-12 transition-all duration-300">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 neumorphic-soft rounded-lg mb-4 transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg">
                <span className="text-3xl font-bold text-white">E</span>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 transition-colors duration-300">Employee Portal</h1>
            <p className="opacity-70 text-lg transition-colors duration-300">Sign in to access your dashboard</p>
          </div>

          {/* Error Message */}
          {errors.general && (
            <div
              ref={errorRef}
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-all duration-300"
              role="alert"
              aria-live="polite"
              tabIndex={-1}
            >
              <div className="flex items-center gap-3">
                <HiOutlineExclamationTriangle className="w-5 h-5 text-red-600 dark:text-red-400 transition-colors duration-300" />
                <p className="text-red-600 dark:text-red-400 text-sm transition-colors duration-300">{errors.general}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Employee ID or Email */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium mb-2"
              >
                Employee ID or Email
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60 transition-opacity duration-300 pointer-events-none">
                  <HiOutlineUser className="w-5 h-5" />
                </div>
                <input
                  ref={identifierRef}
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => handleInputChange('identifier', e.target.value)}
                  onBlur={() => handleFieldBlur('identifier')}
                  placeholder="Enter your Employee ID or Email"
                  autoComplete="username"
                  aria-describedby="identifier-error identifier-hint"
                  aria-invalid={!!errors.identifier}
                  className={`w-full py-4 min-h-[56px] md:min-h-[56px] input-neumorphic input-with-left-icon mobile-touch-target transition-all duration-300 ${errors.identifier ? 'border-red-500 dark:border-red-400' : ''
                    }`}
                  required
                  aria-required="true"
                />
              </div>
              {errors.identifier && (
                <p id="identifier-error" className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1 transition-colors duration-300">
                  <HiOutlineXMark className="w-4 h-4" />
                  {errors.identifier}
                </p>
              )}
              {/* Input type hint */}
              {identifier && !errors.identifier && (
                <div id="identifier-hint" className="mt-2 space-y-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 transition-colors duration-300">
                    <HiOutlineCheck className="w-4 h-4" />
                    {identifier.includes('@') ? 'Email format detected' : 'Employee ID format detected'}
                  </p>
                  {identifier.includes('@') && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors duration-300">
                      Example: john.doe@company.com
                    </p>
                  )}
                  {!identifier.includes('@') && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors duration-300">
                      Example: EMP1234 or JD001
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60 transition-opacity duration-300 pointer-events-none">
                  <HiOutlineLockClosed className="w-5 h-5" />
                </div>
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onBlur={() => handleFieldBlur('password')}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-describedby="password-error"
                  aria-invalid={!!errors.password}
                  className={`w-full py-4 min-h-[56px] md:min-h-[56px] input-neumorphic input-with-both-icons mobile-touch-target transition-all duration-300 ${errors.password ? 'border-red-500 dark:border-red-400' : ''
                    }`}
                  required
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity duration-300 mobile-touch-target"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <HiOutlineEyeSlash className="w-5 h-5" />
                  ) : (
                    <HiOutlineEye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1 transition-colors duration-300">
                  <HiOutlineXMark className="w-4 h-4" />
                  {errors.password}
                </p>
              )}

            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <label className="flex items-center mobile-touch-target cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500 mobile-touch-target"
                />
                <span className="ml-2 text-sm transition-colors duration-300">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="text-sm hover:opacity-80 transition-opacity duration-300 mobile-touch-target underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 min-h-[56px] md:min-h-[56px] btn-neumorphic btn-primary mobile-touch-target font-semibold text-base rounded-lg transition-all"
              aria-describedby="submit-help"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <HiOutlineShieldCheck className="w-5 h-5" />
                  Sign In
                </span>
              )}
            </button>
            {(!isFormValid && (identifier || password)) && (
              <p id="submit-help" className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                Please fill in all required fields correctly
              </p>
            )}
          </form>

          {/* Additional Info */}
          <div className="mt-8 text-center space-y-3">
            <p className="opacity-70 text-sm transition-colors duration-300">
              Don't have access?{' '}
              <a href="#" className="hover:opacity-80 font-medium transition-opacity duration-300 mobile-touch-target">
                Contact HR
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="opacity-50 text-sm transition-colors duration-300">
            © 2024 NetManager. All rights reserved.
          </p>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {showRecovery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 safe-area-inset-top safe-area-inset-bottom">
          <div className="glass-card w-full max-w-md transition-all duration-300">
            <div className="p-6 md:p-8">
              {/* Progress Indicator */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step <= recoveryStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                        {step < recoveryStep ? (
                          <HiOutlineCheck className="w-4 h-4" />
                        ) : (
                          step
                        )}
                      </div>
                      {step < 3 && (
                        <div className={`w-8 h-1 mx-2 transition-all ${step < recoveryStep
                          ? 'bg-blue-600'
                          : 'bg-gray-200 dark:bg-gray-700'
                          }`}></div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowRecovery(false)
                    setRecoveryStep(1)
                    setRecoveryError('')
                    setRecoverySuccess('')
                  }}
                  className="opacity-60 hover:opacity-100 mobile-touch-target"
                  aria-label="Close recovery modal"
                >
                  <HiOutlineXMark className="w-5 h-5" />
                </button>
              </div>

              {/* Recovery Title */}
              <h2 className="text-2xl font-bold mb-2 transition-colors duration-300">Password Recovery</h2>
              <p className="opacity-70 text-sm mb-6 transition-colors duration-300">
                {recoveryStep === 1 && 'Enter your email address or Employee ID to receive a recovery code'}
                {recoveryStep === 2 && 'Enter the verification code sent to your email'}
                {recoveryStep === 3 && 'Set your new password'}
                {recoveryStep === 4 && 'Password reset successful!'}
              </p>

              {/* Error/Success Messages */}
              {recoveryError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-all duration-300">
                  <p className="text-red-600 dark:text-red-400 text-sm transition-colors duration-300">{recoveryError}</p>
                </div>
              )}

              {recoverySuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg transition-all duration-300">
                  <p className="text-green-600 dark:text-green-400 text-sm transition-colors duration-300">{recoverySuccess}</p>
                </div>
              )}

              {/* Recovery Form */}
              {recoveryStep < 4 && (
                <div className="space-y-4">
                  {recoveryStep === 1 && (
                    <div>
                      <label htmlFor="recovery-email" className="block text-sm font-medium mb-2 transition-colors duration-300">
                        Email Address or Employee ID
                      </label>
                      <input
                        id="recovery-email"
                        type="text"
                        value={recoveryData.email}
                        onChange={(e) => setRecoveryData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter your email or Employee ID"
                        className="w-full px-4 py-3 input-neumorphic mobile-touch-target transition-all duration-300"
                        required
                      />
                      {recoveryData.email && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                          {recoveryData.email.includes('@') ? 'Email format detected' : 'Employee ID format detected'}
                        </p>
                      )}
                    </div>
                  )}

                  {recoveryStep === 2 && (
                    <div>
                      <label htmlFor="recovery-code" className="block text-sm font-medium mb-2 transition-colors duration-300">
                        Verification Code
                      </label>
                      <input
                        id="recovery-code"
                        type="text"
                        value={recoveryData.code}
                        onChange={(e) => setRecoveryData(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="w-full px-4 py-3 input-neumorphic mobile-touch-target text-center text-lg tracking-widest transition-all duration-300"
                        required
                      />
                    </div>
                  )}

                  {recoveryStep === 3 && (
                    <>
                      <div>
                        <label htmlFor="new-password" className="block text-sm font-medium mb-2 transition-colors duration-300">
                          New Password
                        </label>
                        <input
                          id="new-password"
                          type="password"
                          value={recoveryData.newPassword}
                          onChange={(e) => setRecoveryData(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password"
                          className="w-full px-4 py-3 input-neumorphic mobile-touch-target transition-all duration-300"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium mb-2 transition-colors duration-300">
                          Confirm Password
                        </label>
                        <input
                          id="confirm-password"
                          type="password"
                          value={recoveryData.confirmPassword}
                          onChange={(e) => setRecoveryData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          className="w-full px-4 py-3 input-neumorphic mobile-touch-target transition-all duration-300"
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    {recoveryStep > 1 && recoveryStep < 4 && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryStep(prev => prev - 1)
                          setRecoveryError('')
                        }}
                        className="flex-1 py-3 px-4 neumorphic font-medium rounded-lg transition-all duration-300 mobile-touch-target"
                        disabled={recoveryLoading}
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (recoveryStep === 1) handleRecoveryStep1()
                        else if (recoveryStep === 2) handleRecoveryStep2()
                        else if (recoveryStep === 3) handleRecoveryStep3()
                      }}
                      disabled={recoveryLoading}
                      className="flex-1 py-3 px-4 btn-neumorphic btn-primary font-medium rounded-lg transition-all duration-300 mobile-touch-target"
                    >
                      {recoveryLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          {recoveryStep === 3 && <HiOutlineShieldCheck className="w-4 h-4" />}
                          {recoveryStep === 1 && 'Send Code'}
                          {recoveryStep === 2 && 'Verify Code'}
                          {recoveryStep === 3 && 'Reset Password'}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {recoveryStep === 4 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-300">
                    <HiOutlineCheck className="w-8 h-8 text-green-600 dark:text-green-400 transition-colors duration-300" />
                  </div>
                  <p className="font-medium transition-colors duration-300">Password Reset Successful!</p>
                  <p className="opacity-70 text-sm mt-2 transition-colors duration-300">You will be redirected to login shortly...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
