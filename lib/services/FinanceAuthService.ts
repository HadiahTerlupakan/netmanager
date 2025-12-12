import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

// Define finance JWT payload interface
export interface FinanceJwtPayload {
  userId: string;
  email: string;
  permissions: string[];
  type: 'FINANCE_ACCESS';
  timestamp: number;
}

// Define user session interface
export interface FinanceUser {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
}

// Authentication result interface
export interface AuthResult {
  success: boolean;
  user?: FinanceUser;
  error?: string;
  errorCode?: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'MISSING_TOKEN';
}

// Extended auth result with session info
export interface ExtendedAuthResult extends AuthResult {
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

class FinanceAuthService {
  private static readonly JWT_SECRET = process.env.FINANCE_JWT_SECRET || process.env.NEXTAUTH_SECRET!;
  private static readonly TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  // Rate limiting store (in production, use Redis)
  private static loginAttempts = new Map<string, { attempts: number; lastAttempt: number; lockedUntil?: number }>();

  // Active tokens store for revocation (in production, use Redis)
  private static activeTokens = new Set<string>();

  /**
   * Generate finance access token
   */
  static generateFinanceToken(user: FinanceUser): { token: string; expiresAt: Date } {
    const payload: FinanceJwtPayload = {
      userId: user.id,
      email: user.email,
      permissions: user.permissions,
      type: 'FINANCE_ACCESS',
      timestamp: Date.now(),
    };

    const token = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'netmanager-finance',
      audience: 'finance-api',
    });

    // Add to active tokens store
    this.activeTokens.add(token);

    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY);

    return { token, expiresAt };
  }

  /**
   * Validate finance access token
   */
  static async validateFinanceToken(request: NextRequest): Promise<AuthResult> {
    try {
      // Get token from header
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return {
          success: false,
          error: 'Missing finance access token',
          errorCode: 'MISSING_TOKEN',
        };
      }

      // Check if token is revoked
      if (!this.activeTokens.has(token)) {
        return {
          success: false,
          error: 'Token has been revoked',
          errorCode: 'INVALID_TOKEN',
        };
      }

      // Verify JWT
      const decoded = jwt.verify(token, this.JWT_SECRET) as FinanceJwtPayload;

      // Check token type
      if (decoded.type !== 'FINANCE_ACCESS') {
        return {
          success: false,
          error: 'Invalid token type',
          errorCode: 'INVALID_TOKEN',
        };
      }

      // Check token age (additional layer of security)
      const tokenAge = Date.now() - decoded.timestamp;
      if (tokenAge > this.TOKEN_EXPIRY) {
        return {
          success: false,
          error: 'Token has expired',
          errorCode: 'EXPIRED_TOKEN',
        };
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Use permissions from JWT token (since role column no longer exists)
      const userPermissions = decoded.permissions || [];

      // Check permissions authorization
      if (!this.isFinanceAuthorized(userPermissions)) {
        return {
          success: false,
          error: 'Insufficient permissions for finance access',
          errorCode: 'FORBIDDEN',
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          permissions: userPermissions,
        },
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Invalid token format',
          errorCode: 'INVALID_TOKEN',
        };
      }

      if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: 'Token has expired',
          errorCode: 'EXPIRED_TOKEN',
        };
      }

      console.error('Token validation error:', error);
      return {
        success: false,
        error: 'Authentication failed',
        errorCode: 'UNAUTHORIZED',
      };
    }
  }

  /**
   * Validate NextAuth session
   */
  static async validateSession(request: NextRequest): Promise<AuthResult> {
    try {
      const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                          request.cookies.get('__Secure-next-auth.session-token')?.value;

      if (!sessionToken) {
        return {
          success: false,
          error: 'No active session found',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Get session from database
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!session || session.expires < new Date()) {
        return {
          success: false,
          error: 'Session expired or invalid',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Get permissions from custom role system
      const { getEmployeePermissions } = await import('@/lib/utils/permissions');
      const permissions = await getEmployeePermissions(session.user.id);
      const userPermissions = permissions?.allowedFeatures || [];

      // Check permissions authorization
      if (!this.isFinanceAuthorized(userPermissions)) {
        return {
          success: false,
          error: 'Insufficient permissions for finance access',
          errorCode: 'FORBIDDEN',
        };
      }

      return {
        success: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          permissions: userPermissions,
        },
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return {
        success: false,
        error: 'Session validation failed',
        errorCode: 'UNAUTHORIZED',
      };
    }
  }

  /**
   * Dual authentication - try token first, then session
   */
  static async authenticate(request: NextRequest): Promise<ExtendedAuthResult> {
    const clientIP = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Rate limiting check
    const rateLimitResult = this.checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
        errorCode: 'UNAUTHORIZED',
        ipAddress: clientIP,
        userAgent,
      };
    }

    // Try finance token first
    let result = await this.validateFinanceToken(request);
    if (result.success) {
      this.recordSuccessfulAuth(clientIP);
      return {
        ...result,
        ipAddress: clientIP,
        userAgent,
      };
    }

    // Fallback to session validation
    result = await this.validateSession(request);
    if (result.success) {
      this.recordSuccessfulAuth(clientIP);
      return {
        ...result,
        ipAddress: clientIP,
        userAgent,
      };
    }

    // Record failed attempt
    this.recordFailedAuth(clientIP);

    return {
      ...result,
      ipAddress: clientIP,
      userAgent,
    };
  }

  /**
   * Revoke a token
   */
  static revokeToken(token: string): void {
    this.activeTokens.delete(token);
  }

  /**
   * Revoke all tokens for a user
   */
  static async revokeUserTokens(userId: string): Promise<void> {
    // In a production environment with Redis, you would store token -> user mapping
    // For now, we'll clear all tokens (simplified approach)
    this.activeTokens.clear();
  }

  /**
   * Refresh token
   */
  static async refreshToken(oldToken: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      // Remove old token from active set
      this.activeTokens.delete(oldToken);

      // Verify old token (allowing expired tokens for refresh)
      const decoded = jwt.verify(oldToken, this.JWT_SECRET, {
        ignoreExpiration: true,
      }) as FinanceJwtPayload;

      if (decoded.type !== 'FINANCE_ACCESS') {
        return { success: false, error: 'Invalid token type' };
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Use permissions from old token
      const userPermissions = decoded.permissions || [];

      if (!this.isFinanceAuthorized(userPermissions)) {
        return { success: false, error: 'User not authorized' };
      }

      // Generate new token
      const { token } = this.generateFinanceToken({
        id: user.id,
        email: user.email,
        name: user.name,
        permissions: userPermissions
      });

      return { success: true, token };
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Invalid token' };
    }
  }

  /**
   * Check if permissions are authorized for finance access
   */
  private static isFinanceAuthorized(permissions: string[]): boolean {
    return permissions?.includes('FINANCE') || permissions?.includes('ADMIN') || false;
  }

  /**
   * Get client IP address
   */
  private static getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0] ||
           request.headers.get('x-real-ip') ||
           'unknown';
  }

  /**
   * Rate limiting: check if IP is allowed to attempt authentication
   */
  private static checkRateLimit(ip: string): { allowed: boolean; remainingAttempts?: number; lockoutRemaining?: number } {
    const now = Date.now();
    const record = this.loginAttempts.get(ip);

    if (!record) {
      return { allowed: true };
    }

    // Check if currently locked out
    if (record.lockedUntil && record.lockedUntil > now) {
      return {
        allowed: false,
        lockoutRemaining: Math.ceil((record.lockedUntil - now) / 1000),
      };
    }

    // Reset if lockout period has passed
    if (record.lockedUntil && record.lockedUntil <= now) {
      this.loginAttempts.delete(ip);
      return { allowed: true };
    }

    // Check attempts within time window
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    if (now - record.lastAttempt > timeWindow) {
      this.loginAttempts.delete(ip);
      return { allowed: true };
    }

    const remainingAttempts = Math.max(0, this.MAX_LOGIN_ATTEMPTS - record.attempts);
    return {
      allowed: record.attempts < this.MAX_LOGIN_ATTEMPTS,
      remainingAttempts,
    };
  }

  /**
   * Record failed authentication attempt
   */
  private static recordFailedAuth(ip: string): void {
    const now = Date.now();
    const record = this.loginAttempts.get(ip) || { attempts: 0, lastAttempt: 0 };

    record.attempts++;
    record.lastAttempt = now;

    // Lock out if max attempts reached
    if (record.attempts >= this.MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_DURATION;
    }

    this.loginAttempts.set(ip, record);
  }

  /**
   * Record successful authentication (reset rate limit)
   */
  private static recordSuccessfulAuth(ip: string): void {
    this.loginAttempts.delete(ip);
  }

  /**
   * Middleware helper for API routes
   */
  static async requireAuth(request: NextRequest): Promise<ExtendedAuthResult> {
    return await this.authenticate(request);
  }

  /**
   * Admin-only authentication helper
   */
  static async requireAdmin(request: NextRequest): Promise<ExtendedAuthResult> {
    const result = await this.authenticate(request);

    if (!result.success) {
      return result;
    }

    const hasAdminAccess = result.user?.permissions?.includes('ADMIN') || false;
    if (!hasAdminAccess) {
      return {
        success: false,
        error: 'Admin access required',
        errorCode: 'FORBIDDEN',
        ipAddress: result.ipAddress,
        userAgent: result.userAgent,
      };
    }

    return result;
  }

  /**
   * Get authentication status for UI
   */
  static async getAuthStatus(request: NextRequest): Promise<{
    isAuthenticated: boolean;
    user?: FinanceUser;
    tokenInfo?: { token: string; expiresAt: Date };
  }> {
    const result = await this.authenticate(request);

    if (!result.success) {
      return { isAuthenticated: false };
    }

    // Check for finance token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    return {
      isAuthenticated: true,
      user: result.user,
      tokenInfo: token ? { token, expiresAt: new Date(Date.now() + this.TOKEN_EXPIRY) } : undefined,
    };
  }

  /**
   * Audit logging for financial operations
   */
  static async logFinancialAccess(
    request: NextRequest,
    user: FinanceUser,
    action: string,
    resource: string,
    details?: any
  ): Promise<void> {
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent');

    // This would typically log to a dedicated audit table
    console.log('Financial Access Audit:', {
      timestamp: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email,
      userPermissions: user.permissions,
      action,
      resource,
      ipAddress,
      userAgent,
      details,
    });

    // In production, store in database audit log
    try {
      await prisma.financialAuditLog.create({
        data: {
          action,
          entityType: resource,
          description: `${action} on ${resource}`,
          userId: user.id,
          userName: user.name || user.email,
          ipAddress,
          userAgent,
          newValues: details,
        },
      });
    } catch (error) {
      console.error('Failed to log financial access:', error);
    }
  }

  /**
   * Cleanup expired sessions and tokens
   */
  static async cleanup(): Promise<void> {
    try {
      // Clean expired sessions
      await prisma.session.deleteMany({
        where: {
          expires: {
            lt: new Date(),
          },
        },
      });

      // Note: Token cleanup would require persistent storage in production
      // For now, tokens are stored in memory and cleared on server restart
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Get security metrics
   */
  static getSecurityMetrics(): {
    activeTokens: number;
    failedAttempts: number;
    lockedIPs: number;
  } {
    const now = Date.now();
    let failedAttempts = 0;
    let lockedIPs = 0;

    for (const [ip, record] of this.loginAttempts.entries()) {
      if (record.lockedUntil && record.lockedUntil > now) {
        lockedIPs++;
      }
      failedAttempts += record.attempts;
    }

    return {
      activeTokens: this.activeTokens.size,
      failedAttempts,
      lockedIPs,
    };
  }
}

// Export both as default and named for flexibility
export { FinanceAuthService };
export default FinanceAuthService;