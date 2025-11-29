import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedTicketCategories() {
    console.log('🎫 Seeding ticket categories...')

    const categories = [
        {
            name: 'Koneksi Terputus',
            description: 'Masalah terkait koneksi internet yang terputus atau tidak stabil',
            color: '#ef4444', // red
            icon: 'wifi-off',
            displayOrder: 1,
        },
        {
            name: 'Kecepatan Lambat',
            description: 'Keluhan terkait kecepatan internet yang lambat atau tidak sesuai paket',
            color: '#f97316', // orange
            icon: 'signal',
            displayOrder: 2,
        },
        {
            name: 'Billing & Pembayaran',
            description: 'Pertanyaan atau masalah terkait tagihan dan pembayaran',
            color: '#3b82f6', // blue
            icon: 'credit-card',
            displayOrder: 3,
        },
        {
            name: 'Permintaan Upgrade',
            description: 'Permintaan untuk upgrade paket internet',
            color: '#22c55e', // green
            icon: 'arrow-up',
            displayOrder: 4,
        },
        {
            name: 'Pertanyaan Teknis',
            description: 'Pertanyaan umum terkait teknis (PPPoE, router, konfigurasi, dll)',
            color: '#8b5cf6', // purple
            icon: 'question-mark',
            displayOrder: 5,
        },
        {
            name: 'Permintaan Pemasangan',
            description: 'Permintaan pemasangan baru atau relokasi',
            color: '#10b981', // emerald
            icon: 'home',
            displayOrder: 6,
        },
        {
            name: 'Customer Service',
            description: 'Pertanyaan umum atau keluhan pelayanan',
            color: '#06b6d4', // cyan
            icon: 'chat',
            displayOrder: 7,
        },
        {
            name: 'Lainnya',
            description: 'Kategori untuk masalah yang tidak termasuk dalam kategori di atas',
            color: '#6b7280', // gray
            icon: 'ellipsis',
            displayOrder: 99,
        },
    ]

    for (const category of categories) {
        const existing = await prisma.ticketCategory.findUnique({
            where: { name: category.name },
        })

        if (existing) {
            console.log(`  ⏭️  Category "${category.name}" already exists, skipping...`)
        } else {
            await prisma.ticketCategory.create({
                data: category,
            })
            console.log(`  ✅ Created category: ${category.name}`)
        }
    }

    console.log('✨ Ticket categories seeded successfully!')
}

seedTicketCategories()
    .catch((e) => {
        console.error('❌ Error seeding ticket categories:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
