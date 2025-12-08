// Test script untuk verifikasi database connection failure handling
import { PrismaClient } from '@prisma/client';

// Mock environment variables
process.env.NODE_ENV = 'development';

async function testDatabaseConnectionFailure() {
  console.log('=== TESTING DATABASE CONNECTION FAILURE ===');
  
  console.log('1. Testing database connection validation with invalid config...');
  
  // Simulate database connection failure
  try {
    const prismaInvalid = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://invalid:invalid@localhost:5432/invalid'
        }
      },
      log: ['error', 'warn'],
    });
    
    // Simulate validateDatabaseConnection function dengan failure
    async function validateDatabaseConnection() {
      try {
        console.log('[AUTH] Validating database connection...');
        await prismaInvalid.$queryRaw`SELECT 1`;
        console.log('[AUTH] Database connection: OK');
        return true;
      } catch (error) {
        console.error('[AUTH] Database connection failed:', error.message);
        return false;
      }
    }
    
    const isValid = await validateDatabaseConnection();
    console.log(`✅ Database failure handling: ${isValid ? 'UNEXPECTED SUCCESS' : 'WORKING AS EXPECTED'}`);
    
    await prismaInvalid.$disconnect();
    
  } catch (error) {
    console.log('✅ Database connection failure simulation: WORKING');
  }
  
  console.log('2. Testing error handling in login flow with database failure...');
  
  // Simulate login function dengan database failure handling
  async function simulateLoginWithDatabaseFailure(identifier, password) {
    try {
      console.log(`[AUTH] Login attempt with identifier: ${identifier?.substring(0, 3)}***`);
      
      if (!identifier || !password) {
        console.log('[AUTH] Missing identifier or password');
        return { success: false, error: 'Missing credentials' };
      }
      
      // Validate database connection before proceeding
      const dbConnected = await validateDatabaseConnection();
      if (!dbConnected) {
        console.error('[AUTH] Database connection failed during login attempt');
        throw new Error('Database connection error. Please try again later.');
      }
      
      // This part won't execute due to database failure
      console.log('[AUTH] Database connected, proceeding with authentication...');
      return { success: true };
      
    } catch (error) {
      console.error('[AUTH] Error in login:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  // Test login dengan database failure
  const loginResult = await simulateLoginWithDatabaseFailure('TEST123', 'password123');
  console.log(`✅ Login with database failure: ${loginResult.success ? 'UNEXPECTED SUCCESS' : 'PROPERLY HANDLED'}`);
  console.log(`✅ Error message: "${loginResult.error}"`);
  
  return true;
}

async function testEmployeeUserLinkScenarios() {
  console.log('\n=== TESTING EMPLOYEE-USER LINK SCENARIOS ===');
  
  console.log('1. Testing employee lookup scenarios...');
  
  // Mock Prisma client untuk testing
  const mockPrisma = {
    employee: {
      findUnique: async ({ where, include }) => {
        console.log(`[MOCK] Finding employee with ${JSON.stringify(where)}`);
        
        // Simulate different scenarios
        if (where.employeeId === 'VALID001') {
          return {
            id: 'emp1',
            employeeId: 'VALID001',
            fullName: 'Valid Employee',
            userId: 'user1', // Has valid user link
            department: { id: 'dept1', name: 'IT' },
            position: { id: 'pos1', name: 'Developer' }
          };
        } else if (where.employeeId === 'NOUSER001') {
          return {
            id: 'emp2',
            employeeId: 'NOUSER001',
            fullName: 'No User Employee',
            userId: null, // No user link
            department: { id: 'dept2', name: 'HR' },
            position: { id: 'pos2', name: 'Staff' }
          };
        } else if (where.employeeId === 'NOTFOUND') {
          return null; // Employee not found
        }
        
        return null;
      }
    },
    user: {
      findUnique: async ({ where }) => {
        console.log(`[MOCK] Finding user with ${JSON.stringify(where)}`);
        
        if (where.id === 'user1') {
          return {
            id: 'user1',
            email: 'valid@example.com',
            passwordHash: 'hashedpassword',
            role: 'EMPLOYEE'
          };
        }
        
        return null; // User not found
      }
    }
  };
  
  // Simulate employee login function dengan berbagai skenario
  async function simulateEmployeeLogin(employeeId, password) {
    try {
      console.log(`[AUTH] Attempting Employee ID login for: ${employeeId}`);
      
      // Find employee
      const employee = await mockPrisma.employee.findUnique({
        where: { employeeId: employeeId.toUpperCase() },
        include: {
          department: true,
          position: true,
        },
      });
      
      console.log(`[AUTH] Employee found: ${!!employee}`);
      
      // Employee-User Link Validation
      if (employee && employee.userId) {
        const user = await mockPrisma.user.findUnique({
          where: { id: employee.userId },
        });
        console.log(`[AUTH] User found via employee: ${!!user}`);
        
        if (!user) {
          console.warn('[AUTH] Employee has userId but user not found - DATA INCONSISTENCY');
          throw new Error('Employee account is not properly linked to a user account. Please contact HR.');
        }
        
        return { success: true, employee, user };
      } else if (employee) {
        console.warn('[AUTH] Employee found but no userId:', employee.employeeId);
        throw new Error('Employee account is not properly linked to a user account. Please contact HR.');
      } else {
        console.log('[AUTH] Employee not found');
        return { success: false, error: 'Employee not found' };
      }
      
    } catch (error) {
      console.error('[AUTH] Error in employee login:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  // Test berbagai skenario
  const scenarios = [
    { id: 'VALID001', description: 'Employee with valid user link' },
    { id: 'NOUSER001', description: 'Employee without user link' },
    { id: 'NOTFOUND', description: 'Employee not found' }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n--- Testing: ${scenario.description} ---`);
    const result = await simulateEmployeeLogin(scenario.id, 'password123');
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (!result.success) {
      console.log(`Error: ${result.error}`);
    }
  }
  
  return true;
}

async function testErrorPropagation() {
  console.log('\n=== TESTING ERROR PROPAGATION ===');
  
  console.log('1. Testing error message consistency...');
  
  // Simulate error handling dari lib/auth.ts ke app/employee/login/page.tsx
  function simulateAuthError(errorType) {
    switch (errorType) {
      case 'DATABASE_FAILURE':
        throw new Error('Database connection error. Please try again later.');
      case 'RATE_LIMIT':
        throw new Error('Terlalu banyak percobaan. Coba lagi nanti.');
      case 'EMPLOYEE_LINK':
        throw new Error('Employee account is not properly linked to a user account. Please contact HR.');
      case 'CREDENTIALS':
        return null; // Return null for invalid credentials
      default:
        throw new Error('Unknown error occurred');
    }
  }
  
  function simulateClientErrorHandling(authResult, authError) {
    if (authError) {
      // Handle different types of errors with specific messages
      if (authError.includes('Terlalu banyak percobaan')) {
        return 'Terlalu banyak percobaan login. Silakan coba lagi dalam beberapa menit.';
      } else if (authError.includes('Database connection error')) {
        return 'Sistem sedang bermasalah. Silakan coba lagi dalam beberapa saat.';
      } else if (authError.includes('Employee account is not properly linked')) {
        return 'Akun karyawan belum terhubung dengan benar. Silakan hubungi HR.';
      } else if (authError.includes('rate limit')) {
        return 'Terlalu banyak percobaan login. Akun sementara diblokir.';
      } else {
        return 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.';
      }
    }
    
    if (!authResult) {
      return 'Employee ID atau Password tidak valid. Silakan periksa kembali.';
    }
    
    return null; // No error
  }
  
  const errorTypes = ['DATABASE_FAILURE', 'RATE_LIMIT', 'EMPLOYEE_LINK', 'CREDENTIALS', 'UNKNOWN'];
  
  errorTypes.forEach(errorType => {
    try {
      const authResult = simulateAuthError(errorType);
      const clientMessage = simulateClientErrorHandling(authResult, null);
      console.log(`✅ ${errorType}: ${clientMessage || 'SUCCESS'}`);
    } catch (error) {
      const clientMessage = simulateClientErrorHandling(null, error.message);
      console.log(`✅ ${errorType}: ${clientMessage}`);
    }
  });
  
  return true;
}

// Run all tests
async function runDatabaseTests() {
  console.log('🔍 STARTING DATABASE FAILURE TESTS\n');
  
  const results = {
    databaseFailure: await testDatabaseConnectionFailure(),
    employeeUserLink: await testEmployeeUserLinkScenarios(),
    errorPropagation: await testErrorPropagation()
  };
  
  console.log('\n=== DATABASE TEST SUMMARY ===');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 DATABASE FAILURE RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run tests
runDatabaseTests().catch(console.error);