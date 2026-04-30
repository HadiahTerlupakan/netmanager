import { logger } from "@/lib/logger";
import { EmailService } from "@/modules/notification";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { processRestockSetting } from "./inventory-restock-check.helpers";

export class InventoryRestockCheckService {
  private readonly inventoryRepository = new InventoryRepository();

  /** Run periodic restock alert checks and notifications. */
  async run() {
    const [settings, recipients] = await Promise.all([
      this.inventoryRepository.findActiveRestockSettings(),
      this.inventoryRepository.findRestockNotificationRecipients(),
    ]);

    const emailService = new EmailService();
    const results = [];

    for (const setting of settings) {
      try {
        results.push(
          await processRestockSetting({
            repository: this.inventoryRepository,
            setting,
            recipients,
            emailService,
          }),
        );
      } catch (error) {
        logger.error("Failed to process restock settings", error as Error);
      }
    }

    return {
      processed: settings.length,
      newAlerts: results.filter((result) => result.created).length,
      notificationsSent: results.reduce(
        (total, result) => total + result.notificationsSent,
        0,
      ),
    };
  }
}

let inventoryRestockCheckServiceInstance: InventoryRestockCheckService | null =
  null;

export function getInventoryRestockCheckService() {
  if (!inventoryRestockCheckServiceInstance) {
    inventoryRestockCheckServiceInstance = new InventoryRestockCheckService();
  }

  return inventoryRestockCheckServiceInstance;
}
