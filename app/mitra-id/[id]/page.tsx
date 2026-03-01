import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import IdCardClient from './IdCardClient'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const mitra = await prisma.mitra.findUnique({
        where: { id },
        select: { name: true }
    })

    return {
        title: `ID Card - ${mitra?.name || 'Mitra'}`,
    }
}

export default async function MitraIdPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const mitra = await prisma.mitra.findFirst({
        where: { id, isActive: true },
        select: {
            id: true,
            name: true,
            mitraType: true,
            nik: true,
            fotoDiri: true,
            phone: true,
            createdAt: true,
            sites: { select: { name: true } }
        }
    })

    if (!mitra) {
        notFound()
    }

    // Pass data stringified to survive boundary constraint on server component date objects
    return <IdCardClient mitra={JSON.parse(JSON.stringify(mitra))} />
}
