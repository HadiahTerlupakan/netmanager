const fs = require('fs');

const f = 'app/api/invoices/route.ts';
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8');
  // It says line 70 is:
  //         where,
  //           invoiceItem: true,
  //           payment: true,
  //         },
  // Which is missing `include: {`
  c = c.replace(/where,\n\s*invoiceItem: true/g, 'where,\n        include: {\n          invoiceItem: true');
  
  // also let's look at lines 207-250 (there's more)
  fs.writeFileSync(f, c);
}
