const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'components', 'SupabaseManager.tsx');
let content = fs.readFileSync(p, 'utf8');

// Update state to include networkMode
content = content.replace(
  "const [config, setConfig] = useState({ projectUrl: '', anonKey: '', serviceRoleKey: '', dbConnectionString: '', realtimeEnabled: true });",
  "const [config, setConfig] = useState({ projectUrl: '', anonKey: '', serviceRoleKey: '', dbConnectionString: '', realtimeEnabled: true, networkMode: 'ipv6' });"
);

// Add networkMode select input
const networkModeHtml = `
                <div className="flex items-center justify-between mt-4 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-slate-300">Network Mode</label>
                    <span className="text-[10px] text-slate-500">Prefer IPv6 for direct connections</span>
                  </div>
                  <select 
                    value={config.networkMode} 
                    onChange={e => setConfig({ ...config, networkMode: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ipv6">IPv6 (Preferred)</option>
                    <option value="auto">Auto (Fallback to IPv4)</option>
                  </select>
                </div>
`;
content = content.replace(
  '<button\n                  type="submit"',
  networkModeHtml + '\n                <button\n                  type="submit"'
);

// Add new stats to System Health
const newStats = `
              <StatusBadge 
                label="Network Mode" 
                isHealthy={status?.networkMode === 'ipv6'} 
                val={(status?.networkMode || 'UNKNOWN').toUpperCase()}
              />
              <StatusBadge 
                label="Config Backup" 
                isHealthy={status?.backupStatus === 'Backed Up'} 
                val={status?.backupStatus || 'Unknown'}
              />
              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <span className="text-sm text-slate-400 font-medium">Config Version</span>
                <span className="text-sm font-bold text-slate-300">v{status?.version || '1'}</span>
              </div>
`;
content = content.replace(
  '<div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">\n                <span className="text-sm text-slate-400 font-medium">Latency</span>',
  newStats + '\n              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">\n                <span className="text-sm text-slate-400 font-medium">Latency</span>'
);

fs.writeFileSync(p, content);
console.log('patched UI');
