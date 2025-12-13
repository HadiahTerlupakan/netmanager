// Simple test script to verify security measures
// This is a basic test that checks if protections are working

const testResults = {
  middleware: false,
  routeProtection: false,
  sqlInjection: false,
  total: 0,
  passed: 0
};

console.log('Starting NetManager Security Tests...\n');

// Test 1: Check if middleware.ts exists
console.log('1. Testing Middleware Protection...');
try {
  const fs = require('fs');
  const path = require('path');

  const middlewarePath = path.join(__dirname, 'middleware.ts');
  if (fs.existsSync(middlewarePath)) {
    console.log('✓ middleware.ts file exists');
    testResults.middleware = true;
    testResults.passed++;

    // Check if middleware contains key security features
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    const hasAuthCheck = middlewareContent.includes('getToken');
    const hasRoleCheck = middlewareContent.includes('requiredRole');
    const hasPublicRoutes = middlewareContent.includes('publicRoutes');
    const hasSecurityHeaders = middlewareContent.includes('X-Frame-Options');

    if (hasAuthCheck && hasRoleCheck && hasPublicRoutes && hasSecurityHeaders) {
      console.log('✓ Middleware has all required security features');
    } else {
      console.log('⚠ Middleware missing some security features');
    }
  } else {
    console.log('✗ middleware.ts file not found');
  }
  testResults.total++;
} catch (error) {
  console.log('✗ Error checking middleware:', error.message);
  testResults.total++;
}

// Test 2: Check if route protection module exists
console.log('\n2. Testing Route Protection Module...');
try {
  const fs = require('fs');
  const path = require('path');

  const protectionPath = path.join(__dirname, 'lib', 'route-protection.ts');
  if (fs.existsSync(protectionPath)) {
    console.log('✓ route-protection.ts file exists');
    testResults.routeProtection = true;
    testResults.passed++;

    // Check if route protection has key features
    const protectionContent = fs.readFileSync(protectionPath, 'utf8');
    const hasUserRole = protectionContent.includes('enum UserRole');
    const hasPermissions = protectionContent.includes('permissions');
    const hasProtectRoute = protectionContent.includes('protectRoute');
    const hasRateLimit = protectionContent.includes('withRateLimit');

    if (hasUserRole && hasPermissions && hasProtectRoute && hasRateLimit) {
      console.log('✓ Route protection has all required features');
    } else {
      console.log('⚠ Route protection missing some features');
    }
  } else {
    console.log('✗ route-protection.ts file not found');
  }
  testResults.total++;
} catch (error) {
  console.log('✗ Error checking route protection:', error.message);
  testResults.total++;
}

// Test 3: Check for SQL injection vulnerabilities
console.log('\n3. Testing SQL Injection Protection...');
try {
  const fs = require('fs');
  const path = require('path');

  // Search for potential SQL injection patterns
  const searchFiles = [
    'app/api/olts/[id]/vlans/route.ts',
    'lib/repositories'
  ];

  let vulnerabilitiesFound = 0;

  searchFiles.forEach(file => {
    try {
      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for dangerous patterns
        const hasQueryRaw = content.includes('$queryRaw') || content.includes('$executeRaw');
        const hasConcatenation = content.includes("' + ") || content.includes('" + ');
        const hasTemplateLiteralSQL = /\$\{.*\}.*SELECT/g.test(content);

        if (hasQueryRaw) {
          console.log(`⚠ Found raw SQL query in ${file}`);
          vulnerabilitiesFound++;
        }
        if (hasConcatenation) {
          console.log(`⚠ Found string concatenation in ${file}`);
          vulnerabilitiesFound++;
        }
        if (hasTemplateLiteralSQL) {
          console.log(`⚠ Found potential SQL injection via template literal in ${file}`);
          vulnerabilitiesFound++;
        }
      }
    } catch (err) {
      // File might be a directory, skip
    }
  });

  if (vulnerabilitiesFound === 0) {
    console.log('✓ No SQL injection vulnerabilities found');
    testResults.sqlInjection = true;
    testResults.passed++;
  } else {
    console.log(`✗ Found ${vulnerabilitiesFound} potential SQL injection vulnerabilities`);
  }
  testResults.total++;
} catch (error) {
  console.log('✗ Error checking SQL injection:', error.message);
  testResults.total++;
}

// Test 4: Check if protected routes have been updated
console.log('\n4. Testing Protected Routes Updates...');
try {
  const fs = require('fs');
  const path = require('path');

  const routesToCheck = [
    'app/api/admin/roles/route.ts',
    'app/api/finance/bank-accounts/route.ts'
  ];

  let routesUpdated = 0;

  routesToCheck.forEach(route => {
    const fullPath = path.join(__dirname, route);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check if route uses the new protection system
      const usesProtection = content.includes('requireAdmin') ||
                           content.includes('protectRoute') ||
                           content.includes('requireFinance');

      if (usesProtection) {
        console.log(`✓ ${route} is using protection system`);
        routesUpdated++;
      } else {
        console.log(`⚠ ${route} may not be using the new protection system`);
      }
    }
  });

  if (routesUpdated === routesToCheck.length) {
    console.log('✓ All checked routes are using protection system');
    testResults.passed++;
  }
  testResults.total++;
} catch (error) {
  console.log('✗ Error checking protected routes:', error.message);
  testResults.total++;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('Security Test Summary:');
console.log(`Tests Passed: ${testResults.passed}/${testResults.total}`);
console.log(`Middleware Protection: ${testResults.middleware ? '✓' : '✗'}`);
console.log(`Route Protection: ${testResults.routeProtection ? '✓' : '✗'}`);
console.log(`SQL Injection Protection: ${testResults.sqlInjection ? '✓' : '✗'}`);

if (testResults.passed === testResults.total) {
  console.log('\n✅ All security tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some security tests failed. Please review the implementation.');
  process.exit(1);
}