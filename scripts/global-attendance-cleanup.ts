import { prismaAuth } from '../lib/prisma'

async function main() {
    console.log('--- GLOBAL ATTENDANCE DATA CLEANUP (FOR PRODUCTION) ---')
    
    try {
        const recordsToFix = await prismaAuth.attendance.findMany({
            where: {
                status: 'ABSENT',
                OR: [
                    { notes: { contains: 'Auto-Checkout: Lupa Absen Pulang' } },
                    { notes: { contains: 'Auto checkout by system (Mangkir)' } }
                ]
            },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true
                    }
                }
            }
        })

        console.log(`Initial scan found ${recordsToFix.length} potential records to check.`)

        let fixedCount = 0
        const defaultAlphaNote = "Tidak Masuk Kerja (Alpha) - Auto Generated"

        for (const record of recordsToFix) {
            const checkIn = record.checkIn
            const hour = checkIn.getUTCHours()
            const minute = checkIn.getUTCMinutes()
            const second = checkIn.getUTCSeconds()

            const isSystemTime = (hour === 17 && minute === 0) || (hour === 0 && minute === 0)

            if (isSystemTime) {
                console.log(`Fixing [${record.user.email}] Date: ${record.checkIn.toISOString()}`)
                
                await prismaAuth.attendance.update({
                    where: { id: record.id },
                    data: {
                        status: 'ALPHA',
                        checkOut: null,
                        notes: defaultAlphaNote
                    }
                })
                fixedCount++
            }
        }

        console.log('--- CLEANUP COMPLETED ---')
        console.log(`Total records fixed: ${fixedCount}`)
    } catch (error) {
        console.error('Error during global cleanup:', error)
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await (prismaAuth as any).$disconnect?.()
    })
