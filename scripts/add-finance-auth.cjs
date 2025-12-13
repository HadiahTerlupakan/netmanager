#!/usr/bin/env node

/**
 * Script to add FinanceAuthService authentication to all Finance API routes
 * that don't have it yet.
 */

const fs = require('fs');
const path = require('path');

const financeApiDir = path.join(__dirname, '../app/api/finance');

const AUTH_IMPORT = "import FinanceAuthService from '@/lib/services/FinanceAuthService'";

const AUTH_CHECK_TEMPLATE = `
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }
`;

function findRouteFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findRouteFiles(fullPath, files);
        } else if (item === 'route.ts') {
            files.push(fullPath);
        }
    }
    return files;
}

function needsAuth(content) {
    // Skip if already has FinanceAuthService
    if (content.includes('FinanceAuthService')) {
        return false;
    }
    // Skip auth routes
    if (content.includes('/auth/login') || content.includes('/auth/generate-token')) {
        return false;
    }
    return true;
}

function addAuthToFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (!needsAuth(content)) {
        console.log(`SKIP: ${filePath} (already has auth or is auth route)`);
        return false;
    }

    // Add import if not present
    if (!content.includes(AUTH_IMPORT)) {
        // Find the last import statement
        const importRegex = /^import .* from ['"].*['"];?\s*$/gm;
        const matches = [...content.matchAll(importRegex)];
        if (matches.length > 0) {
            const lastImport = matches[matches.length - 1];
            const insertPosition = lastImport.index + lastImport[0].length;
            content = content.slice(0, insertPosition) + '\n' + AUTH_IMPORT + content.slice(insertPosition);
        }
    }

    // Add auth check to each handler (GET, POST, PUT, PATCH, DELETE)
    const handlers = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    for (const handler of handlers) {
        // Find handler function
        const handlerRegex = new RegExp(`export async function ${handler}\\([^)]*\\)\\s*\\{\\s*try\\s*\\{`, 'g');
        const match = handlerRegex.exec(content);

        if (match) {
            // Check if auth check already exists after try {
            const afterTry = content.slice(match.index + match[0].length, match.index + match[0].length + 200);
            if (!afterTry.includes('authenticate') && !afterTry.includes('authResult')) {
                // Insert auth check after try {
                const insertPosition = match.index + match[0].length;
                content = content.slice(0, insertPosition) + AUTH_CHECK_TEMPLATE + content.slice(insertPosition);
            }
        }
    }

    fs.writeFileSync(filePath, content);
    console.log(`UPDATED: ${filePath}`);
    return true;
}

// Main
console.log('Adding FinanceAuthService authentication to Finance API routes...\n');

const routeFiles = findRouteFiles(financeApiDir);
let updated = 0;
let skipped = 0;

for (const file of routeFiles) {
    const relativePath = path.relative(process.cwd(), file);
    if (addAuthToFile(file)) {
        updated++;
    } else {
        skipped++;
    }
}

console.log(`\n✅ Done! Updated: ${updated}, Skipped: ${skipped}`);
