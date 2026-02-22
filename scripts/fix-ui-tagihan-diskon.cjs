const fs = require('fs');

const f = 'app/admin/pelanggan/ppp/[id]/print/PppPrintClient.tsx';
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8');

  // Add 'diskon' to the dummy object so the type checker passes
  c = c.replace(/biayaLainnya: 0\n\s*\};/, 'biayaLainnya: 0,\n    diskon: 0\n  };');
  // I replaced tagihan.diskon with printTagihan.diskon, but if printTagihan might not have diskon, it complains.
  // We added diskon: 0 to the dummy object now.
  
  // Also checking tagihan.noTagihan -> printTagihan.noTagihan, it might complain about noTagihan not existing
  // Let's add noTagihan too.
  c = c.replace(/nomor:\s*'-',/, "nomor: '-',\n    noTagihan: '-',");

  fs.writeFileSync(f, c);
  console.log('Fixed diskon missing property error in printTagihan');
}
