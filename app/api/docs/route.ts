import { logger } from "@/lib/logger";
/**
 * Swagger UI Endpoint
 * GET /api/docs
 *
 * Menampilkan OpenAPI spec untuk dokumentasi API
 */

import { NextResponse } from "next/server";
import swaggerJsdoc from "swagger-jsdoc";
import { swaggerConfig } from "@/lib/swagger/swagger-config";
import path from "path";

// Update paths to be absolute
const updatedConfig = {
  ...swaggerConfig,
  apis: [
    path.join(process.cwd(), "app/api/**/*.ts"),
    path.join(process.cwd(), "app/api/**/*.tsx"),
  ],
};

// Generate OpenAPI spec
let specs: Record<string, unknown> | null = null;

try {
  specs = swaggerJsdoc(updatedConfig) as Record<string, unknown>;
} catch (error) {
  logger.error("Error generating Swagger spec:", error);
  specs = {
    openapi: "3.0.0",
    info: {
      title: "NetManager API",
      version: "1.0.0",
      description: "Error loading API documentation",
    },
    paths: {},
  };
}

export async function GET() {
  return NextResponse.json(specs);
}
