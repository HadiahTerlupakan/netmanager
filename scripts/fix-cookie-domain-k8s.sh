#!/bin/bash
# Script untuk update COOKIE_DOMAIN di Kubernetes production
# Usage: ./scripts/fix-cookie-domain-k8s.sh <your-domain>

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
  echo "❌ Usage: ./scripts/fix-cookie-domain-k8s.sh <domain>"
  echo "   Example: ./scripts/fix-cookie-domain-k8s.sh example.com"
  exit 1
fi

echo "🔧 Updating COOKIE_DOMAIN in Kubernetes..."
echo "   Domain: .$DOMAIN (with leading dot for subdomain support)"
echo ""

# Update ConfigMap (ganti nama configmap sesuai setup Anda)
kubectl set env deployment/netmanager-app -n radpro COOKIE_DOMAIN=".$DOMAIN"

echo ""
echo "✅ COOKIE_DOMAIN updated!"
echo "⏳ Waiting for pods to restart..."

kubectl rollout status deployment/netmanager-app -n radpro

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Verify dengan:"
echo "   kubectl exec -n radpro netmanager-app-0 -- env | grep COOKIE_DOMAIN"
