import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository, getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('x-finance-token')
        let userId: string | undefined

        if (token) {
            // Verify finance token
            try {
                const tokenData = Buffer.from(token, 'base64').toString('utf8')
                const [uid, timestamp] = tokenData.split(':')
                userId = uid

                if (!userId) {
                    return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
                }

                // Check token expiry
                const tokenTime = parseInt(timestamp)
                const now = Date.now()
                const tokenAge = now - tokenTime
                const maxAge = 24 * 60 * 60 * 1000

                if (tokenAge > maxAge) {
                    return NextResponse.json({ error: 'Token expired' }, { status: 401 })
                }
            } catch (parseError) {
                return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
            }
        } else {
            // Verify NextAuth session
            const session = await getServerSession(authConfig)
            if (session?.user?.id) {
                userId = session.user.id
            } else {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        // Verify user exists and has FINANCE or ADMIN role
        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        const allowedRoles = ['FINANCE', 'ADMIN'] as const
        if (!user || !allowedRoles.includes(user.role as any)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Parse form data
        const formData = await request.formData()
        const file = formData.get('file') as File
        
        if (!file) {
            return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
        }

        // Read file content
        const text = await file.text()
        const lines = text.split('\n')
        
        if (lines.length < 2) {
            return NextResponse.json({ error: 'File tidak memiliki data yang valid' }, { status: 400 })
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        
        // Validate required headers
        const requiredHeaders = ['Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Jumlah']
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
        
        if (missingHeaders.length > 0) {
            return NextResponse.json({ 
                error: `Header yang diperlukan tidak ada: ${missingHeaders.join(', ')}` 
            }, { status: 400 })
        }

        // Parse data
        const data = lines.slice(1).filter(line => line.trim()).map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
            const row: any = {}
            
            headers.forEach((header, i) => {
                row[header] = values[i] || ''
            })
            
            return {
                index: index + 2, // +2 because of header and 0-based index
                ...row
            }
        })

        // Validate data
        const errors: string[] = []
        const validData: any[] = []
        
        data.forEach((row) => {
            let isValid = true
            
            if (!row.Tanggal || isNaN(Date.parse(row.Tanggal))) {
                errors.push(`Baris ${row.index}: Format tanggal tidak valid`)
                isValid = false
            }
            
            if (!row.Jenis || !['Pemasukan', 'Pengeluaran'].includes(row.Jenis)) {
                errors.push(`Baris ${row.index}: Jenis harus "Pemasukan" atau "Pengeluaran"`)
                isValid = false
            }
            
            if (!row.Kategori) {
                errors.push(`Baris ${row.index}: Kategori tidak boleh kosong`)
                isValid = false
            }
            
            if (!row.Deskripsi) {
                errors.push(`Baris ${row.index}: Deskripsi tidak boleh kosong`)
                isValid = false
            }
            
            if (!row.Jumlah || isNaN(Number(row.Jumlah))) {
                errors.push(`Baris ${row.index}: Jumlah harus berupa angka`)
                isValid = false
            }
            
            if (isValid) {
                validData.push({
                    tanggal: new Date(row.Tanggal),
                    jenis: row.Jenis,
                    kategori: row.Kategori,
                    deskripsi: row.Deskripsi,
                    jumlah: Number(row.Jumlah),
                    metodeBayar: row['Metode Pembayaran'] || null,
                    catatan: row.Catatan || null,
                    tipePengeluaran: row.Jenis === 'Pengeluaran' ? 'OPEX' : null,
                    createdBy: userId
                })
            }
        })

        // Import valid data
        const pengeluaranRepo = getPengeluaranRepository()
        const pemasukanRepo = getPemasukanRepository()
        
        let imported = 0
        const importErrors: string[] = []
        
        for (const item of validData) {
            try {
                if (item.jenis === 'Pemasukan') {
                    await pemasukanRepo.create({
                        tanggal: item.tanggal,
                        kategori: item.kategori,
                        deskripsi: item.deskripsi,
                        jumlah: item.jumlah,
                        metodeBayar: item.metodeBayar,
                        catatan: item.catatan,
                        createdBy: item.createdBy
                    })
                } else {
                    await pengeluaranRepo.create({
                        tanggal: item.tanggal,
                        tipePengeluaran: item.tipePengeluaran,
                        kategori: item.kategori,
                        deskripsi: item.deskripsi,
                        jumlah: item.jumlah,
                        metodeBayar: item.metodeBayar,
                        catatan: item.catatan,
                        createdBy: item.createdBy
                    })
                }
                imported++
            } catch (error: any) {
                importErrors.push(`Gagal mengimport baris ${item.index}: ${error.message}`)
            }
        }

        return NextResponse.json({
            imported,
            errors: importErrors,
            totalErrors: errors.length + importErrors.length
        })

    } catch (error: any) {
        console.error('Error importing transactions:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
