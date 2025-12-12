const fs = require('fs')
const path = require('path')

const files = [
  'app/api/finance/stats/route.ts',
  'app/api/finance/pemasukan/route.ts',
  'app/api/finance/transactions/import/route.ts',
  'app/api/finance/transactions/export/route.ts',
  'app/api/finance/tagihan/route.ts',
  'app/api/finance/pengeluaran/[id]/route.ts',
  'app/api/finance/pengeluaran/route.ts'
]

files.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath)

  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8')

    // Replace the role-based authorization with permission-based
    const oldPattern = /\/\/ Verify user has FINANCE or ADMIN role\s*\n\s*const allowedRoles = \['FINANCE', 'ADMIN'\] as const\s*\n\s*if \(!allowedRoles\.includes\(authResult\.user\.role as any\)\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 403 \}\)\s*\n\s*\}/g

    const newPattern = `// Verify user has FINANCE or ADMIN permissions
    const hasFinanceAccess = authResult.user?.permissions?.includes('FINANCE') ||
                            authResult.user?.permissions?.includes('ADMIN') ||
                            false
    if (!hasFinanceAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }`

    if (oldPattern.test(content)) {
      content = content.replace(oldPattern, newPattern)
      fs.writeFileSync(fullPath, content)
      console.log(`✅ Fixed ${filePath}`)
    } else {
      console.log(`⚠️  Pattern not found in ${filePath}`)
    }
  } else {
    console.log(`❌ File not found: ${filePath}`)
  }
})

console.log('Done fixing finance API files')