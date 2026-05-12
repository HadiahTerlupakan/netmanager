import { BillingScheduleReconciliationService } from "./BillingScheduleReconciliationService";

export class AutomaticIsolationService {
  static async runDailyCheck() {
    return new BillingScheduleReconciliationService().reconcile();
  }
}
