const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'server.ts');
let content = fs.readFileSync(p, 'utf8');

const regex = /const \{ projectUrl, anonKey, serviceRoleKey, dbConnectionString, realtimeEnabled \} = req\.body;/;
const replacement = "const { projectUrl, anonKey, serviceRoleKey, dbConnectionString, realtimeEnabled, networkMode } = req.body;";
content = content.replace(regex, replacement);

const regex2 = /if \(realtimeEnabled !== undefined\) updates\.realtimeEnabled = realtimeEnabled;/;
const replacement2 = "if (realtimeEnabled !== undefined) updates.realtimeEnabled = realtimeEnabled;\n    if (networkMode !== undefined) updates.networkMode = networkMode;";
content = content.replace(regex2, replacement2);

fs.writeFileSync(p, content);
console.log('patched server.ts');
