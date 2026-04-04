import { notFound } from 'next/navigation'
import { prisma } from '@/modules/database'
import { prismaMitra } from '@/modules/database'
import IdCardClient from './IdCardClient'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const mitra = await prismaMitra.mitra.findUnique({
        where: { id },
        select: { name: true }
    })

    return {
        title: `ID Card - ${mitra?.name || 'Mitra'}`,
    }
}

export default async function MitraIdPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const mitra = await prismaMitra.mitra.findFirst({
        where: { id, isActive: true },
        select: {
            id: true,
            name: true,
            mitraType: true,
            nik: true,
            fotoDiri: true,
            phone: true,
            createdAt: true,
            siteId: true
        }
    })

    let mitraSites = null
    if (mitra?.siteId) {
        mitraSites = await prisma.sites.findUnique({
            where: { id: mitra.siteId },
            select: { name: true }
        })
    }

    if (!mitra) {
        notFound()
    }

    return <IdCardClient mitra={JSON.parse(JSON.stringify({
        ...mitra,
        sites: mitraSites ? [mitraSites] : [] // Format compatibility with IdCardClient
    }))} />
}
