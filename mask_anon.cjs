const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'server.ts');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  "anonKey: config.anonKey,",
  "anonKey: config.anonKey ? '••••••••••••••••••••' : '',"
);

content = content.replace(
  "if (anonKey !== undefined) updates.anonKey = anonKey;",
  "if (anonKey !== undefined && anonKey !== '••••••••••••••••••••') updates.anonKey = anonKey;"
);

fs.writeFileSync(p, content);
console.log('masked anonKey');
