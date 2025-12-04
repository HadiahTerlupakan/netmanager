import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function migratePelangganPasswords() {
  console.log('Memulai migrasi password pelanggan...')
  
  try {
    // Ambil semua pelanggan yang memiliki passwordLogin
    const pelanggans = await prisma.pelanggan.findMany({
      where: {
        passwordLogin: {
          not: null as any
        }
      }
    })

    console.log(`Ditemukan ${pelanggans.length} pelanggan dengan passwordLogin`)

    let successCount = 0
    let errorCount = 0

    for (const pelanggan of pelanggans) {
      try {
        // Skip jika password sudah di-hash (dimulai dengan $2a$, $2b$, atau $2y$)
        if (pelanggan.passwordLogin && pelanggan.passwordLogin.startsWith('$2')) {
          console.log(`Pelanggan ${pelanggan.idPelanggan} password sudah di-hash, melewati...`)
          continue
        }

        // Hash password dengan bcrypt (salt rounds = 12)
        const hashedPassword = await hash(pelanggan.passwordLogin!, 12)

        // Update pelanggan dengan password yang sudah di-hash
        await prisma.pelanggan.update({
          where: { id: pelanggan.id },
          data: { passwordLogin: hashedPassword }
        })

        console.log(`✓ Password pelanggan ${pelanggan.idPelanggan} berhasil di-hash`)
        successCount++
      } catch (error) {
        console.error(`✗ Gagal meng-hash password pelanggan ${pelanggan.idPelanggan}:`, error)
        errorCount++
      }
    }

    console.log(`\nMigrasi selesai!`)
    console.log(`✓ Berhasil: ${successCount} pelanggan`)
    console.log(`✗ Gagal: ${errorCount} pelanggan`)
  } catch (error) {
    console.error('Error during migration:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Jalankan migrasi jika file ini dijalankan langsung
if (import.meta.url === `file://${process.argv[1]}`) {
  migratePelangganPasswords()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default migratePelangganPasswords
