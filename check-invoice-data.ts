import { prismaBilling } from './lib/prisma-billing'

    // Add BigInt serialization support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ; (BigInt.prototype as any).toJSON = function () {
        return this.toString()
    }

async function check() {
    const invoice = await prismaBilling.invoice.findFirst({
        where: { invoiceNumber: 'INV/2026/02/25-B90B8862A454' },
        include: { invoiceItem: true, payment: true }
    })

    console.log(JSON.stringify(invoice, null, 2))
}

check().catch(console.error).finally(() => process.exit(0))
