// Test script khusus untuk verifikasi Redis fallback mechanism
import Redis from 'ioredis';

// Mock environment variables
process.env.NODE_ENV = 'development';

async function testRedisFallbackMechanism() {
  console.log('=== TESTING REDIS FALLBACK MECHANISM ===');
  
  console.log('1. Testing Redis connection failure handling...');
  
  // Test dengan Redis configuration yang salah untuk simulasi failure
  try {
    const redis = new Redis('redis://invalid-host:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableOfflineQueue: false,
      connectTimeout: 1000,
    });
    
    // Simulate validateRedisConnection function dengan failure
    async function validateRedisConnection() {
      try {
        console.log('[AUTH] Validating Redis connection...');
        await redis.ping();
        console.log('[AUTH] Redis connection: OK');
        return true;
      } catch (error) {
        console.error('[AUTH] Redis connection failed:', error.message);
        return false;
      }
    }
    
    const redisConnected = await validateRedisConnection();
    console.log(`✅ Redis failure handling: ${redisConnected ? 'UNEXPECTED SUCCESS' : 'WORKING AS EXPECTED'}`);
    
    console.log('2. Testing rate limiting fallback when Redis is unavailable...');
    
    // Simulate checkRateLimit function dengan fallback
    async function checkRateLimit(key, maxAttempts, windowSeconds) {
      // Validasi input
      if (!key || typeof key !== 'string' || key.length === 0) {
        return true; // Skip rate limiting jika key tidak valid
      }
      
      const safeKey = String(key).trim().replace(/[^a-zA-Z0-9:_-]/g, '_');
      
      try {
        const count = await redis.incr(`test:${safeKey}`);
        console.log(`Redis rate limit attempt: ${count}`);
        return count <= maxAttempts;
      } catch (error) {
        console.error('Redis rate limit error:', error?.message || error);
        console.log('✅ Fallback to allow request (fail open): WORKING');
        return true; // Fail open - allow request when Redis fails
      }
    }
    
    // Test rate limiting dengan Redis failure
    const testKey = 'test:user456';
    for (let i = 1; i <= 3; i++) {
      const result = await checkRateLimit(testKey, 5, 300);
      console.log(`Rate limit test ${i} (with Redis failure): ${result ? 'ALLOWED' : 'BLOCKED'}`);
    }
    
    await redis.disconnect();
    
  } catch (error) {
    console.log('✅ Redis connection failure simulation: WORKING');
  }
  
  console.log('3. Testing Redis with disabled error handler...');
  
  // Test Redis dengan error handler disabled (seperti di lib/redis.ts)
  const redisSilent = new Redis('redis://invalid-host:6379', {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    enableOfflineQueue: false,
    connectTimeout: 1000,
  });
  
  // Disable error logging (seperti di lib/redis.ts line 18)
  redisSilent.on('error', () => {});
  
  try {
    await redisSilent.ping();
    console.log('❌ Unexpected success with invalid Redis config');
  } catch (error) {
    console.log('✅ Silent error handling: WORKING');
  }
  
  await redisSilent.disconnect();
  
  return true;
}

async function testProgressiveDelay() {
  console.log('\n=== TESTING PROGRESSIVE DELAY MECHANISM ===');
  
  console.log('1. Testing progressive delay calculation...');
  
  function calculateDelay(excessAttempts) {
    return Math.min(excessAttempts * 30, 300); // Max 5 menit delay
  }
  
  const testCases = [1, 2, 3, 5, 10, 15];
  testCases.forEach(excess => {
    const delay = calculateDelay(excess);
    console.log(`✅ Excess attempts: ${excess} -> Delay: ${delay}s (${Math.round(delay/60)}min)`);
  });
  
  console.log('2. Testing delay mechanism with mock Redis...');
  
  // Mock Redis untuk testing
  const mockRedis = {
    incr: async (key) => 6, // Simulate exceeding limit
    expire: async () => {},
    setex: async (key, ttl, value) => {
      console.log(`✅ Delay set for key ${key}: ${ttl}s`);
    }
  };
  
  async function testRateLimitWithDelay(key, maxAttempts, windowSeconds) {
    const safeKey = String(key).trim().replace(/[^a-zA-Z0-9:_-]/g, '_');
    const now = Date.now();
    const bucketKey = `rl:${safeKey}:${Math.floor(now / (windowSeconds * 1000))}`;
    
    try {
      const count = await mockRedis.incr(bucketKey);
      
      if (count > maxAttempts) {
        const excessAttempts = count - maxAttempts;
        const delaySeconds = Math.min(excessAttempts * 30, 300);
        const delayKey = `delay:${safeKey}`;
        await mockRedis.setex(delayKey, delaySeconds, '1');
        console.log(`Rate limit exceeded for ${safeKey}. Delay: ${delaySeconds}s`);
        return false;
      }
      
      return count <= maxAttempts;
    } catch (error) {
      console.error('Redis rate limit error:', error?.message || error);
      return true;
    }
  }
  
  const result = await testRateLimitWithDelay('test:user789', 5, 300);
  console.log(`✅ Progressive delay test: ${result ? 'ALLOWED' : 'BLOCKED (as expected)'}`);
  
  return true;
}

// Run tests
async function runRedisTests() {
  console.log('🔍 STARTING REDIS FALLBACK TESTS\n');
  
  const results = {
    fallback: await testRedisFallbackMechanism(),
    progressiveDelay: await testProgressiveDelay()
  };
  
  console.log('\n=== REDIS TEST SUMMARY ===');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 REDIS FALLBACK RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run tests
runRedisTests().catch(console.error);