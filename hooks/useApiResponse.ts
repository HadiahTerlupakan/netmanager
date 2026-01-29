'use client'

import { useState, useCallback } from 'react'

interface ApiResponse<T> {
  success?: boolean
  data?: T
  message?: string
  error?: string
}

interface UseApiResponseOptions {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

interface UseApiResponseReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  fetchData: (url: string, options?: RequestInit) => Promise<T | null>
  reset: () => void
  mutate: (newData: T | null) => void
}

/**
 * Custom hook untuk menangani API response dengan format apiSuccess() wrapper
 * 
 * API yang menggunakan apiSuccess() mengembalikan format:
 * { success: true, data: { ... }, message?: string }
 * 
 * Hook ini secara otomatis mengekstrak data dari wrapper tersebut
 * 
 * @example
 * ```tsx
 * const { data, loading, error, fetchData } = useApiResponse<User[]>()
 * 
 * useEffect(() => {
 *   fetchData('/api/admin/users')
 * }, [])
 * 
 * // data akan berisi array User[], bukan { success: true, data: User[] }
 * ```
 */
export function useApiResponse<T = any>(
  options?: UseApiResponseOptions
): UseApiResponseReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (
    url: string,
    fetchOptions?: RequestInit
  ): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(url, fetchOptions)
      const json: ApiResponse<T> | T = await res.json()

      if (!res.ok) {
        const errorMessage = (json as any)?.error || `HTTP Error: ${res.status}`
        setError(errorMessage)
        options?.onError?.(errorMessage)
        return null
      }

      // Ekstrak data dari apiSuccess wrapper jika ada
      // Format: { success: true, data: {...} } atau langsung data
      let extractedData: T

      if (typeof json === 'object' && json !== null) {
        // Cek apakah response menggunakan apiSuccess wrapper
        if ('success' in json && 'data' in json) {
          // Format apiSuccess: { success: true, data: {...} }
          extractedData = (json as ApiResponse<T>).data as T
        } else if ('data' in json && !('success' in json)) {
          // Format dengan data tapi tanpa success flag
          extractedData = (json as { data: T }).data
        } else {
          // Format langsung (tanpa wrapper)
          extractedData = json as T
        }
      } else {
        extractedData = json as T
      }

      setData(extractedData)
      options?.onSuccess?.(extractedData)
      return extractedData

    } catch (err: any) {
      const errorMessage = err.message || 'Terjadi kesalahan saat mengambil data'
      setError(errorMessage)
      options?.onError?.(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [options])

  const reset = useCallback(() => {
    setData(null)
    setLoading(false)
    setError(null)
  }, [])

  const mutate = useCallback((newData: T | null) => {
    setData(newData)
  }, [])

  return { data, loading, error, fetchData, reset, mutate }
}

/**
 * Helper function untuk ekstrak data dari API response
 * Bisa digunakan tanpa hook untuk kasus sederhana
 * 
 * @example
 * ```tsx
 * const res = await fetch('/api/admin/users')
 * const json = await res.json()
 * const users = extractApiData<User[]>(json)
 * ```
 */
export function extractApiData<T>(response: ApiResponse<T> | T): T {
  if (typeof response === 'object' && response !== null) {
    // Cek apakah response menggunakan apiSuccess wrapper
    if ('success' in response && 'data' in response) {
      return (response as ApiResponse<T>).data as T
    } else if ('data' in response && !('success' in response)) {
      return (response as { data: T }).data
    }
  }
  return response as T
}

/**
 * Helper untuk fetch dengan auto-extract
 * 
 * @example
 * ```tsx
 * const users = await apiFetch<User[]>('/api/admin/users')
 * // users sudah berupa User[], bukan { success: true, data: User[] }
 * ```
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, options)
    const json = await res.json()

    if (!res.ok) {
      return {
        data: null,
        error: json?.error || `HTTP Error: ${res.status}`
      }
    }

    return {
      data: extractApiData<T>(json),
      error: null
    }
  } catch (err: any) {
    return {
      data: null,
      error: err.message || 'Network error'
    }
  }
}

export default useApiResponse
