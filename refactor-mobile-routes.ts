import * as fs from 'fs';
import * as path from 'path';

const FILES_TO_PROCESS = [
    'app/api/mobile/attendance/check-in/route.ts',
    'app/api/mobile/attendance/geofence/route.ts',
    'app/api/mobile/attendance/check-out/route.ts',
    'app/api/mobile/attendance/history/route.ts',
    'app/api/mobile/topology/route.ts',
    'app/api/mobile/ping/route.ts',
    'app/api/mobile/work-orders/available/route.ts',
    'app/api/mobile/work-orders/route.ts',
    'app/api/mobile/work-orders/request/route.ts',
    'app/api/mobile/work-orders/[id]/tasks/route.ts',
    'app/api/mobile/work-orders/[id]/materials/route.ts',
    'app/api/mobile/work-orders/[id]/update/route.ts',
    'app/api/mobile/work-orders/[id]/return/route.ts',
    'app/api/mobile/work-orders/[id]/partner-response/route.ts',
    'app/api/mobile/work-orders/[id]/route.ts',
    'app/api/mobile/work-orders/[id]/partners/route.ts',
    'app/api/mobile/push-token/route.ts',
    'app/api/mobile/chat/conversations/route.ts',
    'app/api/mobile/chat/conversations/[id]/route.ts',
    'app/api/mobile/chat/users/route.ts',
    'app/api/mobile/chat/global/route.ts',
    'app/api/mobile/error-report/route.ts',
    'app/api/mobile/auth/me/route.ts',
    'app/api/mobile/auth/login/route.ts',
    'app/api/mobile/salary/route.ts',
    'app/api/mobile/salary/[id]/route.ts',
    'app/api/mobile/location/route.ts',
    'app/api/mobile/holidays/route.ts',
    'app/api/mobile/leaves/route.ts',
    'app/api/mobile/announcements/[id]/read/route.ts',
    'app/api/mobile/departments/route.ts',
    'app/api/mobile/dashboard/route.ts',
    'app/api/mobile/mixradius/customers/route.ts',
    'app/api/mobile/geofence/route.ts',
    'app/api/mobile/profile/password/route.ts',
    'app/api/mobile/profile/route.ts',
    'app/api/mobile/profile/photo/route.ts',
    'app/api/mobile/partners/route.ts',
    'app/api/mobile/inventory/riwayat/route.ts',
    'app/api/mobile/inventory/gudang/route.ts',
    'app/api/mobile/inventory/keluar/route.ts',
    'app/api/mobile/inventory/barang/route.ts',
    'app/api/mobile/inventory/masuk/route.ts',
    'app/api/mobile/app-version/download/[id]/route.ts',
    'app/api/mobile/app-version/report/route.ts',
    'app/api/mobile/app-version/check/route.ts',
    'app/api/mobile/overtime/route.ts',
    'app/api/mobile/notifications/route.ts',
    'app/api/mobile/upload/route.ts',
    'app/api/mobile/mitra/dashboard/route.ts',
    'app/api/mobile/mitra/verify-face/route.ts',
    'app/api/mobile/mitra/wallet/route.ts',
    'app/api/mobile/mitra/withdraw/route.ts',
    'app/api/mobile/mitra/fcm-token/route.ts',
];

function refactorFile(filePath: string) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');

    // 1. Add apiError and ErrorCodes imports if missing
    if (!content.includes('apiError') && (content.includes('NextResponse.json') || content.includes('prisma'))) {
        if (content.includes("from '@/lib/api-response'")) {
            content = content.replace(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/api-response['"]/, (match: string, p1: string) => {
                const parts = p1.split(',').map((s: string) => s.trim());
                if (!parts.includes('apiError')) parts.push('apiError');
                if (!parts.includes('ErrorCodes')) parts.push('ErrorCodes');
                return `import { ${parts.filter(Boolean).join(', ')} } from '@/lib/api-response'`;
            });
        } else {
            const importMatches = Array.from(content.matchAll(/^import.*$/gm));
            if (importMatches.length > 0) {
                const lastImport = importMatches[importMatches.length - 1][0];
                content = content.replace(lastImport, lastImport + `\nimport { apiError, ErrorCodes } from '@/lib/api-response'`);
            }
        }
    }

    // 2. Auth payload & tenantId extraction
    if (content.includes('const payload = authResult') && !content.includes('tenantId = payload.tenantId')) {
        content = content.replace(/const\s+payload\s*=\s*authResult/g, 'const payload = authResult\n        const tenantId = payload.tenantId as string');
    }

    // 3. Update Prisma queries
    // Regex to match prisma calls more robustly
    const prismaMethods = ['findUnique', 'findFirst', 'findMany', 'count', 'update', 'delete'];
    for (const method of prismaMethods) {
        const regex = new RegExp(`prisma\\.(\\w+)\\.${method}\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`, 'g');
        content = content.replace(regex, (match: string, model: string, args: string) => {
            if (args.includes('tenantId')) return match;
            
            // Handle 'where' block
            if (args.includes('where:')) {
                // Find where block and add tenantId
                const newArgs = args.replace(/where:\s*\{([^\}]*)\}/, (wMatch: string, wContent: string) => {
                    const separator = wContent.trim().length > 0 ? (wContent.trim().endsWith(',') ? '' : ',') : '';
                    return `where: {${wContent}${separator} tenantId }`;
                });
                
                let newMethod = method;
                if (method === 'findUnique') newMethod = 'findFirst';
                
                return `prisma.${model}.${newMethod}({${newArgs}})`;
            } else {
                // No where block, add one if it makes sense (usually it should have one)
                const newArgs = args.trim().length > 0 ? `where: { tenantId }, ${args}` : `where: { tenantId }`;
                let newMethod = method;
                if (method === 'findUnique') newMethod = 'findFirst';
                return `prisma.${model}.${newMethod}({ ${newArgs} })`;
            }
        });
    }

    // 4. Standardize NextResponse.json errors to apiError
    content = content.replace(/NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g, (match: string, message: string, status: string) => {
        let code = 'INTERNAL_ERROR';
        if (status === '404') code = 'NOT_FOUND';
        if (status === '401') code = 'UNAUTHORIZED';
        if (status === '403') code = 'FORBIDDEN';
        if (status === '400') code = 'VALIDATION_ERROR';
        if (status === '409') code = 'CONFLICT';
        return `apiError('${message}', ErrorCodes.${code}, { status: ${status} })`;
    });

    // 5. Standardize catch blocks
    // This is hard to regex perfectly, but let's try common patterns
    const catchRegex = /\} catch \(([^)]*)\) \{([\s\S]*?)\}/g;
    content = content.replace(catchRegex, (match: string, errVar: string, body: string) => {
        // If it already uses apiError in the catch block, leave it
        if (body.includes('apiError')) return match;
        // If it returns a 500 NextResponse.json, replace it
        if (body.includes('NextResponse.json') && body.includes('500')) {
             return `} catch (${errVar || 'error'}) {
        console.error('${path.basename(filePath)} Error:', ${errVar || 'error'})
        return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }`;
        }
        return match;
    });

    fs.writeFileSync(filePath, content);
}

FILES_TO_PROCESS.forEach(refactorFile);
console.log('Refactoring complete.');
