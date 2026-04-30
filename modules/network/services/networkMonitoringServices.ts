import {
  NetworkAlertRepository,
  NetworkPerformanceRepository,
} from "../repositories";
import { NetworkAlertService } from "./NetworkAlertService";
import { NetworkPerformanceService } from "./NetworkPerformanceService";

let networkAlertServiceInstance: NetworkAlertService | null = null;
let networkPerformanceServiceInstance: NetworkPerformanceService | null = null;

/** Ambil singleton service alert jaringan. */
export function getNetworkAlertService(): NetworkAlertService {
  if (!networkAlertServiceInstance) {
    networkAlertServiceInstance = new NetworkAlertService(
      new NetworkAlertRepository(),
    );
  }

  return networkAlertServiceInstance;
}

/** Ambil singleton service performa jaringan. */
export function getNetworkPerformanceService(): NetworkPerformanceService {
  if (!networkPerformanceServiceInstance) {
    networkPerformanceServiceInstance = new NetworkPerformanceService(
      new NetworkPerformanceRepository(),
    );
  }

  return networkPerformanceServiceInstance;
}
