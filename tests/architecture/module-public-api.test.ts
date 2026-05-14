import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const modulesDirectory = join(process.cwd(), "modules");

const modulesWithRestrictedPublicApi = readdirSync(modulesDirectory)
  .map((moduleName) => join("modules", moduleName, "index.ts"))
  .filter((indexPath) => statSync(join(process.cwd(), indexPath)).isFile());

const productionSourceDirectories = ["app", "components", "modules", "worker"];

const readProjectFile = (filePath: string) =>
  readFileSync(join(process.cwd(), filePath), "utf8");

const collectSourceFiles = (directory: string): string[] => {
  const absoluteDirectory = join(process.cwd(), directory);
  return readdirSync(absoluteDirectory).flatMap((entry) => {
    const absolutePath = join(absoluteDirectory, entry);
    const relativePath = join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return collectSourceFiles(relativePath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [relativePath] : [];
  });
};

const getOwningModule = (filePath: string) =>
  filePath.match(/^modules\/([^/]+)\//)?.[1] ?? null;

const internalModuleImportPattern =
  /(?:from\s+["']@\/modules\/([a-z0-9-]+)\/(repositories|services|utils|validators|mappers|domain|factories|constants)\/|import\(["']@\/modules\/([a-z0-9-]+)\/(repositories|services|utils|validators|mappers|domain|factories|constants)\/)/g;

interface InternalModuleImportViolation {
  filePath: string;
  importedModule: string;
  internalFolder: string;
}

const findInternalModuleImports = (
  sourceFiles: string[],
): InternalModuleImportViolation[] =>
  sourceFiles.flatMap((filePath) => {
    const source = readProjectFile(filePath);
    return [...source.matchAll(internalModuleImportPattern)].map((match) => ({
      filePath,
      importedModule: match[1] ?? match[3],
      internalFolder: match[2] ?? match[4],
    }));
  });

const formatInternalModuleImportViolation = (
  violation: InternalModuleImportViolation,
) =>
  `${violation.filePath} imports @/modules/${violation.importedModule}/${violation.internalFolder}/ directly`;

const getLineCount = (filePath: string) =>
  readProjectFile(filePath).split("\n").length;

const moduleHasDomainPorts = (moduleName: string) => {
  const portsDirectory = join(modulesDirectory, moduleName, "domain", "ports");

  try {
    return statSync(portsDirectory).isDirectory();
  } catch {
    return false;
  }
};

const collectNewModulePublicServiceFiles = () =>
  readdirSync(modulesDirectory)
    .filter(moduleHasDomainPorts)
    .flatMap((moduleName) => {
      const indexPath = join("modules", moduleName, "index.ts");
      const indexSource = readProjectFile(indexPath);

      return [
        ...indexSource.matchAll(/export \* from "(\.\/services\/[^"]+)";/g),
      ]
        .map((match) => `modules/${moduleName}/${match[1].slice(2)}.ts`)
        .filter((filePath) => statSync(join(process.cwd(), filePath)).isFile());
    });

const concreteRepositoryDependencyPattern =
  /(constructor\([^)]*=\s*new\s+\w+Repository\(|private\s+(?:readonly\s+)?\w+\s*=\s*new\s+\w+Repository\()/m;

const largeUiFileBaseline = new Set([
  "app/admin/integrations/mixradius/expenses/RABForm.tsx",
  "app/admin/integrations/mixradius/expenses/ExpensesClient.tsx",
  "app/admin/salary/users/SalaryUsersClient.tsx",
  "app/admin/integrations/mixradius/expenses/RABView.tsx",
  "app/admin/users/[id]/UsersDetailClient.tsx",
  "app/admin/integrations/mixradius/MixRadiusClient.tsx",
  "app/admin/workorders/list/WoListClient.tsx",
  "app/admin/attendance/AttendanceClient.tsx",
  "app/admin/mitra/MitraListClient.tsx",
  "app/admin/integrations/mixradius/expenses/RABList.tsx",
  "app/admin/mitra/[id]/MitraDetailClient.tsx",
  "app/admin/pengaturan/app-version/AppVersionClient.tsx",
  "app/admin/settings/roles/[id]/RolesDetailClient.tsx",
  "app/admin/users/new/UsersNewClient.tsx",
  "app/admin/workorders/WoIndexClient.tsx",
  "app/admin/workorders/new/WoNewClient.tsx",
]);

const dependencyInversionBaseline = new Set([
  "modules/attendance/services/LeaveService.ts",
  "modules/attendance/services/LocationTrackingService.ts",
  "modules/attendance/services/AttendanceSettingsService.ts",
  "modules/attendance/services/AttendanceQueryService.ts",
  "modules/attendance/services/HolidayLookupService.ts",
  "modules/attendance/services/LeaveBalanceQueryService.ts",
  "modules/attendance/services/AttendancePayrollQueryService.ts",
  "modules/attendance/services/AttendanceTimezoneService.ts",
  "modules/attendance/services/AttendanceValidationService.ts",
  "modules/attendance/services/EmployeeLeaveQueryService.ts",
  "modules/attendance/services/MobileLeaveRequestService.ts",
  "modules/attendance/services/AdminAttendanceRouteService.ts",
  "modules/attendance/services/AdminHolidayRouteService.ts",
  "modules/attendance/services/AdminAttendanceDetailRouteService.ts",
  "modules/attendance/services/AdminAttendanceBackdateRouteService.ts",
  "modules/attendance/services/AdminLeaveBalanceRouteService.ts",
  "modules/attendance/services/MobileAttendanceHistoryRouteService.ts",
  "modules/chat/services/ChatService.ts",
  "modules/finance/services/CompanyBankAccountService.ts",
  "modules/finance/services/PaymentGatewayConfigService.ts",
  "modules/finance/services/UnmatchedMutationService.ts",
  "modules/finance/services/ManualPaymentAdminRouteService.ts",
  "modules/finance/services/FinanceExpenseBridgeService.ts",
  "modules/finance/services/FinanceExpenseQueryService.ts",
  "modules/finance/services/InvestorAdminService.ts",
  "modules/finance/services/InvestorPortalAuthService.ts",
  "modules/finance/services/InvestorPortalDashboardService.ts",
  "modules/finance/services/InvestorPortalProjectService.ts",
  "modules/finance/services/InvestorPortalPayoutService.ts",
  "modules/finance/services/RabStatusEvaluationService.ts",
  "modules/finance/services/ExpenseRouteService.ts",
  "modules/finance/services/ExpenseCategoryRouteService.ts",
  "modules/finance/services/RabProjectRouteService.ts",
  "modules/finance/services/ReceivablesPageService.ts",
  "modules/finance/services/InvoiceProrateService.ts",
  "modules/payment-gateway/services/PaymentStatusUpdater.ts",
  "modules/payment-gateway/services/webhook-invoice-settlement-service.ts",
  "modules/payment-gateway/services/webhook-payment-lookup-service.ts",
  "modules/payment-gateway/services/webhook-processing-service.ts",
  "modules/payment-gateway/services/webhook-utils.ts",
  "modules/integrations/services/MixRadiusInvestorSiteService.ts",
  "modules/inventory/services/InventoryBarangService.ts",
  "modules/inventory/services/InventoryBarangRouteService.ts",
  "modules/inventory/services/InventoryGudangRouteService.ts",
  "modules/inventory/services/InventoryTransferRouteService.ts",
  "modules/inventory/services/InventoryMasukRouteService.ts",
  "modules/inventory/services/InventoryKeluarRouteService.ts",
  "modules/inventory/services/InventoryStockMovementService.ts",
  "modules/inventory/services/InventoryRestockCheckService.ts",
  "modules/inventory/services/InventoryQueryService.ts",
  "modules/inventory/services/InventoryRouteService.ts",
  "modules/inventory/services/MobileInventoryService.ts",
  "modules/inventory/services/InventoryStockService.ts",
  "modules/mitra/services/MitraIdCardService.ts",
  "modules/network/services/RadiusAdminService.ts",
  "modules/network/services/MikroTikRouterService.ts",
  "modules/network/services/ProfilePPPService.ts",
  "modules/network/services/BandwidthRouteService.ts",
  "modules/network/services/OdpRouteService.ts",
  "modules/network/services/MobileTopologyService.ts",
  "modules/network/services/DeviceBackupService.ts",
  "modules/network/services/MikroTikStatisticsService.ts",
  "modules/notification/services/AnnouncementService.ts",
  "modules/overtime/services/OvertimeService.ts",
  "modules/overtime/services/EmployeeOvertimeQueryService.ts",
  "modules/overtime/services/OvertimeAutoCheckoutSchedulerService.ts",
  "modules/overtime/services/OvertimeQueryService.ts",
  "modules/pelanggan/services/CustomerLegacyBillingService.ts",
  "modules/pelanggan/services/AdminSupportTicketService.ts",
  "modules/pelanggan/services/AdminCustomerInvoiceRouteService.ts",
  "modules/pelanggan/services/PelangganAdminQueryService.ts",
  "modules/pelanggan/services/PelangganAdminMutationService.ts",
  "modules/procurement/services/ProcurementService.ts",
  "modules/users/services/UserLookupService.ts",
  "modules/work-order/services/AdminWorkOrderRouteService.ts",
  "modules/work-order/services/AdminWorkOrderConfigService.ts",
  "modules/work-order/services/AdminWorkOrderDashboardService.ts",
  "modules/work-order/services/WorkOrderReminderService.ts",
  "modules/network/services/HargaPaketService.ts",
  "modules/network/services/NetworkPerformanceService.ts",
  "modules/network/services/NetworkAlertService.ts",
  "modules/chat/services/ChatService.ts",
  "modules/mitra/services/MitraIdCardService.ts",
  "modules/notification/services/AnnouncementService.ts",
  "modules/overtime/services/OvertimeService.ts",
  "modules/overtime/services/EmployeeOvertimeQueryService.ts",
  "modules/overtime/services/OvertimeAutoCheckoutSchedulerService.ts",
  "modules/overtime/services/OvertimeQueryService.ts",
  "modules/pelanggan/services/CustomerLegacyBillingService.ts",
  "modules/pelanggan/services/AdminSupportTicketService.ts",
  "modules/pelanggan/services/AdminCustomerInvoiceRouteService.ts",
  "modules/pelanggan/services/PelangganAdminQueryService.ts",
  "modules/pelanggan/services/PelangganAdminMutationService.ts",
]);

describe("module public api boundaries", () => {
  it.each(modulesWithRestrictedPublicApi)(
    "does not export repository implementations from %s",
    (indexPath) => {
      const source = readProjectFile(indexPath);

      expect(source).not.toMatch(/^export .*\.\/repositories\//m);
    },
  );

  it("does not import another module's internal folders", () => {
    const sourceFiles = productionSourceDirectories.flatMap(collectSourceFiles);
    const violations = findInternalModuleImports(sourceFiles).filter(
      (violation) =>
        violation.importedModule !== getOwningModule(violation.filePath),
    );

    expect(violations.map(formatInternalModuleImportViolation)).toEqual([]);
  });

  it("does not expose module internals through lib compatibility files", () => {
    const sourceFiles = collectSourceFiles("lib");
    const violations = findInternalModuleImports(sourceFiles);

    expect(violations.map(formatInternalModuleImportViolation)).toEqual([]);
  });

  it("keeps API route handlers thin", () => {
    const routeFiles = collectSourceFiles("app/api").filter((filePath) =>
      /\/(route|route-handlers)\.tsx?$/.test(filePath),
    );
    const violations = routeFiles
      .map((filePath) => ({ filePath, lineCount: getLineCount(filePath) }))
      .filter((route) => route.lineCount > 200)
      .map((route) => `${route.filePath} has ${route.lineCount} lines`);

    expect(violations).toEqual([]);
  });

  it("keeps UI component files focused", () => {
    const uiFiles = ["app", "components"]
      .flatMap(collectSourceFiles)
      .filter((filePath) => filePath.endsWith(".tsx"));
    const largeFiles = uiFiles
      .map((filePath) => ({ filePath, lineCount: getLineCount(filePath) }))
      .filter((file) => file.lineCount > 1000);
    const violations = largeFiles
      .filter((file) => !largeUiFileBaseline.has(file.filePath))
      .map((file) => `${file.filePath} has ${file.lineCount} lines`);
    const staleBaseline = [...largeUiFileBaseline].filter(
      (filePath) => !largeFiles.some((file) => file.filePath === filePath),
    );

    expect(violations).toEqual([]);
    expect(staleBaseline).toEqual([]);
  });

  it("keeps backend module files focused", () => {
    const backendFiles = ["modules", "lib"]
      .flatMap(collectSourceFiles)
      .filter((filePath) => !filePath.endsWith(".tsx"));
    const allowedLargeFiles = new Set([
      "lib/auth.ts",
      "lib/utils/snmp-helpers.ts",
      "modules/attendance/repositories/AttendanceRepository.ts",
      "modules/attendance/services/AttendanceService.ts",
      "modules/attendance/services/LeaveService.ts",
      "modules/finance/repositories/RabProjectRepository.ts",
      "modules/integrations/services/mixradius-customer-client.ts",
      "modules/inventory/repositories/InventoryApiRepository.ts",
      "modules/inventory/repositories/InventoryRepository.ts",
      "modules/inventory/services/RestockRequestService.ts",
      "modules/network/repositories/RadiusRepository.ts",
      "modules/network/services/mikrotik-ppp-profile.ts",
      "modules/work-order/repositories/WorkOrderRepository.ts",
      "modules/work-order/services/AdminWorkOrderRouteService.ts",
      "modules/work-order/services/MobileWorkOrderActionService.ts",
      "modules/work-order/services/WorkOrderService.ts",
    ]);
    const violations = backendFiles
      .map((filePath) => ({ filePath, lineCount: getLineCount(filePath) }))
      .filter(
        (file) => file.lineCount > 800 && !allowedLargeFiles.has(file.filePath),
      )
      .map((file) => `${file.filePath} has ${file.lineCount} lines`);

    expect(violations).toEqual([]);
  });

  it("keeps new module services dependent on repository ports", () => {
    const filesWithConcreteDependencies =
      collectNewModulePublicServiceFiles().filter((filePath) =>
        concreteRepositoryDependencyPattern.test(readProjectFile(filePath)),
      );
    const violations = filesWithConcreteDependencies.filter(
      (filePath) => !dependencyInversionBaseline.has(filePath),
    );

    expect(violations).toEqual([]);
  });

  it("does not instantiate work-order repositories while loading public API services", () => {
    const publicApiSource = readProjectFile("modules/work-order/index.ts");
    const exportedServicePaths = [
      ...publicApiSource.matchAll(/export \* from "(\.\/services\/[^\"]+)";/g),
    ]
      .map((match) => `modules/work-order/${match[1].slice(2)}.ts`)
      .filter((filePath) => statSync(join(process.cwd(), filePath)).isFile());

    for (const servicePath of exportedServicePaths) {
      const source = readProjectFile(servicePath);
      const serviceClassName = servicePath
        .split("/")
        .at(-1)
        ?.replace(".ts", "");

      expect(source, servicePath).not.toMatch(
        /(constructor\([^)]*=\s*new\s+(?:WorkOrderRepository|TicketRepository|AdminWorkOrderRouteRepository)\(|private\s+(?:readonly\s+)?\w+\s*=\s*new\s+(?:WorkOrderRepository|TicketRepository|AdminWorkOrderRouteRepository)\(|^export\s+const\s+\w+\s*=\s*new\s+(?:WorkOrderRepository|TicketRepository|AdminWorkOrderRouteRepository)\(|^const\s+\w+\s*=\s*new\s+(?:WorkOrderRepository|TicketRepository|AdminWorkOrderRouteRepository)\()/m,
      );

      if (
        serviceClassName &&
        /WorkOrderRepository|TicketRepository/.test(source)
      ) {
        expect(source, servicePath).not.toMatch(
          new RegExp(
            `export\\s+const\\s+\\w+\\s*=\\s*new\\s+${serviceClassName}\\(`,
          ),
        );
      }
    }
  });
});
