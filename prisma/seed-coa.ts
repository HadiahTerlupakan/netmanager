
import { prisma } from "../lib/prisma";

const coaData = [
  // ASSETS
  // Current Assets
  { code: "1000", name: "ASSETS", type: "ASSET", normalBalance: "DEBIT", children: [
      { code: "1100", name: "Current Assets", type: "ASSET", subType: "CURRENT_ASSET", normalBalance: "DEBIT", children: [
          { code: "1101", name: "Cash on Hand", type: "ASSET", subType: "CURRENT_ASSET", normalBalance: "DEBIT" },
          { code: "1102", name: "Bank Central Asia (BCA)", type: "ASSET", subType: "CURRENT_ASSET", normalBalance: "DEBIT" },
          { code: "1103", name: "Bank Mandiri", type: "ASSET", subType: "CURRENT_ASSET", normalBalance: "DEBIT" },
          { code: "1104", name: "Accounts Receivable", type: "ASSET", subType: "CURRENT_ASSET", normalBalance: "DEBIT" },
          { code: "1105", name: "Inventory - Equipment", type: "ASSET", subType: "CURRENT_ASSET", normalBalance: "DEBIT" },
          { code: "1106", name: "Prepaid Expenses", type: "ASSET", subType: "CURRENT_ASSET", normalBalance: "DEBIT" },
      ]},
      // Fixed Assets
      { code: "1200", name: "Fixed Assets", type: "ASSET", subType: "FIXED_ASSET", normalBalance: "DEBIT", children: [
          { code: "1201", name: "Network Equipment (Routers/Switches)", type: "ASSET", subType: "FIXED_ASSET", normalBalance: "DEBIT" },
          { code: "1202", name: "Fiber Optic Infrastructure", type: "ASSET", subType: "FIXED_ASSET", normalBalance: "DEBIT" },
          { code: "1203", name: "Servers & Data Center", type: "ASSET", subType: "FIXED_ASSET", normalBalance: "DEBIT" },
          { code: "1204", name: "Vehicles", type: "ASSET", subType: "FIXED_ASSET", normalBalance: "DEBIT" },
          { code: "1205", name: "Office Equipment", type: "ASSET", subType: "FIXED_ASSET", normalBalance: "DEBIT" },
          { code: "1299", name: "Accumulated Depreciation", type: "ASSET", subType: "FIXED_ASSET", normalBalance: "CREDIT" },
      ]}
  ]},

  // LIABILITIES
  { code: "2000", name: "LIABILITIES", type: "LIABILITY", normalBalance: "CREDIT", children: [
      { code: "2100", name: "Current Liabilities", type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CREDIT", children: [
          { code: "2101", name: "Accounts Payable", type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CREDIT" },
          { code: "2102", name: "Unearned Revenue", type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CREDIT" },
          { code: "2103", name: "Tax Payable", type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CREDIT" },
          { code: "2104", name: "Salaries Payable", type: "LIABILITY", subType: "CURRENT_LIABILITY", normalBalance: "CREDIT" },
      ]},
      { code: "2200", name: "Long Term Liabilities", type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CREDIT", children: [
          { code: "2201", name: "Bank Loans", type: "LIABILITY", subType: "LONG_TERM_LIABILITY", normalBalance: "CREDIT" },
      ]}
  ]},

  // EQUITY
  { code: "3000", name: "EQUITY", type: "EQUITY", normalBalance: "CREDIT", children: [
      { code: "3100", name: "Owner's Capital", type: "EQUITY", subType: "EQUITY", normalBalance: "CREDIT" },
      { code: "3200", name: "Retained Earnings", type: "EQUITY", subType: "EQUITY", normalBalance: "CREDIT" },
      { code: "3300", name: "Opening Balance Equity", type: "EQUITY", subType: "EQUITY", normalBalance: "CREDIT" },
  ]},

  // REVENUE
  { code: "4000", name: "REVENUE", type: "REVENUE", normalBalance: "CREDIT", children: [
      { code: "4100", name: "Operating Revenue", type: "REVENUE", subType: "OPERATING_REVENUE", normalBalance: "CREDIT", children: [
          { code: "4101", name: "Internet Service Revenue", type: "REVENUE", subType: "OPERATING_REVENUE", normalBalance: "CREDIT" },
          { code: "4102", name: "Installation Fees", type: "REVENUE", subType: "OPERATING_REVENUE", normalBalance: "CREDIT" },
          { code: "4103", name: "Device Sales/Rental", type: "REVENUE", subType: "OPERATING_REVENUE", normalBalance: "CREDIT" },
      ]},
      { code: "4200", name: "Other Revenue", type: "REVENUE", subType: "OTHER_REVENUE", normalBalance: "CREDIT", children: [
          { code: "4201", name: "Interest Income", type: "REVENUE", subType: "OTHER_REVENUE", normalBalance: "CREDIT" },
      ]}
  ]},

  // EXPENSES
  { code: "5000", name: "EXPENSES", type: "EXPENSE", normalBalance: "DEBIT", children: [
      { code: "5100", name: "Cost of Goods Sold (COGS)", type: "EXPENSE", subType: "COGS", normalBalance: "DEBIT", children: [
          { code: "5101", name: "Bandwidth Costs", type: "EXPENSE", subType: "COGS", normalBalance: "DEBIT" },
          { code: "5102", name: "Network Infrastructure Maintenance", type: "EXPENSE", subType: "COGS", normalBalance: "DEBIT" },
          { code: "5103", name: "Field Technician Salaries", type: "EXPENSE", subType: "COGS", normalBalance: "DEBIT" },
      ]},
      { code: "5200", name: "Operating Expenses (OPEX)", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT", children: [
          { code: "5201", name: "Office Rent", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT" },
          { code: "5202", name: "Utilities (Electricity, Water, Internet)", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT" },
          { code: "5203", name: "Office Salaries", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT" },
          { code: "5204", name: "Marketing & Promotion", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT" },
          { code: "5205", name: "Legal & Professional Fees", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT" },
          { code: "5206", name: "Software Licenses", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT" },
          { code: "5207", name: "Travel & Transport", type: "EXPENSE", subType: "OPEX", normalBalance: "DEBIT" },
      ]},
      { code: "5300", name: "Capital Expenditures (CAPEX) - Tracking", type: "EXPENSE", subType: "CAPEX_TRACKING", normalBalance: "DEBIT", children: [
          { code: "5301", name: "Network Expansion Projects", type: "EXPENSE", subType: "CAPEX_TRACKING", normalBalance: "DEBIT" },
          { code: "5302", name: "New Equipment Purchase", type: "EXPENSE", subType: "CAPEX_TRACKING", normalBalance: "DEBIT" },
      ]},
      { code: "5900", name: "Tax Expenses", type: "EXPENSE", subType: "TAX", normalBalance: "DEBIT", children: [
          { code: "5901", name: "Corporate Income Tax", type: "EXPENSE", subType: "TAX", normalBalance: "DEBIT" },
          { code: "5902", name: "VAT Expenses", type: "EXPENSE", subType: "TAX", normalBalance: "DEBIT" },
      ]}
  ]}
];

async function seedCOA() {
  console.log("Seeding Chart of Accounts...");

  // Recursive function to create accounts and their children
  async function createAccountRecursive(accountData: any, parentId: string | null = null) {
    const { children, ...data } = accountData;

    // Check if exists
    let account = await prisma.chartOfAccount.findUnique({
      where: { code: data.code }
    });

    if (!account) {
      account = await prisma.chartOfAccount.create({
        data: {
          ...data,
          parentId
        }
      });
      console.log(`Created: ${data.code} - ${data.name}`);
    } else {
      console.log(`Skipped (Exists): ${data.code} - ${data.name}`);
    }

    if (children && children.length > 0) {
      for (const child of children) {
        await createAccountRecursive(child, account.id);
      }
    }
  }

  for (const rootAccount of coaData) {
    await createAccountRecursive(rootAccount);
  }

  console.log("Chart of Accounts seeding completed.");
}

seedCOA()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
