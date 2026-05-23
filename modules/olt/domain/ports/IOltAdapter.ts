import type { OltDevice } from "../entities/olt-device.entity";
import type { DiscoveredCard } from "../entities/olt-card.entity";
import type {
  DeregisterOnuParams,
  DiscoveredRegisteredOnu,
  OnuStatusInfo,
  OnuTrafficStats,
  OpticalPower,
  RegisteredOnu,
  RegisterOnuParams,
  RemoveVlanParams,
  SetVlanParams,
  UnregisteredOnu,
} from "../entities/onu-device.entity";

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface IOltAdapter {
  testConnection(device: OltDevice): Promise<ServiceResult<boolean>>;
  discoverUnregisteredOnus(
    device: OltDevice,
  ): Promise<ServiceResult<UnregisteredOnu[]>>;
  /**
   * Discover ONU yang sudah teregistrasi di OLT.
   * Dipakai untuk import existing ONU ke DB app saat OLT pertama kali
   * ditambahkan / sync ulang state.
   */
  discoverRegisteredOnus(
    device: OltDevice,
  ): Promise<ServiceResult<DiscoveredRegisteredOnu[]>>;
  /**
   * Discover VLAN per-ONU dari service-port table.
   * Return Map keyed by `${frame}:${slot}:${port}:${onuIndex}` ke VLAN ID.
   */
  discoverServicePortVlans(
    device: OltDevice,
  ): Promise<
    ServiceResult<Map<string, { vlanId: number; serviceMode: number }>>
  >;
  /**
   * Discover phase state real per ONU (working/offline/dying_gasp).
   * Return Map keyed by `${frame}:${slot}:${port}:${onuIndex}` ke OnuStatusInfo["status"].
   */
  discoverOnuPhaseStates(
    device: OltDevice,
  ): Promise<ServiceResult<Map<string, OnuStatusInfo["status"]>>>;
  /**
   * Discover RX+TX power per ONU dari ZXGPON-MIB.
   * Return Map keyed by `${frame}:${slot}:${port}:${onuIndex}` ke
   * { rxPower, txPower } dalam dBm.
   */
  discoverOnuRxPowers(
    device: OltDevice,
  ): Promise<
    ServiceResult<
      Map<string, { rxPower: number | null; txPower: number | null }>
    >
  >;
  findOnuBySerialNumber(
    device: OltDevice,
    sn: string,
  ): Promise<ServiceResult<UnregisteredOnu | null>>;
  registerOnu(
    device: OltDevice,
    params: RegisterOnuParams,
  ): Promise<ServiceResult<RegisteredOnu>>;
  deregisterOnu(
    device: OltDevice,
    params: DeregisterOnuParams,
  ): Promise<ServiceResult<void>>;
  disableOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>>;
  enableOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>>;
  resetOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>>;
  rebootOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>>;
  setOnuVlan(
    device: OltDevice,
    params: SetVlanParams,
  ): Promise<ServiceResult<void>>;
  removeOnuVlan(
    device: OltDevice,
    params: RemoveVlanParams,
  ): Promise<ServiceResult<void>>;
  getOnuStatus(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<OnuStatusInfo>>;
  getOnuOpticalPower(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
    slot?: number,
  ): Promise<ServiceResult<OpticalPower>>;
  getAllOnuStatuses(device: OltDevice): Promise<ServiceResult<OnuStatusInfo[]>>;
  discoverCards?(device: OltDevice): Promise<ServiceResult<DiscoveredCard[]>>;
  getOnuTrafficStats?(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
    slot?: number,
  ): Promise<ServiceResult<OnuTrafficStats>>;
}
