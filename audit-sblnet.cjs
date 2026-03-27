
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const username = 'sblnet'
  console.log(`Auditing pelanggan: ${username}...`)

  const pelanggan = await prisma.pelanggan.findFirst({
    where: { 
      OR: [
        { username: username },
        { idPelanggan: username }
      ]
    },
    include: {
      hargaPaket: {
        include: {
          profilePPP: true
        }
      }
    }
  })

  if (!pelanggan) {
    console.log('Pelanggan tidak ditemukan.')
    return
  }

  console.log('--- DATA PELANGGAN ---')
  console.log(JSON.stringify(pelanggan, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
