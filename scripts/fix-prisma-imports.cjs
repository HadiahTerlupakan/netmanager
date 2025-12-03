const fs = require('fs');
const path = require('path');

// Direktori yang akan discan
const apiDir = path.join(__dirname, '..', 'app', 'api');

// Fungsi untuk memperbaiki file
function fixFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Cek apakah file memiliki import prisma dan deklarasi PrismaClient
    if (content.includes("import { prisma } from '@/lib/prisma';") && 
        content.includes("const prisma = new PrismaClient();")) {
      
      // Hapus baris deklarasi PrismaClient
      const lines = content.split('\n');
      const fixedLines = lines.filter(line => !line.trim().startsWith('const prisma = new PrismaClient();'));
      
      const fixedContent = fixedLines.join('\n');
      
      // Tulis kembali file
      fs.writeFileSync(filePath, fixedContent);
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Fungsi untuk scan direktori secara rekursif
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      fixFile(filePath);
    }
  });
}

// Mulai scanning
console.log('Scanning API directory for PrismaClient issues...');
scanDirectory(apiDir);
console.log('Done!');
