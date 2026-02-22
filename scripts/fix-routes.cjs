const fs = require('fs');

const f = 'app/api/invoices/route.ts';
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/,\s*\n\s*,\s*\n/g, ',\n'); // Try to fix random commas
  // The error was from our naive replacements leaving things like `{ } },`
  c = c.replace(/{\s*}\s*},\s*\]/g, ']');
  fs.writeFileSync(f, c);
}
