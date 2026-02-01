import { prisma } from '../lib/prisma'

async function main() {
  console.log('🧹 Cleaning up test shifts...')
  try {
    // Hapus shift dengan kode yang sering digunakan oleh tes
    const deleted = await prisma.shift.deleteMany({
      where: {
        code: {
          in: ['S1', 'S1A', 'T1', 'PAGI', 'SHIFT-01']
        }
      }
    })
    console.log(`✅ Deleted ${deleted.count} test shifts.`)
  } catch (error) {
    console.error('❌ Error cleaning shifts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
