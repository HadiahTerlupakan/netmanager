#!/bin/bash

# Script untuk menambahkan permission check ke semua halaman yang belum punya
# Usage: bash scripts/process-pages.sh

ADMIN_DIR="/Users/rohadimraja/Documents/netmanager/app/admin"

# Function to process a page
process_page() {
    local full_path="$1"
    local permission="$2"
    local action="$3"  # read, create, update
    
    # Get directory and generate client name
    local dir=$(dirname "$full_path")
    local basename=$(basename "$dir")
    local client_name="${basename^}Client.tsx"  # Capitalize first letter
    
    # Special handling for dynamic routes
    if [[ "$basename" == "[id]" ]]; then
        # Use parent folder name
        local parent=$(basename "$(dirname "$dir")")
        client_name="${parent^}DetailClient.tsx"
    fi
    
    # Check if already has ensurePermission
    if grep -q "ensurePermission" "$full_path" 2>/dev/null; then
        echo "Skip: $full_path (already has permission)"
        return
    fi
    
    # Check if client component
    if grep -q "'use client'" "$full_path" 2>/dev/null; then
        echo "Process: $full_path -> $client_name ($permission:$action)"
        
        # Move page to client component
        mv "$full_path" "$dir/$client_name"
        
        # Update export
        sed -i '' "s/export default function [A-Za-z]*/export function ${client_name%.tsx}/" "$dir/$client_name"
        
        # Create wrapper
        cat > "$full_path" << EOF
import { ensurePermission } from '@/lib/rbac'
import { ${client_name%.tsx} } from './${client_name%.tsx}'

export default async function Page() {
    await ensurePermission('${permission}:${action}')
    return <${client_name%.tsx} />
}
EOF
        
        echo "  Created wrapper: $full_path"
    else
        echo "Server component: $full_path (add ensurePermission directly)"
        # For server components, add ensurePermission at the beginning
    fi
}

# Process FTTH pages
echo "=== Processing FTTH pages ==="

# Closure
process_page "$ADMIN_DIR/ftth/closure/new/page.tsx" "closure" "create"
process_page "$ADMIN_DIR/ftth/closure/[id]/page.tsx" "closure" "read"
process_page "$ADMIN_DIR/ftth/closure/[id]/edit/page.tsx" "closure" "update"

# OTB
process_page "$ADMIN_DIR/ftth/otb/new/page.tsx" "otb" "create"
process_page "$ADMIN_DIR/ftth/otb/[id]/page.tsx" "otb" "read"
process_page "$ADMIN_DIR/ftth/otb/[id]/edit/page.tsx" "otb" "update"

# ODC
process_page "$ADMIN_DIR/ftth/odc/new/page.tsx" "odc" "create"
process_page "$ADMIN_DIR/ftth/odc/[id]/page.tsx" "odc" "read"
process_page "$ADMIN_DIR/ftth/odc/[id]/edit/page.tsx" "odc" "update"

# ODP
process_page "$ADMIN_DIR/ftth/odp/new/page.tsx" "odp" "create"
process_page "$ADMIN_DIR/ftth/odp/[id]/page.tsx" "odp" "read"
process_page "$ADMIN_DIR/ftth/odp/[id]/edit/page.tsx" "odp" "update"

# Pole
process_page "$ADMIN_DIR/ftth/pole/new/page.tsx" "pole" "create"
process_page "$ADMIN_DIR/ftth/pole/[id]/page.tsx" "pole" "read"
process_page "$ADMIN_DIR/ftth/pole/[id]/edit/page.tsx" "pole" "update"

# KMZ
process_page "$ADMIN_DIR/ftth/kmz/new/page.tsx" "kmz" "create"

echo ""
echo "=== Processing Network pages ==="

# Network - ONU
process_page "$ADMIN_DIR/network/onu/new/page.tsx" "onu" "create"
process_page "$ADMIN_DIR/network/onu/register/page.tsx" "onu" "create"

# Network - ONU Type
process_page "$ADMIN_DIR/network/onutype/new/page.tsx" "onutype" "create"

# Network - Mikrotik
process_page "$ADMIN_DIR/network/mikrotik/new/page.tsx" "mikrotik" "create"
process_page "$ADMIN_DIR/network/mikrotik/[id]/edit/page.tsx" "mikrotik" "update"

echo ""
echo "=== Done ==="
