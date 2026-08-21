const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'components', 'SupabaseManager.tsx');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  "isHealthy={status?.dbHealth === 'HEALTHY'}",
  "isHealthy={status?.dbHealth === 'CONNECTED' || status?.dbHealth === 'HEALTHY'}"
);
content = content.replace(
  "isHealthy={status?.realtimeHealth === 'ACTIVE'}",
  "isHealthy={status?.realtimeHealth === 'CONNECTED' || status?.realtimeHealth === 'ACTIVE'}"
);

fs.writeFileSync(p, content);
console.log('fixed badges');
