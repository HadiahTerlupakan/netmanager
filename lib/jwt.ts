import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

interface PelangganJWTPayload {
  id: string
  idPelanggan: string
  nama: string
  username: string
  status: string
  appVersionCode?: number
  appVersionName?: string | null
  tenantId?: string | null
  iat?: number
  exp?: number
}

interface RefreshTokenPayload {
  id: string
  tokenVersion: number
  type: 'refresh'
  iat?: number
  exp?: number
}

const getJwtSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is required in production!')
    }
    console.warn('[SECURITY] Using development-only JWT secret. Set NEXTAUTH_SECRET in production.')
    return 'development-only-secret-do-not-use-in-production'
  }
  return secret
}

const JWT_EXPIRES_IN = '15m' // 15 menit untuk access token
const REFRESH_TOKEN_EXPIRES_IN = '7d' // 7 hari untuk refresh token

/**
 * Generate access token untuk pelanggan
 */
export function generatePelangganAccessToken(pelanggan: {
  id: string
  idPelanggan: string
  nama: string
  username: string
  status: string
  appVersionCode?: number
  appVersionName?: string | null
  tenantId?: string | null
}, expiresIn: string | number = JWT_EXPIRES_IN): string {
  const payload: PelangganJWTPayload = {
    id: pelanggan.id,
    idPelanggan: pelanggan.idPelanggan,
    nama: pelanggan.nama,
    username: pelanggan.username,
    status: pelanggan.status,
    appVersionCode: pelanggan.appVersionCode,
    appVersionName: pelanggan.appVersionName,
    tenantId: pelanggan.tenantId,
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'netmanager',
    audience: 'pelanggan-portal',
  })
}

/**
 * Generate refresh token untuk pelanggan
 */
export async function generatePelangganRefreshToken(pelangganId: string): Promise<string> {
  // Increment token version untuk invalidate refresh token lama
  await prisma.pelanggan.update({
    where: { id: pelangganId },
    data: { tokenVersion: { increment: 1 } },
  })

  // Ambil token version terbaru
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: { tokenVersion: true },
  })

  const payload: RefreshTokenPayload = {
    id: pelangganId,
    tokenVersion: pelanggan?.tokenVersion || 1,
    type: 'refresh',
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'netmanager',
    audience: 'pelanggan-portal',
  })
}

/**
 * Verify access token pelanggan
 */
export function verifyPelangganAccessToken(token: string): PelangganJWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'netmanager',
      audience: 'pelanggan-portal',
    }) as PelangganJWTPayload

    return decoded
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
}

/**
 * Verify refresh token pelanggan
 */
export async function verifyPelangganRefreshToken(token: string): Promise<{
  id: string
  valid: boolean
}> {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'netmanager',
      audience: 'pelanggan-portal',
    }) as RefreshTokenPayload

    if (decoded.type !== 'refresh') {
      return { id: '', valid: false }
    }

    // Cek token version di database
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, status: true },
    })

    if (!pelanggan || pelanggan.status !== 'AKTIF') {
      return { id: '', valid: false }
    }

    // Bandingkan token version
    if (pelanggan.tokenVersion !== decoded.tokenVersion) {
      return { id: '', valid: false }
    }

    return { id: decoded.id, valid: true }
  } catch (error) {
    console.error('Refresh token verification error:', error)
    return { id: '', valid: false }
  }
}

/**
 * Generate token pair (access + refresh)
 */
export async function generatePelangganTokenPair(pelanggan: {
  id: string
  idPelanggan: string
  nama: string
  username: string
  status: string
  tenantId?: string | null
}) {
  const accessToken = generatePelangganAccessToken(pelanggan)
  const refreshToken = await generatePelangganRefreshToken(pelanggan.id)

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
    tokenType: 'Bearer',
  }
}

/**
 * Invalidate all refresh tokens for a pelanggan
 */
export async function invalidatePelangganRefreshTokens(pelangganId: string) {
  // Increment token version untuk invalidate semua refresh token lama
  await prisma.pelanggan.update({
    where: { id: pelangganId },
    data: { tokenVersion: { increment: 1 } },
  })
}
