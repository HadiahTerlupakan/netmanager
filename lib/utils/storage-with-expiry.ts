/**
 * Utility untuk mengelola localStorage dengan expiry time
 * Data akan otomatis expired setelah waktu tertentu
 */

interface StorageItem<T> {
  value: T
  expiry: number // Unix timestamp dalam milliseconds
}

/**
 * Set item ke localStorage dengan expiry time
 * @param key - Key untuk menyimpan data
 * @param value - Value yang akan disimpan
 * @param ttlSeconds - Time to live dalam detik (default: 10 detik)
 */
export function setWithExpiry<T>(key: string, value: T, ttlSeconds: number = 10): void {
  if (typeof window === 'undefined') return

  const item: StorageItem<T> = {
    value,
    expiry: Date.now() + (ttlSeconds * 1000),
  }

  try {
    localStorage.setItem(key, JSON.stringify(item))
  } catch (error) {
    console.error(`Error setting localStorage item ${key}:`, error)
  }
}

/**
 * Get item dari localStorage dengan check expiry
 * @param key - Key untuk mengambil data
 * @returns Value jika masih valid, null jika expired atau tidak ada
 */
export function getWithExpiry<T>(key: string): T | null {
  if (typeof window === 'undefined') return null

  try {
    const itemStr = localStorage.getItem(key)
    if (!itemStr) return null

    const parsed = JSON.parse(itemStr)
    
    // Backward compatibility: jika data lama (tanpa wrapper expiry), langsung return
    if (!parsed.expiry && !parsed.value) {
      // Ini adalah data lama dalam format langsung, return as is
      return parsed as T
    }

    // Data baru dengan wrapper expiry
    const item: StorageItem<T> = parsed
    const now = Date.now()

    // Check jika sudah expired
    if (now > item.expiry) {
      localStorage.removeItem(key)
      return null
    }

    return item.value
  } catch (error) {
    // Jika error parsing, coba sebagai data lama langsung
    try {
      const itemStr = localStorage.getItem(key)
      if (itemStr) {
        const parsed = JSON.parse(itemStr)
        // Jika berhasil parse dan tidak ada struktur expiry, berarti data lama
        if (!parsed.expiry && !parsed.value) {
          return parsed as T
        }
      }
    } catch {
      // Ignore
    }
    console.error(`Error getting localStorage item ${key}:`, error)
    return null
  }
}

/**
 * Remove item dari localStorage
 */
export function removeWithExpiry(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}

/**
 * Check jika item masih valid (belum expired)
 */
export function isExpired(key: string): boolean {
  if (typeof window === 'undefined') return true

  try {
    const itemStr = localStorage.getItem(key)
    if (!itemStr) return true

    const item: StorageItem<any> = JSON.parse(itemStr)
    return Date.now() > item.expiry
  } catch {
    return true
  }
}

/**
 * Migrate data lama ke format baru dengan expiry
 * @param key - Key untuk migrate
 * @param ttlSeconds - Time to live dalam detik (default: 10 detik)
 */
export function migrateOldData<T>(key: string, ttlSeconds: number = 10): T | null {
  if (typeof window === 'undefined') return null

  try {
    const itemStr = localStorage.getItem(key)
    if (!itemStr) return null

    const parsed = JSON.parse(itemStr)
    
    // Jika sudah dalam format baru (ada expiry dan value), return langsung
    if (parsed.expiry && parsed.value !== undefined) {
      return parsed.value as T
    }

    // Jika data lama (langsung value tanpa wrapper), migrate ke format baru
    if (!parsed.expiry && !parsed.value) {
      setWithExpiry(key, parsed, ttlSeconds)
      return parsed as T
    }

    return null
  } catch {
    return null
  }
}

/**
 * Clear semua expired items dari localStorage
 */
export function clearExpiredItems(): void {
  if (typeof window === 'undefined') return

  const keysToRemove: string[] = []
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue

    try {
      const itemStr = localStorage.getItem(key)
      if (!itemStr) continue

      const item = JSON.parse(itemStr)
      // Check jika memiliki struktur expiry
      if (item.expiry && Date.now() > item.expiry) {
        keysToRemove.push(key)
      }
    } catch {
      // Bukan item dengan expiry, skip
      continue
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
}

