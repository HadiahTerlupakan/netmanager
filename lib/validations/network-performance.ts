import type { z } from "zod";

import {
  networkAlertCreateSchema,
  networkAlertQuerySchema,
  networkAlertUpdateSchema,
  networkPerformanceCreateSchema,
  networkPerformanceQuerySchema,
} from "@/modules/network/validation";

export {
  networkAlertCreateSchema,
  networkAlertQuerySchema,
  networkAlertUpdateSchema,
  networkPerformanceCreateSchema,
  networkPerformanceQuerySchema,
};

export type NetworkAlertCreateData = z.infer<typeof networkAlertCreateSchema>;
