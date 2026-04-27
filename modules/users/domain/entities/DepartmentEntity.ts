export interface DepartmentCountsEntity {
  users: number;
}

export interface DepartmentEntity {
  id: string;
  name: string;
  description: string | null;
  jobDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  counts: DepartmentCountsEntity;
}
