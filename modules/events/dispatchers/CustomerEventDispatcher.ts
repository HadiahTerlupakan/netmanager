import { eventBus, EVENT_NAMES, JOB_PRIORITIES } from "@/lib/event-bus";

export class CustomerEventDispatcher {
  /**
   * Dipanggil setelah Pelanggan baru dibuat.
   */
  static async onCreated(data: {
    customerId: string;
    customerName: string;
    packageId?: string;
    tenantId?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.CUSTOMER_CREATED, {
      customerId: data.customerId,
      customerName: data.customerName,
      packageId: data.packageId,
      tenantId: data.tenantId,
    });
  }

  /**
   * Dipanggil setelah data Pelanggan diupdate.
   */
  static async onUpdated(data: {
    customerId: string;
    customerName: string;
    packageId?: string;
    tenantId?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.CUSTOMER_UPDATED, {
      customerId: data.customerId,
      customerName: data.customerName,
      packageId: data.packageId,
      tenantId: data.tenantId,
    });
  }

  /**
   * Dipanggil setelah Pelanggan dinonaktifkan (suspended).
   */
  static async onSuspended(data: {
    customerId: string;
    customerName: string;
    oldStatus: string;
    newStatus: string;
    tenantId?: string;
  }) {
    await eventBus.publish(
      EVENT_NAMES.CUSTOMER_SUSPENDED,
      {
        customerId: data.customerId,
        customerName: data.customerName,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        tenantId: data.tenantId,
      },
      {
        priority: JOB_PRIORITIES.HIGH,
      },
    );
  }

  /**
   * Dipanggil setelah Pelanggan diaktifkan kembali.
   */
  static async onActivated(data: {
    customerId: string;
    customerName: string;
    oldStatus: string;
    newStatus: string;
    tenantId?: string;
  }) {
    await eventBus.publish(
      EVENT_NAMES.CUSTOMER_ACTIVATED,
      {
        customerId: data.customerId,
        customerName: data.customerName,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        tenantId: data.tenantId,
      },
      {
        priority: JOB_PRIORITIES.HIGH,
      },
    );
  }

  /**
   * Dipanggil setelah Pelanggan diisolir karena invoice overdue atau manual isolir.
   */
  static async onIsolated(data: {
    customerId: string;
    customerName: string;
    oldStatus: string;
    newStatus: string;
    tenantId?: string;
  }) {
    await eventBus.publish(
      EVENT_NAMES.CUSTOMER_ISOLATED,
      {
        customerId: data.customerId,
        customerName: data.customerName,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        tenantId: data.tenantId,
      },
      {
        priority: JOB_PRIORITIES.HIGH,
      },
    );
  }

  /**
   * Dipanggil setelah Pelanggan dihapus (dismantle).
   */
  static async onDeleted(data: {
    customerId: string;
    customerName?: string;
    username: string;
    tenantId?: string;
  }) {
    await eventBus.publish(
      EVENT_NAMES.CUSTOMER_DELETED,
      {
        customerId: data.customerId,
        customerName: data.customerName,
        username: data.username,
        tenantId: data.tenantId,
      },
      {
        priority: JOB_PRIORITIES.HIGH,
      },
    );
  }
}
