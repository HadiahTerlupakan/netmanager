import type { OnuDevice } from "../entities/onu-device.entity";

export interface IOnuRepository {
  findById(id: string): Promise<OnuDevice | null>;
  findBySerialNumber(serialNumber: string): Promise<OnuDevice | null>;
  findByOltId(oltId: string): Promise<OnuDevice[]>;
  create(
    input: Partial<OnuDevice> & {
      oltId: string;
      serialNumber: string;
      ponPort: number;
      onuIndex: number;
      tenantId: string;
    },
  ): Promise<OnuDevice>;
  update(id: string, input: Partial<OnuDevice>): Promise<OnuDevice>;
  delete(id: string): Promise<void>;
}
