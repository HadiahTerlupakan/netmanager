#!/bin/bash
# Script diagnostic untuk cek environment variables di production
# Usage: ./scripts/check-production-env.sh

echo "🔍 Checking production environment variables..."
echo ""

echo "📋 NextAuth Configuration:"
echo "NEXTAUTH_URL: ${NEXTAUTH_URL:-NOT SET}"
echo "NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:0:10}... (${#NEXTAUTH_SECRET} chars)"
echo "COOKIE_DOMAIN: ${COOKIE_DOMAIN:-NOT SET}"
echo "NODE_ENV: ${NODE_ENV:-NOT SET}"
echo ""

echo "🍪 Expected cookie configuration:"
if [ "$NODE_ENV" = "production" ] && [[ "$NEXTAUTH_URL" == https://* ]]; then
  echo "   Environment: PRODUCTION (HTTPS)"
  echo "   Cookie prefix: __Secure-"
  echo "   Secure flag: true"
else
  echo "   Environment: DEVELOPMENT"
  echo "   Cookie prefix: (none)"
  echo "   Secure flag: false"
fi
echo ""

echo "⚠️  IMPORTANT:"
if [ -z "$COOKIE_DOMAIN" ]; then
  echo "   ❌ COOKIE_DOMAIN is NOT SET!"
  echo "   This will cause session loss when redirecting between subdomains."
  echo ""
  echo "   Solution: Set COOKIE_DOMAIN=.yourdomain.com in production env"
else
  echo "   ✅ COOKIE_DOMAIN is set to: $COOKIE_DOMAIN"

  if [[ "$COOKIE_DOMAIN" == .* ]]; then
    echo "   ✅ Leading dot found - cookies will work across subdomains"
  else
    echo "   ⚠️  No leading dot - cookies will NOT work across subdomains"
    echo "   Consider changing to: .$COOKIE_DOMAIN"
  fi
fi
