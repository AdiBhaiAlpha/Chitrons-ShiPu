const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), 'src', 'services', 'SupabaseService.ts');
let content = fs.readFileSync(p, 'utf8');

// Replace imports
content = content.replace(
  "import { BotSettingModel } from '../db/mongodb';",
  "import { BotSettingModel, SystemCredentialModel } from '../db/mongodb';\nimport { encrypt, decrypt } from '../utils/crypto';\nimport dns from 'dns/promises';\nimport net from 'net';"
);

// Add networkMode to SupabaseConfig
content = content.replace(
  "  realtimeEnabled: boolean;\n}",
  "  realtimeEnabled: boolean;\n  networkMode?: 'ipv6' | 'auto';\n}"
);

// Add default networkMode
content = content.replace(
  "    realtimeEnabled: true\n  };",
  "    realtimeEnabled: true,\n    networkMode: 'ipv6'\n  };"
);

fs.writeFileSync(p, content);
console.log('patched');
