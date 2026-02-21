const fs = require('fs');
let file = fs.readFileSync('app/api/marketing/canvasing/route.ts', 'utf8');

file = file.replace(
    /noKtp: z\.string\(\)\.optional\(\),/,
    "noKtp: z.string().min(1, 'No KTP wajib diisi').trim(),"
);

file = file.replace(
    /paket: z\.string\(\)\.optional\(\),/,
    "paket: z.string().min(1, 'Paket wajib diisi').trim(),"
);

fs.writeFileSync('app/api/marketing/canvasing/route.ts', file);
