/**
 * Serialize data containing BigInt values to a plain JSON-safe structure.
 * Use this instead of relying on BigInt.prototype.toJSON (which is global pollution).
 *
 * @example
 * const result = await prisma.something.findMany()
 * return NextResponse.json(serializeBigInt(result))
 */
export function serializeBigInt<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
}
