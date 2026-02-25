import { prismaBilling } from './lib/prisma-billing'

// Serialize BigInt for JSON.stringify
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function main() {
  const invoice = await prismaBilling.invoice.findFirst({
    where: { invoiceNumber: 'INV/2026/02/25-FA66187D8457' },
    include: { payment: true }
  })
  console.log(JSON.stringify(invoice, null, 2))
}
main().catch(console.error).finally(() => process.exit(0))
