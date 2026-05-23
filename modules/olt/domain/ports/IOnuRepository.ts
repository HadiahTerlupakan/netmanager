import type { OnuDevice } from "../entities/onu-device.entity";

export interface IOnuRepository {
  findById(id: string, tenantId: string): Promise<OnuDevice | null>;
  findBySerialNumber(
    tenantId: string,
    serialNumber: string,
  ): Promise<OnuDevice | null>;
  findManyByOlt(oltId: string, tenantId: string): Promise<OnuDevice[]>;
  create(
    input: Partial<OnuDevice> & {
      oltId: string;
      serialNumber: string;
      ponPort: number;
      tenantId: string;
    },
  ): Promise<OnuDevice>;
  update(
    id: string,
    tenantId: string,
    input: Partial<OnuDevice>,
  ): Promise<OnuDevice>;
  delete(id: string, tenantId: string): Promise<void>;
}
