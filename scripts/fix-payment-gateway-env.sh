#!/bin/bash
# Script untuk apply fix NEXT_PUBLIC_APP_URL ke production
# Usage: ./scripts/fix-payment-gateway-env.sh

set -e

echo "=== Payment Gateway Environment Fix ==="
echo ""
echo "This script will:"
echo "1. Update ConfigMap dengan NEXT_PUBLIC_APP_URL"
echo "2. Restart pods untuk apply perubahan"
echo ""
read -p "Apply fix to production? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Step 1: Apply updated ConfigMap..."
sudo kubectl apply -f k8s/production/configmap.yaml

echo ""
echo "Step 2: Verify ConfigMap updated..."
sudo kubectl get configmap netmanager-config -n netmanager-production -o yaml | grep NEXT_PUBLIC_APP_URL

echo ""
echo "Step 3: Rolling restart pods..."
sudo kubectl rollout restart deployment/netmanager-app -n netmanager-production
sudo kubectl rollout restart deployment/netmanager-worker -n netmanager-production

echo ""
echo "Step 4: Wait for rollout to complete..."
sudo kubectl rollout status deployment/netmanager-app -n netmanager-production --timeout=5m
sudo kubectl rollout status deployment/netmanager-worker -n netmanager-production --timeout=5m

echo ""
echo "Step 5: Verify new pods have correct env..."
NEW_POD=$(sudo kubectl get pods -n netmanager-production -l app=netmanager-app -o jsonpath='{.items[0].metadata.name}')
echo "New pod: $NEW_POD"
sudo kubectl exec -n netmanager-production "$NEW_POD" -- printenv NEXT_PUBLIC_APP_URL

echo ""
echo "✅ Fix applied successfully!"
echo ""
echo "Verification:"
sudo kubectl exec -n netmanager-production "$NEW_POD" -- node -e "
const url = process.env.NEXT_PUBLIC_APP_URL;
console.log('Payment gateway callbacks will now use:');
console.log('  - Success redirect:', \`\${url}/payment/success\`);
console.log('  - Webhook URL:', \`\${url}/api/webhooks/{provider}\`);
console.log('  - Failure redirect:', \`\${url}/payment/failed\`);
"
