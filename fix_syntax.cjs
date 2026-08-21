const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'services', 'SupabaseService.ts');
let content = fs.readFileSync(p, 'utf8');

const regex = /  \}\n    const start = Date\.now\(\);[\s\S]*?error: err\.message \};\n    \}\n  \}/;
content = content.replace(regex, '  }');

fs.writeFileSync(p, content);
console.log('fixed syntax');
