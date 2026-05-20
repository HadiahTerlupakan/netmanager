import type { OltDevice } from "../../domain/entities/olt-device.entity";
import type {
  IOltAdapter,
  ServiceResult,
} from "../../domain/ports/IOltAdapter";
import type {
  DeregisterOnuParams,
  OnuStatusInfo,
  OpticalPower,
  RegisteredOnu,
  RegisterOnuParams,
  RemoveVlanParams,
  SetVlanParams,
  UnregisteredOnu,
} from "../../domain/entities/onu-device.entity";

export class HiosoAdapter implements IOltAdapter {
  private notImplemented(operation: string): ServiceResult<never> {
    return {
      success: false,
      error: `${operation} belum diimplementasi untuk Hioso`,
      code: "NOT_IMPLEMENTED",
    };
  }

  async testConnection(_device: OltDevice): Promise<ServiceResult<boolean>> {
    return this.notImplemented("testConnection");
  }
  async discoverUnregisteredOnus(
    _device: OltDevice,
  ): Promise<ServiceResult<UnregisteredOnu[]>> {
    return this.notImplemented("discoverUnregisteredOnus");
  }
  async findOnuBySerialNumber(
    _device: OltDevice,
    _sn: string,
  ): Promise<ServiceResult<UnregisteredOnu | null>> {
    return this.notImplemented("findOnuBySerialNumber");
  }
  async registerOnu(
    _device: OltDevice,
    _params: RegisterOnuParams,
  ): Promise<ServiceResult<RegisteredOnu>> {
    return this.notImplemented("registerOnu");
  }
  async deregisterOnu(
    _device: OltDevice,
    _params: DeregisterOnuParams,
  ): Promise<ServiceResult<void>> {
    return this.notImplemented("deregisterOnu");
  }
  async disableOnu(
    _device: OltDevice,
    _ponPort: number,
    _onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.notImplemented("disableOnu");
  }
  async enableOnu(
    _device: OltDevice,
    _ponPort: number,
    _onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.notImplemented("enableOnu");
  }
  async resetOnu(
    _device: OltDevice,
    _ponPort: number,
    _onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.notImplemented("resetOnu");
  }
  async rebootOnu(
    _device: OltDevice,
    _ponPort: number,
    _onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.notImplemented("rebootOnu");
  }
  async setOnuVlan(
    _device: OltDevice,
    _params: SetVlanParams,
  ): Promise<ServiceResult<void>> {
    return this.notImplemented("setOnuVlan");
  }
  async removeOnuVlan(
    _device: OltDevice,
    _params: RemoveVlanParams,
  ): Promise<ServiceResult<void>> {
    return this.notImplemented("removeOnuVlan");
  }
  async getOnuStatus(
    _device: OltDevice,
    _ponPort: number,
    _onuIndex: number,
  ): Promise<ServiceResult<OnuStatusInfo>> {
    return this.notImplemented("getOnuStatus");
  }
  async getOnuOpticalPower(
    _device: OltDevice,
    _ponPort: number,
    _onuIndex: number,
  ): Promise<ServiceResult<OpticalPower>> {
    return this.notImplemented("getOnuOpticalPower");
  }
  async getAllOnuStatuses(
    _device: OltDevice,
  ): Promise<ServiceResult<OnuStatusInfo[]>> {
    return this.notImplemented("getAllOnuStatuses");
  }
}
