/** Pure domain entity for RAB project ordering and listing use cases. */
export interface RabProjectEntity {
  id: string;
  name: string;
  status: string;
  startDate?: Date | null;
  investmentDurationMonths?: number | null;
  targetSubscribers?: number | null;
  updatedAt?: Date;
  createdAt?: Date;
}
