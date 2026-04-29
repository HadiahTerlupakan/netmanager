import type { z } from "zod";

import {
  networkAlertCreateSchema,
  networkAlertQuerySchema,
  networkAlertUpdateSchema,
  networkPerformanceCreateSchema,
  networkPerformanceQuerySchema,
} from "@/modules/network";

export {
  networkAlertCreateSchema,
  networkAlertQuerySchema,
  networkAlertUpdateSchema,
  networkPerformanceCreateSchema,
  networkPerformanceQuerySchema,
};

export type NetworkAlertCreateData = z.infer<typeof networkAlertCreateSchema>;
