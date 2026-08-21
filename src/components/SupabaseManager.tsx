import React, { useState, useEffect } from 'react';
import { Database, Server, Zap, RefreshCw, Key, Shield, ShieldCheck, Play, CheckCircle2, AlertTriangle, AlertCircle, FileText, Download, XCircle } from 'lucide-react';
import { safeFetchJson } from '../lib/fetchUtils';

interface SupabaseManagerProps {
  token: string;
}

export function SupabaseManager({ token }: SupabaseManagerProps) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ projectUrl: '', anonKey: '', serviceRoleKey: '', dbConnectionString: '', realtimeEnabled: true, networkMode: 'ipv6' });
  const [status, setStatus] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const conf = await safeFetchJson('/api/supabase/config', null, { headers: { 'Authorization': `Bearer ${token}` } });
      if (conf) setConfig(conf);
      const stat = await safeFetchJson('/api/supabase/status', null, { headers: { 'Authorization': `Bearer ${token}` } });
      if (stat) setStatus(stat);
    } catch (err: any) {
      setError(err.message || 'Failed to load Supabase config');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/supabase/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSuccess('Configuration saved successfully');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string, endpoint: string) => {
    setActionLoading(action);
    setError('');
    setSuccess('');
    setLogs([]);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.logs) {
        setLogs(data.logs);
      }
      
      if (!res.ok) throw new Error(data.error || `Action failed`);
      
      setSuccess(data.message || 'Action completed successfully');
      if (action !== 'clear-queue') {
        fetchData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const StatusBadge = ({ label, isHealthy, val }: { label: string, isHealthy: boolean, val?: string }) => (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
      <span className="text-sm text-slate-400 font-medium">{label}</span>
      <div className="flex items-center space-x-2">
        <span className={`text-sm font-bold ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
          {val || (isHealthy ? 'HEALTHY' : 'UNHEALTHY')}
        </span>
        {isHealthy ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-500" />
            Supabase Manager
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configure and manage Supabase Realtime architecture for Cloud Client Bots.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-400">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">{success}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                Connection Credentials
              </h3>
            </div>
            <div className="p-5">
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Project URL</label>
                  <input
                    type="text"
                    value={config.projectUrl}
                    onChange={e => setConfig({ ...config, projectUrl: e.target.value })}
                    placeholder="https://ubfqpeyosyuaxrlqomqp.supabase.co"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Anon Key (Optional for Client)</label>
                  <input
                    type="password"
                    value={config.anonKey}
                    onChange={e => setConfig({ ...config, anonKey: e.target.value })}
                    placeholder="eyJhb..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Service Role Key (Required for Server)</label>
                  <input
                    type="password"
                    value={config.serviceRoleKey}
                    onChange={e => setConfig({ ...config, serviceRoleKey: e.target.value })}
                    placeholder="••••••••••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Postgres Connection URL (Required for Database Init)</label>
                  <input
                    type="password"
                    value={config.dbConnectionString}
                    onChange={e => setConfig({ ...config, dbConnectionString: e.target.value })}
                    placeholder="postgresql://postgres.[project]:[password]@...:6543/postgres"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div className="flex items-center mt-4">
                  <input
                    type="checkbox"
                    id="realtimeEnabled"
                    checked={config.realtimeEnabled}
                    onChange={e => setConfig({ ...config, realtimeEnabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500/20"
                  />
                  <label htmlFor="realtimeEnabled" className="ml-2 text-sm text-slate-300 cursor-pointer select-none">
                    Enable Realtime Subscriptions
                  </label>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-indigo-900/20 flex items-center gap-2"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Save Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
             <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Administrative Actions
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={() => handleAction('test-connection', '/api/supabase/test-connection')}
                disabled={!!actionLoading}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white transition group border border-slate-700/50"
              >
                {actionLoading === 'test-connection' ? <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" /> : <Play className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />}
                <span className="text-xs font-semibold">Test Connection</span>
              </button>
              
              <button
                onClick={() => handleAction('initialize-db', '/api/supabase/initialize-db')}
                disabled={!!actionLoading}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white transition group border border-slate-700/50"
              >
                {actionLoading === 'initialize-db' ? <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" /> : <Database className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />}
                <span className="text-xs font-semibold">Initialize Database</span>
              </button>
              
              <button
                onClick={() => handleAction('reconnect', '/api/supabase/reconnect')}
                disabled={!!actionLoading}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white transition group border border-slate-700/50"
              >
                {actionLoading === 'reconnect' ? <RefreshCw className="w-5 h-5 animate-spin text-blue-400" /> : <RefreshCw className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />}
                <span className="text-xs font-semibold">Restart Listener</span>
              </button>
              
              <button
                onClick={() => handleAction('clear-queue', '/api/supabase/clear-queue')}
                disabled={!!actionLoading}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white transition group border border-slate-700/50"
              >
                {actionLoading === 'clear-queue' ? <RefreshCw className="w-5 h-5 animate-spin text-rose-400" /> : <XCircle className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />}
                <span className="text-xs font-semibold">Clear Queue</span>
              </button>
            </div>
          </div>
          
          {/* Logs Terminal */}
          {logs.length > 0 && (
             <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Execution Logs
                </h3>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className={log.includes('❌') ? 'text-rose-400' : log.includes('✔') ? 'text-emerald-400' : ''}>
                    {log}
                  </div>
                ))}
              </div>
             </div>
          )}
        </div>

        {/* Status Dashboard */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                System Health
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Primary Status */}
              <StatusBadge 
                label="Connection Status" 
                isHealthy={status?.isConnected} 
                val={status?.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              />
              {!status?.isConnected && status?.errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <p className="text-xs text-rose-400 font-mono break-all">{status.errorMsg}</p>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <span className="text-sm text-slate-400 font-medium">Latency</span>
                <span className="text-sm font-bold text-indigo-400">{status?.latency ? `${status.latency}ms` : '--'}</span>
              </div>

              {/* Persistent Configuration Section */}
              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Persistent Configuration</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    <span className="text-xs text-slate-400 font-medium">MongoDB Backup</span>
                    <span className={`text-xs font-bold ${status?.mongoBackupStatus === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {status?.mongoBackupStatus || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    <span className="text-xs text-slate-400 font-medium">FTP Backup</span>
                    <span className={`text-xs font-bold ${status?.ftpBackupStatus === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {status?.ftpBackupStatus || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    <span className="text-xs text-slate-400 font-medium">Auto Restore</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {status?.autoRestoreStatus || 'ENABLED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Component Live Status Section */}
              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Component Live Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    <span className="text-xs text-slate-400 font-medium">Supabase Database</span>
                    <span className={`text-xs font-bold ${status?.dbHealth === 'CONNECTED' || status?.dbHealth === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {status?.dbHealth || 'DISCONNECTED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    <span className="text-xs text-slate-400 font-medium">Realtime Engine</span>
                    <span className={`text-xs font-bold ${status?.realtimeHealth === 'CONNECTED' || status?.realtimeHealth === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {status?.realtimeHealth || 'DISCONNECTED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    <span className="text-xs text-slate-400 font-medium">Client Bot Watcher</span>
                    <span className={`text-xs font-bold ${status?.isConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {status?.isConfigured ? 'RUNNING' : 'STANDBY'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recovery Metadata & Diagnostics Section */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Configuration Diagnostics</h4>
                <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-xs text-slate-400">Config Version</span>
                  <span className="text-xs font-bold text-slate-300">v{status?.version || '1'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-xs text-slate-400">Network Mode</span>
                  <span className="text-xs font-bold text-slate-300 uppercase">{status?.networkMode || 'ipv6'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-xs text-slate-400">Credential Source</span>
                  <span className="text-xs font-bold text-indigo-400">{status?.credentialSource || 'Manual Configuration'}</span>
                </div>
                <div className="flex flex-col p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-1">
                  <span className="text-xs text-slate-400">Last Credential Restore</span>
                  <span className="text-[11px] font-mono text-slate-300">{status?.lastCredentialRestore || 'Never'}</span>
                </div>
                <div className="flex flex-col p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-1">
                  <span className="text-xs text-slate-400">Last Successful Connection</span>
                  <span className="text-[11px] font-mono text-slate-300">{status?.lastSuccessfulConnection || 'Never'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                Tables Status
              </h3>
            </div>
            <div className="p-3">
               {status?.tableStatuses && status.tableStatuses.length > 0 ? (
                 <div className="space-y-2">
                   {status.tableStatuses.map((t: any) => (
                     <div key={t.name} className="flex flex-col p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-300">{t.name}</span>
                          {t.exists ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          )}
                        </div>
                        {t.exists && <div className="text-[10px] text-slate-500 mt-1">{t.rows} rows</div>}
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-6 text-slate-500 text-sm">
                   No table data available. Initialize database first.
                 </div>
               )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
