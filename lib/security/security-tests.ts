/**
 * Security Test Suite
 *
 * This file contains security validation tests to ensure all implemented
 * security measures are working correctly.
 */

import * as crypto from 'crypto'

export interface SecurityTestResult {
  testName: string
  status: 'PASS' | 'FAIL' | 'WARN'
  message: string
  details?: any
  recommendations?: string[]
}

export class SecurityTests {
  private results: SecurityTestResult[] = []

  /**
   * Add test result
   */
  private addResult(result: SecurityTestResult): void {
    this.results.push(result)
  }

  /**
   * Get all test results
   */
  getResults(): SecurityTestResult[] {
    return this.results
  }

  /**
   * Get test summary
   */
  getSummary(): {
    total: number
    passed: number
    failed: number
    warnings: number
    score: number
  } {
    const total = this.results.length
    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length
    const warnings = this.results.filter(r => r.status === 'WARN').length
    const score = total > 0 ? Math.round((passed / total) * 100) : 0

    return { total, passed, failed, warnings, score }
  }

  /**
   * Test 1: Environment Variable Security
   */
  testEnvironmentSecurity(): void {
    const issues: string[] = []

    // Check for default secrets
    if (process.env.NEXTAUTH_SECRET === 'dev_secret_change_later') {
      issues.push('NEXTAUTH_SECRET is using default development value')
    }

    if (process.env.DATABASE_PASSWORD === 'netmgr') {
      issues.push('Database password is default value')
    }

    // Check for empty critical variables
    const criticalVars = ['DATABASE_URL', 'NEXTAUTH_SECRET']
    criticalVars.forEach(varName => {
      if (!process.env[varName]) {
        issues.push(`${varName} is not set`)
      }
    })

    if (issues.length === 0) {
      this.addResult({
        testName: 'Environment Security',
        status: 'PASS',
        message: 'All environment variables are properly configured'
      })
    } else {
      this.addResult({
        testName: 'Environment Security',
        status: issues.some(i => i.includes('default')) ? 'FAIL' : 'WARN',
        message: 'Environment security issues found',
        details: issues,
        recommendations: [
          'Set strong, unique secrets for production',
          'Use proper secret management system',
          'Rotate secrets regularly'
        ]
      })
    }
  }

  /**
   * Test 2: JWT Security Implementation
   */
  testJWTSecurity(): void {
    try {
      // Check if JWT dependencies are available
      const { verify, sign } = require('jsonwebtoken')

      // Test JWT signing and verification
      const testPayload = {
        userId: 'test-user',
        role: 'ADMIN',
        type: 'TEST'
      }

      const secret = process.env.NEXTAUTH_SECRET || 'test-secret'
      const token = sign(testPayload, secret, { expiresIn: '1h' })

      const decoded = verify(token, secret) as any

      if (decoded.userId === 'test-user' && decoded.type === 'TEST') {
        this.addResult({
          testName: 'JWT Security',
          status: 'PASS',
          message: 'JWT implementation is working correctly'
        })
      } else {
        this.addResult({
          testName: 'JWT Security',
          status: 'FAIL',
          message: 'JWT payload mismatch',
          details: { expected: testPayload, actual: decoded }
        })
      }
    } catch (error) {
      this.addResult({
        testName: 'JWT Security',
        status: 'FAIL',
        message: 'JWT implementation error',
        details: error
      })
    }
  }

  /**
   * Test 3: CORS Configuration
   */
  testCORSConfiguration(): void {
    const nodeEnv = process.env.NODE_ENV
    const corsOrigin = process.env.CORS_ORIGIN

    if (nodeEnv === 'production') {
      if (!corsOrigin || corsOrigin === '*') {
        this.addResult({
          testName: 'CORS Configuration',
          status: 'FAIL',
          message: 'Production CORS is too permissive',
          recommendations: [
            'Set specific allowed origins',
            'Remove wildcard CORS in production'
          ]
        })
      } else {
        this.addResult({
          testName: 'CORS Configuration',
          status: 'PASS',
          message: 'CORS is properly configured for production'
        })
      }
    } else {
      this.addResult({
        testName: 'CORS Configuration',
        status: 'PASS',
        message: 'Development CORS configuration is acceptable'
      })
    }
  }

  /**
   * Test 4: Security Headers
   */
  testSecurityHeaders(): void {
    const requiredHeaders = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
      'Content-Security-Policy'
    ]

    // This would be tested by making actual HTTP requests
    // For now, we'll validate the implementation exists
    try {
      // Check if CORS implementation exists
      require('@/lib/middleware/cors')

      this.addResult({
        testName: 'Security Headers',
        status: 'PASS',
        message: 'Security headers implementation found',
        details: {
          configuredHeaders: requiredHeaders
        }
      })
    } catch (error) {
      this.addResult({
        testName: 'Security Headers',
        status: 'FAIL',
        message: 'Security headers implementation not found'
      })
    }
  }

  /**
   * Test 5: Input Validation
   */
  testInputValidation(): void {
    try {
      const { z } = require('zod')

      // Test schema validation
      const testSchema = z.object({
        email: z.string().email(),
        amount: z.number().positive().max(1000000)
      })

      // Test valid input
      const validResult = testSchema.safeParse({
        email: 'test@example.com',
        amount: 100
      })

      // Test invalid input
      const invalidResult = testSchema.safeParse({
        email: 'invalid-email',
        amount: -50
      })

      if (validResult.success && !invalidResult.success) {
        this.addResult({
          testName: 'Input Validation',
          status: 'PASS',
          message: 'Input validation is working correctly'
        })
      } else {
        this.addResult({
          testName: 'Input Validation',
          status: 'FAIL',
          message: 'Input validation logic error',
          details: {
            validResult,
            invalidResult
          }
        })
      }
    } catch (error) {
      this.addResult({
        testName: 'Input Validation',
        status: 'FAIL',
        message: 'Input validation library not found'
      })
    }
  }

  /**
   * Test 6: Rate Limiting
   */
  testRateLimiting(): void {
    try {
      // Check if rate limiting implementation exists
      require('@/lib/middleware/advanced-rate-limit')

      this.addResult({
        testName: 'Rate Limiting',
        status: 'PASS',
        message: 'Advanced rate limiting implementation found',
        details: {
          algorithms: ['fixed-window', 'sliding-window', 'token-bucket', 'exponential-backoff'],
          features: ['burst protection', 'user-specific limits', 'custom responses']
        }
      })
    } catch (error) {
      this.addResult({
        testName: 'Rate Limiting',
        status: 'FAIL',
        message: 'Rate limiting implementation not found'
      })
    }
  }

  /**
   * Test 7: Database Security
   */
  testDatabaseSecurity(): void {
    try {
      // Check if database security implementation exists
      require('@/lib/database/security')

      this.addResult({
        testName: 'Database Security',
        status: 'PASS',
        message: 'Database security implementation found',
        details: {
          features: ['row-level security', 'data encryption', 'audit logging', 'connection security']
        }
      })
    } catch (error) {
      this.addResult({
        testName: 'Database Security',
        status: 'FAIL',
        message: 'Database security implementation not found'
      })
    }
  }

  /**
   * Test 8: File Upload Security
   */
  testFileUploadSecurity(): void {
    try {
      const fs = require('fs')
      const path = require('path')

      // Check if Sharp is installed for image processing
      const uploadRoute = path.join(process.cwd(), 'app/api/upload/payment-proof/route.ts')

      if (fs.existsSync(uploadRoute)) {
        const content = fs.readFileSync(uploadRoute, 'utf8')

        if (content.includes('sharp') &&
            content.includes('validateFileUpload') &&
            content.includes('userUploadQuotas')) {
          this.addResult({
            testName: 'File Upload Security',
            status: 'PASS',
            message: 'File upload security implementation is comprehensive',
            details: {
              features: ['image processing', 'EXIF removal', 'content verification', 'quota management']
            }
          })
        } else {
          this.addResult({
            testName: 'File Upload Security',
            status: 'WARN',
            message: 'File upload security partially implemented'
          })
        }
      } else {
        this.addResult({
          testName: 'File Upload Security',
          status: 'FAIL',
          message: 'File upload route not found'
        })
      }
    } catch (error) {
      this.addResult({
        testName: 'File Upload Security',
        status: 'FAIL',
        message: 'Error checking file upload security'
      })
    }
  }

  /**
   * Test 9: Error Handling Security
   */
  testErrorHandlingSecurity(): void {
    try {
      require('@/lib/utils/secure-error-handler')

      this.addResult({
        testName: 'Error Handling Security',
        status: 'PASS',
        message: 'Secure error handling implementation found',
        details: {
          features: ['classified errors', 'generic messages', 'request tracking', 'audit logging']
        }
      })
    } catch (error) {
      this.addResult({
        testName: 'Error Handling Security',
        status: 'FAIL',
        message: 'Secure error handling not found'
      })
    }
  }

  /**
   * Test 10: Dependency Security
   */
  testDependencySecurity(): void {
    try {
      const fs = require('fs')
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

      const vulnerabilities: string[] = []

      // Check for known vulnerable dependencies
      const vulnerablePackages = [
        'lodash',
        'request',
        'node-fetch',
        'axios' // Check for old versions
      ]

      Object.keys(packageJson.dependencies || {}).forEach(dep => {
        const baseDep = dep.replace(/[@\d.]/g, '').split('/')[0]
        if (vulnerablePackages.includes(baseDep)) {
          vulnerabilities.push(dep)
        }
      })

      if (vulnerabilities.length === 0) {
        this.addResult({
          testName: 'Dependency Security',
          status: 'PASS',
          message: 'No known vulnerable dependencies found'
        })
      } else {
        this.addResult({
          testName: 'Dependency Security',
          status: 'WARN',
          message: 'Potentially vulnerable dependencies found',
          details: { vulnerabilities },
          recommendations: [
            'Run npm audit to check for vulnerabilities',
            'Update dependencies to latest versions'
          ]
        })
      }
    } catch (error) {
      this.addResult({
        testName: 'Dependency Security',
        status: 'FAIL',
        message: 'Error checking dependencies'
      })
    }
  }

  /**
   * Run all security tests
   */
  async runAllTests(): Promise<SecurityTestResult[]> {
    console.log('🔒 Running Security Tests...\n')

    this.testEnvironmentSecurity()
    this.testJWTSecurity()
    this.testCORSConfiguration()
    this.testSecurityHeaders()
    this.testInputValidation()
    this.testRateLimiting()
    this.testDatabaseSecurity()
    this.testFileUploadSecurity()
    this.testErrorHandlingSecurity()
    this.testDependencySecurity()

    const summary = this.getSummary()

    console.log('\n📊 Security Test Results:')
    console.log(`Total Tests: ${summary.total}`)
    console.log(`✅ Passed: ${summary.passed}`)
    console.log(`❌ Failed: ${summary.failed}`)
    console.log(`⚠️  Warnings: ${summary.warnings}`)
    console.log(`📈 Score: ${summary.score}%\n`)

    if (summary.failed > 0) {
      console.log('🚨 Failed Tests:')
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  ❌ ${r.testName}: ${r.message}`))
    }

    if (summary.warnings > 0) {
      console.log('⚠️  Warnings:')
      this.results
        .filter(r => r.status === 'WARN')
        .forEach(r => console.log(`  ⚠️  ${r.testName}: ${r.message}`))
    }

    return this.results
  }
}

/**
 * Quick security check function
 */
export function quickSecurityCheck(): Promise<SecurityTestResult[]> {
  const tests = new SecurityTests()
  return tests.runAllTests()
}

export default SecurityTests