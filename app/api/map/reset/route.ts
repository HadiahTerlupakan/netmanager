
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, ApiErrors, withErrorHandler } from "@/lib/api-response";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const resetSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

/**
 * DELETE /api/map/reset
 * Delete all mapping data (requires password verification)
 */
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return ApiErrors.unauthorized("Unauthorized");
  }

  const body = await req.json();

  const validation = resetSchema.safeParse(body);
  if (!validation.success) {
    return ApiErrors.badRequest("Password is required");
  }

  const { password } = validation.data;

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
  await prisma.$transaction(async (tx) => {
    // Delete all edges first (foreign key constraint)
    await tx.mappingEdge.deleteMany({});

    // Delete all nodes
    await tx.mappingNode.deleteMany({});
  });

  return apiSuccess({
    message: "All mapping data has been deleted successfully",
  });
});
