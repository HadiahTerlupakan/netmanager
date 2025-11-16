/**
 * API Test Helper
 * 
 * Helper untuk testing Next.js API routes
 */

import { NextRequest } from 'next/server'
import { createMockSession } from '@/lib/test-utils'

/**
 * Mock Next.js API route handler untuk testing
 * 
 * Karena Next.js App Router tidak bisa langsung di-test dengan Supertest,
 * kita perlu membuat helper untuk mock request dan test handler secara langsung
 */
export function createMockRequest(
  method: string = 'GET',
  path: string = '/api/test',
  body?: any,
  headers?: Record<string, string>
): NextRequest {
  const url = `http://localhost:3000${path}`
  
  const requestInit: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(url, requestInit)
}

/**
 * Mock session untuk testing
 * 
 * Untuk test API routes yang memerlukan authentication,
 * kita perlu mock getServerSession
 */
export function mockSession(session: any) {
  // Mock akan dilakukan di test file menggunakan vi.mock
  return session
}

/**
 * Test helper untuk API response
 */
export async function getResponseData(response: Response) {
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return await response.json()
  }
  return await response.text()
}

/**
 * Assert response status
 */
export function expectStatus(response: Response, expectedStatus: number) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. ` +
      `Response: ${JSON.stringify(response, null, 2)}`
    )
  }
}

/**
 * Assert response JSON
 */
export async function expectJson(response: Response, expectedData: any) {
  const data = await getResponseData(response)
  if (JSON.stringify(data) !== JSON.stringify(expectedData)) {
    throw new Error(
      `Expected JSON ${JSON.stringify(expectedData)}, got ${JSON.stringify(data)}`
    )
  }
}

