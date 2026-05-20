import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// POST - Upload image for chat
export const POST = createHandler(
  { auth: true, permissions: ["m_chat:create"] },
  async (req, ctx) => {
    const userId = ctx.session!.user.id;

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return apiError("Gambar tidak disediakan", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return apiError(
        "Tipe file tidak valid. Hanya JPEG, PNG, GIF, WEBP yang diperbolehkan.",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return apiError(
        "File terlalu besar. Maksimal 5MB.",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), "public", "uploads", "chat");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${userId}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return public URL with absolute path
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host");
    const baseUrl = `${protocol}://${host}`;
    const imageUrl = `${baseUrl}/uploads/chat/${filename}`;

    return apiSuccess({ imageUrl });
  },
);
