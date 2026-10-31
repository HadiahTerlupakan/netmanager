import { describe, expect, it } from "vitest";

import { EVENT_NAMES } from "@/lib/event-bus/types";
import {
  getEventHandlers,
  registerDefaultHandlers,
} from "@/lib/event-bus/event-handlers";
import { handleCustomerNotification } from "@/modules/notification";

/**
 * Perubahan status ke NONAKTIF, MAINTENANCE, dan DISMANTLE diterbitkan sebagai
 * CUSTOMER_SUSPENDED, yang dulu hanya punya handler sinkronisasi jaringan dan
 * MRR: pelanggan tidak pernah diberi tahu.
 */
describe("registrasi handler notifikasi status pelanggan", () => {
  registerDefaultHandlers();

  it.each([
    EVENT_NAMES.CUSTOMER_ISOLATED,
    EVENT_NAMES.CUSTOMER_ACTIVATED,
    EVENT_NAMES.CUSTOMER_SUSPENDED,
  ])("%s mengirim notifikasi ke pelanggan", (eventName) => {
    expect(getEventHandlers(eventName)).toContain(handleCustomerNotification);
  });
});
