import { prisma } from '../lib/prisma'
import { existsSync } from 'fs'
import path from 'path'

async function checkLogo() {
  try {
    console.log('Checking logo settings...\n')
    
    // Cek di database
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: ['LOGO_INVOICE', 'LOGO_APLIKASI'],
        },
      },
    })
    
    console.log('Database Settings:')
    settings.forEach((s) => {
      console.log(`  ${s.key}: ${s.value || '(null)'}`)
      
      if (s.value) {
        const fullPath = path.join(process.cwd(), 'public', s.value)
        const exists = existsSync(fullPath)
        console.log(`    File exists: ${exists ? 'YES' : 'NO'}`)
        console.log(`    Full path: ${fullPath}`)
        if (!exists) {
          console.log(`    ⚠️  WARNING: File tidak ditemukan!`)
        }
      }
    })
    
    // Cek direktori
    const logoDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    console.log(`\nLogo directory: ${logoDir}`)
    
    const fs = await import('fs/promises')
    try {
      const files = await fs.readdir(logoDir)
      console.log(`Files in directory: ${files.length}`)
      files.forEach((file) => {
        console.log(`  - ${file}`)
      })
    } catch (err: any) {
      console.log(`  Directory tidak ada atau kosong: ${err.message}`)
    }
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkLogo()





