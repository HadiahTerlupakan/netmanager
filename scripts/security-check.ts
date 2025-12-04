#!/usr/bin/env ts-node

/**
 * Security Check Script
 *
 * Run comprehensive security tests on the NetManager application
 */

import { SecurityTests } from '../lib/security/security-tests'

async function main() {
  console.log('🔒 NetManager Security Check')
  console.log('================================\n')

  try {
    const tests = new SecurityTests()
    const results = await tests.runAllTests()

    const summary = tests.getSummary()

    console.log('\n🎯 Security Grade:')

    if (summary.score >= 95) {
      console.log('🏆 EXCELLENT - Your application is highly secure!')
    } else if (summary.score >= 85) {
      console.log('✅ GOOD - Your application is secure with minor improvements needed')
    } else if (summary.score >= 70) {
      console.log('⚠️  MODERATE - Your application has some security concerns')
    } else {
      console.log('🚨 POOR - Your application has significant security vulnerabilities')
    }

    console.log(`\n📊 Final Score: ${summary.score}/100`)

    // Exit with appropriate code
    if (summary.failed > 0) {
      console.log('\n❌ Security check failed. Please address the issues above.')
      process.exit(1)
    } else {
      console.log('\n✅ Security check passed!')
      process.exit(0)
    }

  } catch (error) {
    console.error('❌ Security check failed:', error)
    process.exit(1)
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main()
}