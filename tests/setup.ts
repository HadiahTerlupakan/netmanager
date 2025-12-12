/**
 * Test Setup
 *
 * Setup untuk integration tests dan React Testing Library
 */

import '@testing-library/jest-dom'
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { cleanupTestDatabase } from '@/lib/test-utils'

// Cleanup React components after each test
afterEach(() => {
  cleanup()
})

// Setup sebelum semua tests
beforeAll(async () => {
  // Setup test database jika diperlukan
  // Misalnya: create test database, run migrations, dll

  // Mock Next.js router
  vi.mock('next/navigation', () => ({
    useRouter() {
      return {
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
      }
    },
    useSearchParams() {
      return new URLSearchParams()
    },
    usePathname() {
      return '/'
    },
  }))

  // Mock Next.js Image component
  vi.mock('next/image', () => ({
    default: (props: any) => ({ type: 'img', props }),
  }))

  // Mock NextAuth
  vi.mock('next-auth/react', () => ({
    useSession: () => ({
      data: {
        user: {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
        },
      },
      status: 'authenticated',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }))

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  vi.stubGlobal('localStorage', localStorageMock)

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// Cleanup setelah semua tests
afterAll(async () => {
  // Hanya cleanup jika menggunakan test database
  // Atau jika di CI environment (dimana kita yakin menggunakan test database)
  if (process.env.TEST_DATABASE_URL || process.env.CI === 'true') {
    await cleanupTestDatabase()
  } else {
    // Di development, skip cleanup jika TEST_DATABASE_URL tidak di-set
    // untuk menghindari kehilangan data development
    console.warn('⚠️  TEST_DATABASE_URL tidak di-set, skip cleanup untuk menghindari kehilangan data development')
    console.warn('⚠️  Setup TEST_DATABASE_URL untuk auto-cleanup setelah tests')
  }
})

// Cleanup sebelum setiap test (optional)
// Uncomment jika ingin clean database sebelum setiap test
// beforeEach(async () => {
//   await cleanupTestDatabase()
// })

