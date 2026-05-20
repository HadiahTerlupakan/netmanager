import type { OltDevice } from "../entities/olt-device.entity";
import type {
  DeregisterOnuParams,
  OnuStatusInfo,
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
  ): Promise<ServiceResult<OpticalPower>>;
  getAllOnuStatuses(device: OltDevice): Promise<ServiceResult<OnuStatusInfo[]>>;
}
