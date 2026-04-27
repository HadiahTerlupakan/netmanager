import type {
  CreateSalaryComponentInput,
  ISalaryComponentRepository,
  UpdateSalaryComponentInput,
} from "../domain/ports/ISalaryComponentRepository";
import { SalaryComponentRepository } from "../repositories/SalaryComponentRepository";

export class SalaryComponentService {
  private readonly componentRepository: ISalaryComponentRepository;

  constructor(
    componentRepository: ISalaryComponentRepository = new SalaryComponentRepository(),
  ) {
    this.componentRepository = componentRepository;
  }

  /** Get salary components and optional user assignments. */
  async getComponents(type?: "EARNING" | "DEDUCTION", userId?: string) {
    const components = await this.componentRepository.findAll(type);
    const userComponents = userId
      ? await this.componentRepository.getUserComponents(userId)
      : null;

    return { components, userComponents };
  }

  /** Find component by name. */
  async findByName(name: string) {
    return this.componentRepository.findByName(name);
  }

  /** Create salary component. */
  async createComponent(data: CreateSalaryComponentInput) {
    return this.componentRepository.create(data);
  }

  /** Update salary component. */
  async updateComponent(id: string, data: UpdateSalaryComponentInput) {
    return this.componentRepository.update(id, data);
  }

  /** Assign component to user. */
  async assignComponent(
    userId: string,
    componentId: string,
    amount: number,
    notes?: string,
  ) {
    return this.componentRepository.assignToUser(
      userId,
      componentId,
      amount,
      notes,
    );
  }

  /** Remove component from one user. */
  async removeUserComponent(
    userId: string,
    componentId: string,
  ): Promise<void> {
    await this.componentRepository.removeFromUser(userId, componentId);
  }

  /** Soft delete component. */
  async deleteComponent(id: string): Promise<void> {
    await this.componentRepository.delete(id);
  }
}

let salaryComponentServiceInstance: SalaryComponentService | null = null;

export function getSalaryComponentService(): SalaryComponentService {
  if (!salaryComponentServiceInstance) {
    salaryComponentServiceInstance = new SalaryComponentService();
  }

  return salaryComponentServiceInstance;
}
