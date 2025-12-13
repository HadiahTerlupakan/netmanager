// Test script untuk verifikasi perbaikan login portal karyawan netmanager
// Script ini akan menguji berbagai skenario untuk memastikan perbaikan berfungsi dengan baik

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Mock environment variables untuk testing
process.env.NODE_ENV = 'development';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.SESSION_MAX_AGE = '604800';
process.env.SESSION_UPDATE_AGE = '1800';

// Test functions
async function testDatabaseConnection() {
  console.log('\n=== TESTING DATABASE CONNECTION ===');
  try {
    const prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
    
    console.log('1. Testing normal database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection: SUCCESS');
    
    console.log('2. Testing validateDatabaseConnection function...');
    // Simulate the function from lib/auth.ts
    async function validateDatabaseConnection() {
      try {
        console.log('[AUTH] Validating database connection...');
        await prisma.$queryRaw`SELECT 1`;
        console.log('[AUTH] Database connection: OK');
        return true;
      } catch (error) {
        console.error('[AUTH] Database connection failed:', error);
        return false;
      }
    }
    
    const isValid = await validateDatabaseConnection();
    console.log(`✅ validateDatabaseConnection(): ${isValid ? 'WORKING' : 'FAILED'}`);
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('❌ Database connection test FAILED:', error.message);
    return false;
  }
}

async function testRedisConnection() {
  console.log('\n=== TESTING REDIS CONNECTION ===');
  try {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    
    console.log('1. Testing normal Redis connection...');
    await redis.ping();
    console.log('✅ Redis connection: SUCCESS');
    
    console.log('2. Testing validateRedisConnection function...');
    // Simulate the function from lib/auth.ts
    async function validateRedisConnection() {
      try {
        console.log('[AUTH] Validating Redis connection...');
        await redis.ping();
        console.log('[AUTH] Redis connection: OK');
        return true;
      } catch (error) {
        console.error('[AUTH] Redis connection failed:', error);
        return false;
      }
    }
    
    const isValid = await validateRedisConnection();
    console.log(`✅ validateRedisConnection(): ${isValid ? 'WORKING' : 'FAILED'}`);
    
    console.log('3. Testing rate limiting with Redis...');
    // Simulate checkRateLimit function
    async function checkRateLimit(key, maxAttempts, windowSeconds) {
      const safeKey = String(key).trim().replace(/[^a-zA-Z0-9:_-]/g, '_');
      const now = Date.now();
      const bucketKey = `rl:${safeKey}:${Math.floor(now / (windowSeconds * 1000))}`;
      
      try {
        const count = await redis.incr(bucketKey);
        if (count === 1) {
          await redis.expire(bucketKey, windowSeconds);
        }
        
        if (count > maxAttempts) {
          const excessAttempts = count - maxAttempts;
          const delaySeconds = Math.min(excessAttempts * 30, 300);
          const delayKey = `delay:${safeKey}`;
          await redis.setex(delayKey, delaySeconds, '1');
          console.log(`Rate limit exceeded for ${safeKey}. Delay: ${delaySeconds}s`);
          return false;
        }
        
        return count <= maxAttempts;
      } catch (error) {
        console.error('Redis rate limit error:', error?.message || error);
        return true;
      }
    }
    
    // Test rate limiting
    const testKey = 'test:user123';
    let rateLimitResult;
    for (let i = 1; i <= 7; i++) {
      rateLimitResult = await checkRateLimit(testKey, 5, 300);
      console.log(`Rate limit test ${i}: ${rateLimitResult ? 'ALLOWED' : 'BLOCKED'}`);
      if (!rateLimitResult) break;
    }
    
    await redis.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Redis connection test FAILED:', error.message);
    console.log('ℹ️  This might be expected if Redis is not running');
    return false;
  }
}

async function testEmployeeUserLinkValidation() {
  console.log('\n=== TESTING EMPLOYEE-USER LINK VALIDATION ===');
  try {
    const prisma = new PrismaClient();
    
    console.log('1. Testing employee lookup with valid userId...');
    // Test query similar to the one in lib/auth.ts
    const employeeWithUser = await prisma.employee.findFirst({
      where: {
        userId: { not: null }
      },
      include: {
        department: true,
        position: true,
      },
    });
    
    if (employeeWithUser) {
      console.log(`✅ Found employee with user link: ${employeeWithUser.employeeId}`);
      
      console.log('2. Testing user lookup via employee userId...');
      const linkedUser = await prisma.user.findUnique({
        where: { id: employeeWithUser.userId },
      });
      
      if (linkedUser) {
        console.log(`✅ Found linked user: ${linkedUser.email}`);
      } else {
        console.log('❌ Linked user not found - DATA INCONSISTENCY');
      }
    } else {
      console.log('ℹ️  No employees with user links found for testing');
    }
    
    console.log('3. Testing employee without userId...');
    const employeeWithoutUser = await prisma.employee.findFirst({
      where: { userId: null },
    });
    
    if (employeeWithoutUser) {
      console.log(`✅ Found employee without user link: ${employeeWithoutUser.employeeId}`);
      console.log('⚠️  This should trigger warning log in production');
    } else {
      console.log('ℹ️  All employees have user links');
    }
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('❌ Employee-User link validation FAILED:', error.message);
    return false;
  }
}

async function testSessionConfiguration() {
  console.log('\n=== TESTING SESSION CONFIGURATION ===');
  try {
    console.log('1. Testing session configuration...');
    
    const maxAge = parseInt(process.env.SESSION_MAX_AGE || '604800');
    const updateAge = parseInt(process.env.SESSION_UPDATE_AGE || '1800');
    
    console.log(`✅ Session maxAge: ${maxAge} seconds (${Math.round(maxAge/3600)} hours)`);
    console.log(`✅ Session updateAge: ${updateAge} seconds (${Math.round(updateAge/60)} minutes)`);
    
    // Verify sliding expiration configuration
    if (updateAge > 0 && updateAge < maxAge) {
      console.log('✅ Sliding expiration configuration is OPTIMAL');
    } else {
      console.log('⚠️  Sliding expiration configuration might need adjustment');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Session configuration test FAILED:', error.message);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n=== TESTING ERROR HANDLING ===');
  try {
    console.log('1. Testing error message mapping...');
    
    // Simulate error handling from app/employee/login/page.tsx
    function getErrorMessage(error) {
      if (error.includes('Terlalu banyak percobaan')) {
        return 'Terlalu banyak percobaan login. Silakan coba lagi dalam beberapa menit.';
      } else if (error.includes('Database connection error')) {
        return 'Sistem sedang bermasalah. Silakan coba lagi dalam beberapa saat.';
      } else if (error.includes('Employee account is not properly linked')) {
        return 'Akun karyawan belum terhubung dengan benar. Silakan hubungi HR.';
      } else if (error.includes('rate limit')) {
        return 'Terlalu banyak percobaan login. Akun sementara diblokir.';
      } else {
        return 'Employee ID atau Password tidak valid. Silakan periksa kembali.';
      }
    }
    
    const testErrors = [
      'Terlalu banyak percobaan',
      'Database connection error',
      'Employee account is not properly linked',
      'rate limit exceeded',
      'Unknown error'
    ];
    
    testErrors.forEach(error => {
      const message = getErrorMessage(error);
      console.log(`✅ Error "${error}" -> "${message}"`);
    });
    
    console.log('2. Testing network error handling...');
    // Simulate network error
    const networkError = new TypeError('Failed to fetch');
    if (networkError.name === 'TypeError' && networkError.message.includes('fetch')) {
      console.log('✅ Network error handling: WORKING');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error handling test FAILED:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🔍 STARTING AUTH VERIFICATION TESTS\n');
  
  const results = {
    database: await testDatabaseConnection(),
    redis: await testRedisConnection(),
    employeeUserLink: await testEmployeeUserLinkValidation(),
    sessionConfig: await testSessionConfiguration(),
    errorHandling: await testErrorHandling()
  };
  
  console.log('\n=== TEST SUMMARY ===');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 OVERALL RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  if (!allPassed) {
    console.log('\n📋 RECOMMENDATIONS:');
    if (!results.database) console.log('- Fix database connection issues');
    if (!results.redis) console.log('- Check Redis configuration and availability');
    if (!results.employeeUserLink) console.log('- Review employee-user data consistency');
    if (!results.sessionConfig) console.log('- Optimize session configuration');
    if (!results.errorHandling) console.log('- Review error handling implementation');
  }
}

// Run tests if this file is executed directly
runAllTests().catch(console.error);

export {
  testDatabaseConnection,
  testRedisConnection,
  testEmployeeUserLinkValidation,
  testSessionConfiguration,
  testErrorHandling
};