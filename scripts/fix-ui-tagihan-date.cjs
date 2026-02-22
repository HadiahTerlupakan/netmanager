const fs = require('fs');

const f = 'app/admin/pelanggan/ppp/[id]/print/PppPrintClient.tsx';
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8');

  // Change the dummy object date to string since it expects string (or rather formatDateShort expects string)
  c = c.replace(/createdAt: new Date\(\),/g, 'createdAt: new Date().toISOString(),');
  c = c.replace(/jatuhTempo: new Date\(new Date\(\)\.setMonth\(new Date\(\)\.getMonth\(\) \+ 1\)\),/g, 'jatuhTempo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),');
  
  // also fix type error: Argument of type 'string | Date' is not assignable to parameter of type 'string'
  // formatDateShort(printTagihan.createdAt as string)
  c = c.replace(/formatDateShort\(printTagihan\.createdAt\)/g, 'formatDateShort(printTagihan.createdAt as string)');
  c = c.replace(/formatDateShort\(printTagihan\.jatuhTempo\)/g, 'formatDateShort(printTagihan.jatuhTempo as string)');

  fs.writeFileSync(f, c);
  console.log('Fixed date type errors');
}
