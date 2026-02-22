const fs = require('fs');

const f = 'app/api/invoices/route.ts';
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8');
  
  // Around line 70
  c = c.replace(/where,\n\s*invoiceItem:\s*true/g, 'where,\n        include: {\n          invoiceItem: true');
  
  // Around line 205
  c = c.replace(/data:\s*createData\s*as\s*PrismaBilling\.InvoiceCreateInput,\n\s*invoiceItem:\s*true/g, 'data: createData as PrismaBilling.InvoiceCreateInput,\n        include: {\n          invoiceItem: true');

  fs.writeFileSync(f, c);
}
