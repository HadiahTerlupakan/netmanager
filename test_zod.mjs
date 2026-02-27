import { z } from 'zod';
const schema = z.object({
    contingencyAmount: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null) ? BigInt(v) : undefined),
});
try {
    const result = schema.safeParse({ contingencyAmount: 123.45 });
    console.log("SafeParse success:", result.success);
} catch (e) {
    console.log("SafeParse threw!", e.message);
}
