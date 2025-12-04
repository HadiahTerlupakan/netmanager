import crypto from 'crypto'

// Encryption utilities for OAuth credentials
// Similar to existing encryption pattern used in payment gateway

const ALGORITHM = 'aes-256-gcm'
const SECRET_KEY = process.env.OAUTH_ENCRYPTION_KEY || 'default-oauth-encryption-key-change-in-production'

if (!process.env.OAUTH_ENCRYPTION_KEY) {
  console.warn('WARNING: Using default OAuth encryption key. Please set OAUTH_ENCRYPTION_KEY in your environment variables.')
}

// Ensure key is 32 bytes for AES-256
function getKey(): Buffer {
  return crypto.createHash('sha256').update(SECRET_KEY).digest()
}

/**
 * Encrypt sensitive OAuth credentials
 */
export function encryptOAuthCredential(text: string): string {
  if (!text) return ''

  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

/**
 * Decrypt OAuth credentials
 */
export function decryptOAuthCredential(encryptedData: string): string {
  if (!encryptedData) return ''

  try {
    const key = getKey()
    const parts = encryptedData.split(':')

    if (parts.length !== 3) {
      console.error('Invalid encrypted data format')
      return ''
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Error decrypting OAuth credential:', error)
    return ''
  }
}

/**
 * Encrypt multiple OAuth fields
 */
export function encryptOAuthFields(data: {
  clientId?: string | null
  clientSecret?: string | null
  tenantId?: string | null
}): {
  clientId?: string | null
  clientSecret?: string | null
  tenantId?: string | null
} {
  return {
    clientId: data.clientId ? encryptOAuthCredential(data.clientId) : null,
    clientSecret: data.clientSecret ? encryptOAuthCredential(data.clientSecret) : null,
    tenantId: data.tenantId ? encryptOAuthCredential(data.tenantId) : null,
  }
}

/**
 * Decrypt multiple OAuth fields
 */
export function decryptOAuthFields(data: {
  clientId?: string | null
  clientSecret?: string | null
  tenantId?: string | null
}): {
  clientId?: string | null
  clientSecret?: string | null
  tenantId?: string | null
} {
  return {
    clientId: data.clientId ? decryptOAuthCredential(data.clientId) : null,
    clientSecret: data.clientSecret ? decryptOAuthCredential(data.clientSecret) : null,
    tenantId: data.tenantId ? decryptOAuthCredential(data.tenantId) : null,
  }
}

/**
 * Check if encryption key is properly configured
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.OAUTH_ENCRYPTION_KEY && process.env.OAUTH_ENCRYPTION_KEY !== 'default-oauth-encryption-key-change-in-production'
}