const fs = require('fs');
const path = require('path');

// Daftar file yang akan diperbaiki secara manual
const filesToFix = [
  'app/api/company-bank-accounts/active/route.ts',
  'app/api/admin/settings/whatsapp/test/route.ts',
  'app/api/admin/manual-payments/[id]/reject/route.ts',
  'app/api/admin/settings/whatsapp/route.ts',
  'app/api/admin/manual-payments/[id]/approve/route.ts',
  'app/api/admin/manual-payments/route.ts',
  'app/api/finance/ar/outstanding/route.ts',
  'app/api/admin/settings/email/test/route.ts',
  'app/api/admin/settings/email/route.ts',
  'app/api/finance/ar/collection-rate/route.ts',
  'app/api/finance/budget/[id]/route.ts',
  'app/api/finance/ar/aging-snapshot/route.ts',
  'app/api/finance/ar/aging-report/route.ts',
  'app/api/finance/deferred/schedule/[id]/route.ts',
  'app/api/admin/company-bank-accounts/[id]/route.ts',
  'app/api/admin/company-bank-accounts/route.ts',
  'app/api/finance/bank/match-transaction/route.ts',
  'app/api/finance/bank/auto-match/route.ts',
  'app/api/finance/invoice/[id]/pdf/route.ts',
  'app/api/finance/bank/import-statement/route.ts',
  'app/api/finance/invoice/send/route.ts',
  'app/api/admin/payment-gateway/test/route.ts',
  'app/api/admin/payment-gateway/configs/[provider]/route.ts',
  'app/api/admin/payment-gateway/configs/route.ts',
  'app/api/finance/revenue/trend/route.ts',
  'app/api/finance/revenue/snapshot/route.ts',
  'app/api/finance/bank/unreconciled/route.ts',
  'app/api/finance/revenue/metrics/route.ts',
  'app/api/finance/reports/profit-loss/route.ts',
  'app/api/finance/reports/comparison/route.ts',
  'app/api/finance/reports/cash-flow/route.ts',
  'app/api/finance/tax/calculate/route.ts',
  'app/api/manual-payment/submit/route.ts',
  'app/api/hris/payroll/[id]/route.ts',
  'app/api/finance/bank/accounts/[id]/route.ts'
];

// Fungsi untuk memperbaiki file
function fixFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    
    // Cek apakah file ada
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return false;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Cek apakah file memiliki import prisma dan deklarasi PrismaClient
    if (content.includes("import { prisma } from '@/lib/prisma';") && 
        content.includes("const prisma = new PrismaClient();")) {
      
      // Hapus baris deklarasi PrismaClient
      const lines = content.split('\n');
      const fixedLines = lines.filter(line => !line.trim().startsWith('const prisma = new PrismaClient();'));
      
      const fixedContent = fixedLines.join('\n');
      
      // Tulis kembali file
      fs.writeFileSync(fullPath, fixedContent);
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Proses semua file dalam daftar
console.log('Fixing PrismaClient issues in specific files...');
let fixedCount = 0;

filesToFix.forEach(filePath => {
  if (fixFile(filePath)) {
    fixedCount++;
  }
});

console.log(`Fixed ${fixedCount} files out of ${filesToFix.length}`);
console.log('Done!');
