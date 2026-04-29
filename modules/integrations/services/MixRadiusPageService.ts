import { prisma } from "@/modules/database";

export class MixRadiusPageService {
  /**
   * Check whether dashboard redirect is required.
   */
  async shouldRedirectToDashboard() {
    const setting = await prisma.settings.findFirst({
      where: { key: "PPP_CONNECTION_MODE" },
    });

    return setting?.value === "MIKROTIK_API";
  }
}
