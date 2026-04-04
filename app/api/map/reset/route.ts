import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import * as z from "zod";

const resetSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

/**
 * @swagger
 * /api/map/reset:
 *   delete:
 *     summary: Delete all mapping data (requires password verification)
 *     tags: [Map]
 */
export const DELETE = createHandler({
  auth: true,
  permissions: ["map:delete"],
  schema: resetSchema
}, async (req, ctx) => {
  const { password } = ctx.validated;
  const session = ctx.session;

  if (!session?.user?.email) return ApiErrors.unauthorized();

  // Get the current user to verify password
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return ApiErrors.unauthorized("User not found or no password set");
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return ApiErrors.badRequest("Invalid password. Please try again.");
  }

  // Password verified, delete all mapping data
  await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    // Delete all edges first (foreign key constraint)
    await tx.mappingEdge.deleteMany({});

    // Delete all nodes
    await tx.mappingNode.deleteMany({});
  });

  return apiSuccess({
    message: "All mapping data has been deleted successfully",
  });
});
