import React, { useState, useEffect } from 'react';
import { safeFetchJson } from '../lib/fetchUtils';
import {
  Cpu,
  Server,
  Folder,
  FileCode,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  Shield,
  Clock,
  Activity,
  Globe,
  HeartPulse,
  Radio,
  Copy,
  Check,
  ExternalLink,
  Edit3,
  Save,
  Key,
  RefreshCw,
  Terminal
} from 'lucide-react';
import { D3SystemObservability, PerformanceReport } from './D3SystemObservability';

interface SystemManagerProps {
  token?: string;
}

interface RuntimeFileItem {
  filename: string;
  exists: boolean;
  sizeBytes: number;
  updatedAt: string | null;
  protected: boolean;
}

interface AvailabilityData {
  diagnostics: {
    environment: string;
    publicUrl: string;
    healthUrl: string;
    heartbeatStatus: string;
    lastHeartbeat: string;
    lastStatus: string;
    intervalMinutes: number;
    isVerified?: boolean;
    reachabilityMessage?: string;
  };
  uptimeSeconds: number;
  databaseConnected: boolean;
  databaseStatus: string;
  messengerStatus: string;
  fcaProvider: string;
  mqttStatus: string;
  accountName?: string;
}

export const SystemManager: React.FC<SystemManagerProps> = ({ token }) => {
  const [files, setFiles] = useState<RuntimeFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [savingUrl, setSavingUrl] = useState<boolean>(false);
  const [configStatusMsg, setConfigStatusMsg] = useState<string | null>(null);

  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [isLoadingPerf, setIsLoadingPerf] = useState<boolean>(false);

  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState<boolean>(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  const runGeminiDiagnostic = async () => {
    try {
      setRunningDiagnostic(true);
      setDiagnosticError(null);
      const data = await safeFetchJson('/api/system/gemini-diagnostic', null);
      if (data) setDiagnosticResult(data);
    } catch (err: any) {
      setDiagnosticError(err.message || 'Failed to run diagnostics');
    } finally {
      setRunningDiagnostic(false);
    }
  };

  useEffect(() => {
    fetchFileList();
    fetchAvailability();
    fetchPerformanceReport();
    runGeminiDiagnostic();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPerformanceReport();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const fetchPerformanceReport = async () => {
    try {
      setIsLoadingPerf(true);
      const data = await safeFetchJson('/api/system/performance', null);
      if (data) setPerformanceReport(data);
    } catch (err) {
      console.error('Failed to fetch performance report:', err);
    } finally {
      setIsLoadingPerf(false);
    }
  };

  const handleSimulateCommand = async (commandName: string, forceFail: boolean) => {
    try {
      await fetch('/api/system/performance/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandName, forceFail })
      });
      fetchPerformanceReport();
    } catch (err) {
      console.error('Failed to simulate command execution:', err);
    }
  };

  const handleResetMetrics = async () => {
    if (!confirm('Reset performance tracker statistics?')) return;
    try {
      await fetch('/api/system/performance/reset', { method: 'POST' });
      fetchPerformanceReport();
    } catch (err) {
      console.error('Failed to reset performance metrics:', err);
    }
  };

  const fetchAvailability = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const data = await safeFetchJson<AvailabilityData | null>(`/api/system/availability?origin=${encodeURIComponent(origin)}`, null);
      if (data && data.diagnostics) {
        setAvailability(data);
        if (data.diagnostics.publicUrl && data.diagnostics.publicUrl !== 'not_configured') {
          setCustomUrlInput(data.diagnostics.publicUrl);
        }
      }
    } catch (err) {
      console.error('Failed to fetch availability diagnostics:', err);
    }
  };

  const fetchFileList = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const data = await safeFetchJson<{ files?: RuntimeFileItem[] } | null>('/api/system/files', null, { headers });
      if (data && data.files) setFiles(data.files);
    } catch (err) {
      console.error('Failed to fetch runtime files list:', err);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text || text === 'not_configured') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveCustomUrl = async () => {
    if (!customUrlInput.trim()) return;
    setSavingUrl(true);
    setConfigStatusMsg(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/system/config-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ publicUrl: customUrlInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setConfigStatusMsg(data.message || 'Public URL saved successfully!');
        if (data.diagnostics) {
          setAvailability(prev => prev ? { ...prev, diagnostics: data.diagnostics } : null);
        }
      } else {
        setConfigStatusMsg(data.message || 'Failed to save URL');
      }
    } catch (err: any) {
      setConfigStatusMsg(`Error: ${err.message || err}`);
    } finally {
      setSavingUrl(false);
    }
  };

  const handleViewFile = async (filename: string) => {
    setSelectedFile(filename);
    setFileContent('');
    setFileError(null);

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/system/files?filename=${filename}`, { headers });
      const data = await res.json();

      if (!res.ok || data.error) {
        setFileError(data.error || 'Failed to read file.');
      } else {
        setFileContent(data.content);
      }
    } catch (err: any) {
      setFileError(err.message || 'Read error.');
    }
  };

  const handleGracefulRestart = async () => {
    if (!confirm('Perform a graceful restart of ShiPu Ai Bot process?')) return;
    setRestarting(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/system/restart', { method: 'POST', headers });
      setMessage('Graceful restart initiated. Service will re-initialize in 3 seconds.');
      setTimeout(() => {
        window.location.reload();
      }, 3500);
    } catch (err: any) {
      setMessage(`Restart error: ${err.message}`);
      setRestarting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-400" /> System Diagnostics & Runtime Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor process performance, inspect allowlisted runtime files, and trigger graceful bot restarts.
          </p>
        </div>

        <button
          onClick={handleGracefulRestart}
          disabled={restarting}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition flex items-center gap-2 disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
          <span>Graceful Process Restart</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-indigo-950/40 border border-indigo-800 text-indigo-300 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Server Availability & Self-Heartbeat Section */}
      {availability && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-400" /> Server Availability & Self-Heartbeat
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Self-monitoring engine pinging deployment health endpoint every {availability.diagnostics.intervalMinutes} minutes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                HEARTBEAT {availability.diagnostics.heartbeatStatus}
              </span>
            </div>
          </div>

          {/* Primary URL Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deployment URL Card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Deployment URL
                </span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
                  {availability.diagnostics.environment.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <a
                  href={availability.diagnostics.publicUrl !== 'not_configured' ? availability.diagnostics.publicUrl : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-indigo-300 hover:text-indigo-200 truncate flex items-center gap-1.5 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{availability.diagnostics.publicUrl}</span>
                </a>
                <button
                  onClick={() => handleCopy(availability.diagnostics.publicUrl, 'dep')}
                  disabled={availability.diagnostics.publicUrl === 'not_configured'}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition shrink-0 flex items-center gap-1 font-medium disabled:opacity-40"
                  title="Copy Deployment URL"
                >
                  {copiedKey === 'dep' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Health Check URL Card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Health Check URL
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md font-mono">
                  GET /health
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <a
                  href={availability.diagnostics.healthUrl !== 'not_configured' ? availability.diagnostics.healthUrl : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-emerald-300 hover:text-emerald-200 truncate flex items-center gap-1.5 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{availability.diagnostics.healthUrl}</span>
                </a>
                <button
                  onClick={() => handleCopy(availability.diagnostics.healthUrl, 'health')}
                  disabled={availability.diagnostics.healthUrl === 'not_configured'}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition shrink-0 flex items-center gap-1 font-medium disabled:opacity-40"
                  title="Copy Health Check URL"
                >
                  {copiedKey === 'health' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Sub Diagnostics info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Last Health Check
              </span>
              <div className="text-xs font-mono text-slate-200">
                {availability.diagnostics.lastHeartbeat.includes('T')
                  ? availability.diagnostics.lastHeartbeat.replace('T', ' ').slice(0, 19)
                  : availability.diagnostics.lastHeartbeat}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                FCA Provider & MQTT
              </span>
              <div className="text-xs font-semibold text-slate-200">
                {availability.fcaProvider} ({availability.mqttStatus})
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Messenger & Database
              </span>
              <div className="text-xs font-semibold text-slate-200">
                Session: {availability.messengerStatus} | DB: {availability.databaseStatus}
              </div>
            </div>
          </div>

          {/* PUBLIC_URL / DEPLOYMENT_URL Manual Override Configuration Field */}
          <div className="pt-2 border-t border-slate-800">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Manual PUBLIC_URL / DEPLOYMENT_URL Configuration
                </label>
                <span className="text-[10px] text-slate-400">Persisted in runtime settings</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://your-domain.app"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                />
                <button
                  onClick={handleSaveCustomUrl}
                  disabled={savingUrl || !customUrlInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingUrl ? 'Saving...' : 'Save & Verify URL'}</span>
                </button>
              </div>
              {configStatusMsg && (
                <p className="text-xs text-indigo-300 font-mono bg-indigo-950/40 p-2 rounded-lg border border-indigo-900/50">
                  {configStatusMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* D3 Health & Performance Observability Section */}
      <D3SystemObservability
        report={performanceReport}
        onRefresh={fetchPerformanceReport}
        onSimulate={handleSimulateCommand}
        onReset={handleResetMetrics}
        isLoading={isLoadingPerf}
      />

      {/* Gemini API Diagnostic Tool Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" /> Google AI Studio Secret Diagnostics
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Securely test GEMINI_API_KEY retrieval from project secrets and verify connectivity directly with the Google API servers.
            </p>
          </div>
          <button
            onClick={runGeminiDiagnostic}
            disabled={runningDiagnostic}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningDiagnostic ? 'animate-spin' : ''}`} />
            <span>{runningDiagnostic ? 'Pinging Google...' : 'Run Connectivity Diagnostic'}</span>
          </button>
        </div>

        {diagnosticError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/50 text-rose-300 rounded-xl text-xs flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{diagnosticError}</span>
          </div>
        )}

        {diagnosticResult ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Summary card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-slate-400">Connectivity:</span>
                  {diagnosticResult.success ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> SUCCESS
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-rose-400" /> FAILED
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Secret Detected:</span>
                  <span className={diagnosticResult.selectedVarName !== 'None' ? 'text-indigo-400 font-bold' : 'text-slate-500'}>
                    {diagnosticResult.selectedVarName}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">All Keys in Environment:</span>
                  <span className="text-slate-300">
                    {diagnosticResult.keysFound.length > 0 ? diagnosticResult.keysFound.join(', ') : 'None'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Masked Value:</span>
                  <span className="text-slate-300 font-semibold select-none">
                    {diagnosticResult.maskedKey}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">API Status Code:</span>
                  <span className={`font-bold ${diagnosticResult.responseStatus === 200 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {diagnosticResult.responseStatus || 'N/A'} {diagnosticResult.responseStatusText || ''}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ping Latency:</span>
                  <span className="text-slate-300 font-semibold">
                    {diagnosticResult.latencyMs ? `${diagnosticResult.latencyMs} ms` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Troubleshooting Insights</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The diagnostics tool bypasses standard client/server routing limits and queries the generative language endpoint directly. If the ping succeeds, your bot is ready and fully integrated!
                </p>
              </div>
            </div>

            {/* Response Card */}
            <div className="lg:col-span-7 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Google API Server Payload Output
              </span>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-slate-800">
                {diagnosticResult.apiResponse || (diagnosticResult.error ? `Error: ${diagnosticResult.error}` : 'No response payload.')}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl space-y-2">
            <span className="text-xs text-slate-400">Connectivity diagnostic has not been run yet.</span>
            <button
              onClick={runGeminiDiagnostic}
              disabled={runningDiagnostic}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              {runningDiagnostic ? 'Pinging Google...' : 'Run Diagnostics Now'}
            </button>
          </div>
        )}
      </div>

      {/* Runtime Files Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <Folder className="w-4 h-4 text-indigo-400" /> Allowlisted Runtime File Inspector
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {files.map(f => (
            <div
              key={f.filename}
              onClick={() => handleViewFile(f.filename)}
              className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                selectedFile === f.filename
                  ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-400" /> {f.filename}
                </span>
                {f.protected ? (
                  <span className="p-1 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> PROTECTED
                  </span>
                ) : (
                  <span className="p-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <Eye className="w-3 h-3" /> READABLE
                  </span>
                )}
              </div>

              <div className="space-y-1 text-[11px] text-slate-400 font-mono">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={f.exists ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {f.exists ? 'EXISTS' : 'MISSING'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span>{f.sizeBytes} bytes</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedFile && (
          <div className="mt-6 bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-indigo-300 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" /> {selectedFile}
              </span>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            {fileError ? (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{fileError}</span>
              </div>
            ) : (
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto max-h-96">
                {fileContent}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
