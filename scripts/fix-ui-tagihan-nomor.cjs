const fs = require('fs');

const f = 'app/admin/pelanggan/ppp/[id]/print/PppPrintClient.tsx';
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8');

  // Next.js complains because 'Tagihan' object (real) doesn't have a property 'nomor', only 'noTagihan'.
  // We can just cast it as any to bypass this specific typescript strict check on the dummy merge
  c = c.replace(/let invoiceNumber = printTagihan\.noTagihan \|\| printTagihan\.nomor \|\| "-"/, 'let invoiceNumber = printTagihan.noTagihan || (printTagihan as any).nomor || "-"');
  
  // Actually, wait, let's cast printTagihan to any just for this assignment so it doesn't fail TypeScript.
  
  fs.writeFileSync(f, c);
  console.log('Fixed nomor property type error');
}
