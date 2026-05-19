/**
 * RoleFactory
 *
 * Factory pattern for creating Role with predefined templates.
 */

import type { CreateRoleDTO } from "../dto/RoleDTO";

export class RoleFactory {
  /**
   * Create Admin role template
   */
  static createAdmin(name: string = "Admin"): CreateRoleDTO {
    return {
      name,
      description: "Full access to admin panel",
      accessAdminPanel: true,
      accessEmployeePanel: true,
      isRestricted: false,
      isTechnical: false,
      permissions: [
        // Users
        "users:read",
        "users:create",
        "users:update",
        "users:delete",
        // Pelanggan
        "pelanggan:read",
        "pelanggan:create",
        "pelanggan:update",
        "pelanggan:delete",
        // Work Orders
        "workorders:read",
        "workorders:create",
        "workorders:update",
        "workorders:delete",
        // Tickets
        "tickets:read",
        "tickets:update",
        // Invoices
        "invoices:read",
        "invoices:create",
        "invoices:update",
        // Reports
        "reports:read",
        // Settings (umum + api)
        "umum:read",
        "umum:update",
        "api:read",
        "api:update",
      ],
    };
  }

  /**
   * Create Technician role template
   */
  static createTechnician(name: string = "Teknisi"): CreateRoleDTO {
    return {
      name,
      description: "Field technician for installations and repairs",
      accessAdminPanel: false,
      accessEmployeePanel: true,
      isRestricted: true,
      isTechnical: true,
      permissions: [
        // Work Orders (limited)
        "workorders:read",
        "workorders:update",
        "workorders:department_only", // Restriction flag
        // Attendance
        "attendance:read",
        "attendance:create",
        // Inventory (usage only)
        "inventory:read",
      ],
    };
  }

  /**
   * Create Customer Service role template
   */
  static createCustomerService(
    name: string = "Customer Service",
  ): CreateRoleDTO {
    return {
      name,
      description: "Handle customer inquiries and tickets",
      accessAdminPanel: true,
      accessEmployeePanel: true,
      isRestricted: true,
      isTechnical: false,
      permissions: [
        // Pelanggan (read only)
        "pelanggan:read",
        // Tickets
        "tickets:read",
        "tickets:create",
        "tickets:update",
        // Work Orders (create requests)
        "workorders:read",
        "workorders:create",
        // Invoices (read only)
        "invoices:read",
      ],
    };
  }

  /**
   * Create Finance role template
   */
  static createFinance(name: string = "Finance"): CreateRoleDTO {
    return {
      name,
      description: "Handle billing and financial operations",
      accessAdminPanel: true,
      accessEmployeePanel: false,
      isRestricted: true,
      isTechnical: false,
      permissions: [
        // Pelanggan (billing info)
        "pelanggan:read",
        // Invoices
        "invoices:read",
        "invoices:create",
        "invoices:update",
        "invoices:delete",
        // Payments
        "payments:read",
        "payments:create",
        "payments:verify",
        // Reports
        "reports:read",
      ],
    };
  }

  /**
   * Create Sales role template
   */
  static createSales(name: string = "Sales"): CreateRoleDTO {
    return {
      name,
      description: "Sales team for customer acquisition",
      accessAdminPanel: true,
      accessEmployeePanel: true,
      isRestricted: true,
      isTechnical: false,
      permissions: [
        // Pelanggan
        "pelanggan:read",
        "pelanggan:create",
        // Work Orders (installation requests)
        "workorders:read",
        "workorders:create",
        // Packages
        "paket:read",
        // Reports (sales only)
        "sales_dashboard:read",
      ],
    };
  }

  /**
   * Create Supervisor role template
   */
  static createSupervisor(name: string = "Supervisor"): CreateRoleDTO {
    return {
      name,
      description: "Team supervisor with approval rights",
      accessAdminPanel: true,
      accessEmployeePanel: true,
      isRestricted: true,
      isTechnical: true,
      permissions: [
        // Users (view team)
        "users:read",
        // Work Orders
        "workorders:read",
        "workorders:update",
        "workorders:approve_request",
        "workorders:department_only",
        // Attendance
        "attendance:read",
        "attendance:update",
        // Reports
        "reports:read",
      ],
    };
  }

  /**
   * Create read-only Viewer role
   */
  static createViewer(name: string = "Viewer"): CreateRoleDTO {
    return {
      name,
      description: "Read-only access for monitoring",
      accessAdminPanel: true,
      accessEmployeePanel: false,
      isRestricted: true,
      isTechnical: false,
      permissions: [
        "users:read",
        "pelanggan:read",
        "workorders:read",
        "tickets:read",
        "invoices:read",
        "reports:read",
      ],
    };
  }

  /**
   * Parse permission string to resource and action
   */
  static parsePermission(permission: string): {
    resource: string;
    action: string;
  } {
    const [resource, action] = permission.split(":");
    return { resource, action };
  }

  /**
   * Build permission string from resource and action
   */
  static buildPermission(resource: string, action: string): string {
    return `${resource}:${action}`;
  }
}
