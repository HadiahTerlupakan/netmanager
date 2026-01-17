const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const crypto = require('crypto')
require('dotenv/config')

async function main() {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const pelangganId = '53f71a1a-0231-4be3-aa23-62b4f070aa56'
  console.log(`Checking invoices for pelangganId: ${pelangganId}`)

  try {
    const invoices = await prisma.invoice.findMany({
        where: {
        pelangganId: pelangganId
        }
    })

    console.log(`Found ${invoices.length} invoices.`)

    if (invoices.length === 0) {
        console.log("Creating a test invoice...")
        const newInvoice = await prisma.invoice.create({
            data: {
                id: crypto.randomUUID(),
                pelangganId: pelangganId,
                invoiceNumber: 'INV-TEST-001',
                issueDate: new Date(),
                dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // 7 days later
                subtotal: 100000,
                discountAmount: 0,
                taxAmount: 11000,
                totalAmount: 111000,
                status: 'SENT',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        })
        console.log("Created invoice:", newInvoice)
    } else {
        console.log("Invoices already exist.")
    }

  } catch (error) {
      console.error("Error details:", error);
  } finally {
      await prisma.$disconnect()
  }
}

main()
