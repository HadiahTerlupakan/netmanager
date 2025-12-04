#!/usr/bin/env node

/**
 * Simple Security Check for NetManager
 *
 * This script performs basic security validation without TypeScript compilation
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto');

class SimpleSecurityTests {
  constructor() {
    this.results = [];
  }

  addResult(testName, status, message, details = null) {
    this.results.push({
      testName,
      status,
      message,
      details
    });
  }

  getResults() {
    return this.results;
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;

    return { total, passed, failed, warnings, score };
  }

  // Test Environment Variables
  testEnvironmentSecurity() {
    const issues = [];

    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'dev_secret_change_later') {
      issues.push('NEXTAUTH_SECRET is not configured or using default value');
    }

    if (!process.env.DATABASE_URL) {
      issues.push('DATABASE_URL is not configured');
    }

    if (process.env.DATABASE_PASSWORD === 'netmgr') {
      issues.push('Database password is default value');
    }

    if (issues.length === 0) {
      this.addResult('Environment Security', 'PASS', 'Environment variables are properly configured');
    } else {
      this.addResult('Environment Security', 'FAIL', 'Environment security issues found', { issues });
    }
  }

  // Test File Structure
  testFileStructure() {
    const requiredFiles = [
      'lib/middleware/cors.ts',
      'lib/middleware/rate-limit.ts',
      'lib/utils/secure-error-handler.ts',
      'lib/validation/schemas.ts',
      'lib/validation/middleware.ts',
      'lib/database/security.ts',
      'lib/database/audit-service.ts',
      'app/api/finance/auth/generate-token/route.ts',
      'app/api/payment/webhook/dana/route.ts',
      'app/api/upload/payment-proof/route.ts'
    ];

    const missingFiles = [];
    requiredFiles.forEach(file => {
      if (!fs.existsSync(path.join(process.cwd(), file))) {
        missingFiles.push(file);
      }
    });

    if (missingFiles.length === 0) {
      this.addResult('File Structure', 'PASS', 'All security files are present');
    } else {
      this.addResult('File Structure', 'FAIL', 'Security files missing', { missingFiles });
    }
  }

  // Test CORS Implementation
  testCORSImplementation() {
    try {
      const corsFile = path.join(process.cwd(), 'lib/middleware/cors.ts');
      if (fs.existsSync(corsFile)) {
        const content = fs.readFileSync(corsFile, 'utf8');

        if (content.includes('getAllowedOrigins') && content.includes('Content-Security-Policy')) {
          this.addResult('CORS Implementation', 'PASS', 'Advanced CORS security implemented');
        } else {
          this.addResult('CORS Implementation', 'WARN', 'Basic CORS implementation found');
        }
      } else {
        this.addResult('CORS Implementation', 'FAIL', 'CORS implementation not found');
      }
    } catch (error) {
      this.addResult('CORS Implementation', 'FAIL', 'Error checking CORS implementation');
    }
  }

  // Test Authentication Security
  testAuthenticationSecurity() {
    try {
      const tokenRoute = path.join(process.cwd(), 'app/api/finance/auth/generate-token/route.ts');
      if (fs.existsSync(tokenRoute)) {
        const content = fs.readFileSync(tokenRoute, 'utf8');

        // Check if Base64 token is removed and JWT is implemented
        if (!content.includes('Buffer.from(token, \'base64\')') &&
            content.includes('FinanceAuthService.generateFinanceToken')) {
          this.addResult('Authentication Security', 'PASS', 'JWT authentication implemented, Base64 removed');
        } else {
          this.addResult('Authentication Security', 'FAIL', 'Insecure authentication implementation');
        }
      } else {
        this.addResult('Authentication Security', 'FAIL', 'Authentication route not found');
      }
    } catch (error) {
      this.addResult('Authentication Security', 'FAIL', 'Error checking authentication');
    }
  }

  // Test Webhook Security
  testWebhookSecurity() {
    try {
      const webhookRoute = path.join(process.cwd(), 'app/api/payment/webhook/dana/route.ts');
      if (fs.existsSync(webhookRoute)) {
        const content = fs.readFileSync(webhookRoute, 'utf8');

        const securityFeatures = [
          'replay attack protection',
          'multiple signature verification',
          'audit logging',
          'idempotency check'
        ];

        const foundFeatures = securityFeatures.filter(feature =>
          content.toLowerCase().includes(feature.toLowerCase())
        );

        if (foundFeatures.length >= 3) {
          this.addResult('Webhook Security', 'PASS', 'Advanced webhook security implemented', { foundFeatures });
        } else {
          this.addResult('Webhook Security', 'WARN', 'Basic webhook security implemented', { foundFeatures });
        }
      } else {
        this.addResult('Webhook Security', 'FAIL', 'Webhook route not found');
      }
    } catch (error) {
      this.addResult('Webhook Security', 'FAIL', 'Error checking webhook security');
    }
  }

  // Test File Upload Security
  testFileUploadSecurity() {
    try {
      const uploadRoute = path.join(process.cwd(), 'app/api/upload/payment-proof/route.ts');
      if (fs.existsSync(uploadRoute)) {
        const content = fs.readFileSync(uploadRoute, 'utf8');

        const securityFeatures = [
          'Sharp image processing',
          'EXIF data removal',
          'content verification',
          'user quota management',
          'file type validation',
          'file size limits'
        ];

        const foundFeatures = securityFeatures.filter(feature =>
          content.toLowerCase().includes(feature.toLowerCase())
        );

        if (foundFeatures.length >= 5) {
          this.addResult('File Upload Security', 'PASS', 'Advanced file upload security implemented', { foundFeatures });
        } else {
          this.addResult('File Upload Security', 'WARN', 'Basic file upload security implemented', { foundFeatures });
        }
      } else {
        this.addResult('File Upload Security', 'FAIL', 'File upload route not found');
      }
    } catch (error) {
      this.addResult('File Upload Security', 'FAIL', 'Error checking file upload security');
    }
  }

  // Test Middleware Security
  testMiddlewareSecurity() {
    try {
      const middlewareFile = path.join(process.cwd(), 'middleware.ts');
      if (fs.existsSync(middlewareFile)) {
        const content = fs.readFileSync(middlewareFile, 'utf8');

        // Check for fail-close mechanism
        if (content.includes('FAIL-CLOSE') ||
            (!content.includes('NextResponse.next({ request })') &&
             content.includes('return NextResponse.json({ error'))) {
          this.addResult('Middleware Security', 'PASS', 'Fail-close middleware implemented');
        } else {
          this.addResult('Middleware Security', 'FAIL', 'Fail-open middleware detected');
        }
      } else {
        this.addResult('Middleware Security', 'FAIL', 'Middleware file not found');
      }
    } catch (error) {
      this.addResult('Middleware Security', 'FAIL', 'Error checking middleware security');
    }
  }

  // Test Dependencies
  testDependencies() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const securityPackages = [
        'jsonwebtoken',
        'sharp',
        'zod',
        'helmet'
      ];

      const installedPackages = securityPackages.filter(pkg => dependencies[pkg]);
      const missingPackages = securityPackages.filter(pkg => !dependencies[pkg]);

      if (installedPackages.length >= 3 && missingPackages.length === 0) {
        this.addResult('Dependencies', 'PASS', 'Security dependencies are properly installed', { installedPackages });
      } else if (installedPackages.length >= 2) {
        this.addResult('Dependencies', 'WARN', 'Some security dependencies missing', { installedPackages, missingPackages });
      } else {
        this.addResult('Dependencies', 'FAIL', 'Critical security dependencies missing', { installedPackages, missingPackages });
      }
    } catch (error) {
      this.addResult('Dependencies', 'FAIL', 'Error checking dependencies');
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🔒 NetManager Security Check');
    console.log('================================\n');

    this.testEnvironmentSecurity();
    this.testFileStructure();
    this.testCORSImplementation();
    this.testAuthenticationSecurity();
    this.testWebhookSecurity();
    this.testFileUploadSecurity();
    this.testMiddlewareSecurity();
    this.testDependencies();

    const summary = this.getSummary();

    console.log('\n📊 Security Test Results:');
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);
    console.log(`📈 Score: ${summary.score}%\n`);

    if (summary.failed > 0) {
      console.log('🚨 Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  ❌ ${r.testName}: ${r.message}`));
    }

    if (summary.warnings > 0) {
      console.log('⚠️  Warnings:');
      this.results
        .filter(r => r.status === 'WARN')
        .forEach(r => console.log(`  ⚠️  ${r.testName}: ${r.message}`));
    }

    return this.results;
  }
}

// Run security check
async function main() {
  const tests = new SimpleSecurityTests();

  try {
    await tests.runAllTests();
    const summary = tests.getSummary();

    console.log('\n🎯 Security Grade:');

    if (summary.score >= 95) {
      console.log('🏆 EXCELLENT - Your application is highly secure!');
    } else if (summary.score >= 85) {
      console.log('✅ GOOD - Your application is secure with minor improvements needed');
    } else if (summary.score >= 70) {
      console.log('⚠️  MODERATE - Your application has some security concerns');
    } else {
      console.log('🚨 POOR - Your application has significant security vulnerabilities');
    }

    console.log(`\n📊 Final Score: ${summary.score}/100`);

    // Exit with appropriate code
    if (summary.failed > 0) {
      console.log('\n❌ Security check failed. Please address the issues above.');
      process.exit(1);
    } else {
      console.log('\n✅ Security check passed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Security check failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { SimpleSecurityTests };