#!/usr/bin/env node

/**
 * Secure Credential Generator for NetManager
 *
 * This script generates strong, cryptographically secure passwords and secrets
 * for the NetManager application infrastructure.
 */

import crypto from 'crypto';

// Configuration for password generation
const PASSWORD_CONFIG = {
  length: 32,
  numbers: true,
  symbols: true,
  uppercase: true,
  lowercase: true,
  excludeSimilar: true, // Exclude 0, O, l, 1, I
};

// Configuration for JWT secrets
const JWT_SECRET_BYTES = 64; // 512 bits for HMAC-SHA512

// Characters sets
const CHARSET = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  similar: '0Ol1I',
};

/**
 * Generate a cryptographically secure random password
 */
function generateSecurePassword(config = PASSWORD_CONFIG) {
  let charset = '';

  if (config.lowercase) charset += CHARSET.lowercase;
  if (config.uppercase) charset += CHARSET.uppercase;
  if (config.numbers) charset += CHARSET.numbers;
  if (config.symbols) charset += CHARSET.symbols;

  if (config.excludeSimilar) {
    charset = charset.split('').filter(char => !CHARSET.similar.includes(char)).join('');
  }

  if (charset.length === 0) {
    throw new Error('No valid characters available for password generation');
  }

  let password = '';
  const array = new Uint32Array(config.length);
  crypto.randomFillSync(array);

  for (let i = 0; i < config.length; i++) {
    password += charset[array[i] % charset.length];
  }

  // Ensure password contains at least one character from each required set
  if (config.lowercase && !/[a-z]/.test(password)) {
    const pos = crypto.randomInt(0, password.length);
    password = password.substring(0, pos) +
              CHARSET.lowercase[crypto.randomInt(0, CHARSET.lowercase.length)] +
              password.substring(pos + 1);
  }

  if (config.uppercase && !/[A-Z]/.test(password)) {
    const pos = crypto.randomInt(0, password.length);
    password = password.substring(0, pos) +
              CHARSET.uppercase[crypto.randomInt(0, CHARSET.uppercase.length)] +
              password.substring(pos + 1);
  }

  if (config.numbers && !/[0-9]/.test(password)) {
    const pos = crypto.randomInt(0, password.length);
    password = password.substring(0, pos) +
              CHARSET.numbers[crypto.randomInt(0, CHARSET.numbers.length)] +
              password.substring(pos + 1);
  }

  if (config.symbols && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    const pos = crypto.randomInt(0, password.length);
    password = password.substring(0, pos) +
              CHARSET.symbols[crypto.randomInt(0, CHARSET.symbols.length)] +
              password.substring(pos + 1);
  }

  return password;
}

/**
 * Generate a secure JWT secret (base64 encoded)
 */
function generateJWTSecret(bytes = JWT_SECRET_BYTES) {
  return crypto.randomBytes(bytes).toString('base64');
}

/**
 * Generate a secure RADIUS secret
 */
function generateRadiusSecret() {
  // RADIUS secrets should be printable ASCII characters, typically 16-32 characters
  const radiusCharset = CHARSET.lowercase + CHARSET.uppercase + CHARSET.numbers + '!@#$%^&*()-_=+[]{}|:;,.<>?';
  let secret = '';

  for (let i = 0; i < 32; i++) {
    const array = new Uint32Array(1);
    crypto.randomFillSync(array);
    secret += radiusCharset[array[0] % radiusCharset.length];
  }

  return secret;
}

/**
 * Generate database connection string with SSL
 */
function generateDatabaseConnectionString(config) {
  const sslMode = config.sslMode || 'require';
  return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}?sslmode=${sslMode}`;
}

/**
 * Main function to generate all credentials
 */
function generateAllCredentials() {
  console.log('🔐 NetManager Secure Credential Generator\n');
  console.log('Generating secure credentials...\n');

  // Generate PostgreSQL password
  const postgresPassword = generateSecurePassword({ ...PASSWORD_CONFIG, length: 28 });

  // Generate RADIUS secret
  const radiusSecret = generateRadiusSecret();

  // Generate JWT secrets
  const nextAuthSecret = generateJWTSecret();
  const authSecret = generateJWTSecret();
  const oauthEncryptionKey = generateJWTSecret();

  // Generate session password for Redis (if needed)
  const redisPassword = generateSecurePassword({ ...PASSWORD_CONFIG, length: 24, symbols: false });

  console.log('=== GENERATED SECURE CREDENTIALS ===\n');

  console.log('📊 Database Credentials:');
  console.log(`  PostgreSQL Password: ${postgresPassword}`);
  console.log();

  console.log('🌐 RADIUS Configuration:');
  console.log(`  RADIUS Secret: ${radiusSecret}`);
  console.log();

  console.log('🔑 Authentication Secrets:');
  console.log(`  NEXTAUTH_SECRET: ${nextAuthSecret}`);
  console.log(`  AUTH_SECRET: ${authSecret}`);
  console.log(`  OAUTH_ENCRYPTION_KEY: ${oauthEncryptionKey}`);
  console.log();

  console.log('💾 Redis (Optional Security):');
  console.log(`  REDIS_PASSWORD: ${redisPassword}`);
  console.log();

  // Generate environment file content
  console.log('=== .ENV FILE CONTENT ===\n');

  const envContent = `# Auth.js v5 - SECURE CREDENTIALS
AUTH_SECRET=${authSecret}
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${nextAuthSecret}

# OAuth Encryption Key (for storing OAuth credentials securely)
OAUTH_ENCRYPTION_KEY=${oauthEncryptionKey}

# Database Configuration - SECURE CREDENTIALS
POSTGRES_USER=netmgr
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=netmanager
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
DATABASE_URL=postgresql://netmgr:${postgresPassword}@localhost:5433/netmanager?sslmode=require

# RADIUS Configuration - SECURE CREDENTIALS
RADIUS_SECRET=${radiusSecret}

# Redis (untuk cache/ratelimit) - Optional
# REDIS_URL=redis://:${redisPassword}@localhost:6380
REDIS_URL=redis://localhost:6380

# SSL Configuration
# SSL_MODE=require
# SSL_CERT_PATH=/path/to/cert.pem
# SSL_KEY_PATH=/path/to/key.pem

# CORS Configuration
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info

# Session Security
SESSION_MAX_AGE=604800 # 7 days in seconds
SESSION_UPDATE_AGE=3600 # 1 hour in seconds
`;

  console.log(envContent);

  // Generate Docker Compose environment content
  console.log('=== DOCKER COMPOSE ENVIRONMENT FILE ===\n');

  const dockerEnvContent = `# Docker Compose Environment Variables
# Copy this to .env file in the same directory as docker-compose.yml

# PostgreSQL Database
POSTGRES_USER=netmgr
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=netmanager

# RADIUS
RADIUS_SECRET=${radiusSecret}

# SSL Configuration (Optional)
# POSTGRES_SSL_MODE=require
`;

  console.log(dockerEnvContent);

  // Security recommendations
  console.log('=== SECURITY RECOMMENDATIONS ===\n');
  console.log('1. 📝 Store these credentials in a secure password manager');
  console.log('2. 🔒 Update your .env files immediately with these values');
  console.log('3. 🚀 Never commit credentials to version control');
  console.log('4. 🔄 Rotate credentials every 90 days');
  console.log('5. 📊 Use different credentials for production vs development');
  console.log('6. 🛡️  Enable SSL/TLS for all database connections');
  console.log('7. 📝 Implement proper backup encryption');
  console.log('8. 🔍 Monitor for credential leaks or unauthorized access');
  console.log();

  console.log('=== CREDENTIAL STRENGTH ANALYSIS ===\n');

  function analyzePasswordStrength(password, name) {
    const length = password.length;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);
    const entropy = Math.log2(Math.pow(CHARSET.lowercase.length + CHARSET.uppercase.length +
                                     CHARSET.numbers.length + CHARSET.symbols.length, length));

    console.log(`${name}:`);
    console.log(`  Length: ${length} characters`);
    console.log(`  Character sets: ${[hasLower ? 'lowercase' : '', hasUpper ? 'uppercase' : '',
                                      hasNumber ? 'numbers' : '', hasSymbol ? 'symbols' : '']
                                      .filter(Boolean).join(', ')}`);
    console.log(`  Estimated entropy: ${entropy.toFixed(1)} bits`);
    console.log(`  Strength: ${entropy > 100 ? 'Very Strong' : entropy > 80 ? 'Strong' :
                            entropy > 60 ? 'Moderate' : 'Weak'}`);
    console.log();
  }

  analyzePasswordStrength(postgresPassword, 'PostgreSQL Password');
  analyzePasswordStrength(radiusSecret, 'RADIUS Secret');
  analyzePasswordStrength(nextAuthSecret, 'NextAuth Secret (Base64)');

  console.log('✅ Credential generation completed successfully!');

  return {
    postgresPassword,
    radiusSecret,
    nextAuthSecret,
    authSecret,
    oauthEncryptionKey,
    redisPassword,
  };
}

// Run the generator when script is executed
generateAllCredentials();

export {
  generateSecurePassword,
  generateJWTSecret,
  generateRadiusSecret,
  generateDatabaseConnectionString,
  generateAllCredentials,
};