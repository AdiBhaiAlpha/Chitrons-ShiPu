import React, { useState } from 'react';
import { Activity, Terminal, ShieldAlert, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, Info } from 'lucide-react';

interface FtpDiagnosticPanelProps {
  adminToken: string;
}

export const FtpDiagnosticPanel: React.FC<FtpDiagnosticPanelProps> = ({ adminToken }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    latencyMs: number;
    networkLatency: number;
    logs: string[];
    rawResponses: string[];
    advice: string;
    error?: string;
  } | null>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/ftp/diagnostic', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({
        success: false,
        latencyMs: 0,
        logs: ['Network failure during diagnostic request'],
        rawResponses: [],
        advice: 'Check your internet connection or server availability.',
        error: err.message
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">FTP Connection Diagnostic Tool</h3>
            <p className="text-[10px] text-slate-500">Live stability & authentication trace (Hardcoded Auth)</p>
          </div>
        </div>
        <button
          onClick={runDiagnostic}
          disabled={isRunning}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Analyzing Connection...' : 'Run Diagnostic Test'}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {!result && !isRunning && (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center mx-auto border border-slate-800">
              <Terminal className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto font-medium leading-relaxed">
              Click the button above to perform a deep-trace diagnostic on the hardcoded FTP connection. This will test handshake, auth, and data channel stability.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Status Summary */}
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${result.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              {result.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-bold ${result.success ? 'text-emerald-300' : 'text-rose-300'}`}>
                    Diagnostic {result.success ? 'PASSED' : 'FAILED'}
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-500">NET_PING: {result.networkLatency}ms</span>
                    <span className="text-[10px] font-mono text-slate-500">TOTAL: {result.latencyMs}ms</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  {result.success ? 'All synchronization gates are open. Credentials and passive data channels are fully verified.' : `Error: ${result.error || 'Connection failed'}`}
                </p>
              </div>
            </div>

            {/* Advice Section */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">Expert Advice</h5>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {result.advice}
                </p>
              </div>
            </div>

            {/* Logs & Raw Trace */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase px-1">Internal Process Log</h5>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar">
                  {result.logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <ChevronRight className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                      <span className="text-slate-400">{log}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase px-1">Raw Protocol Trace (Wire)</h5>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar text-slate-500">
                  {result.rawResponses.map((resp, i) => (
                    <div key={i} className="whitespace-pre-wrap break-words">
                      {resp}
                    </div>
                  ))}
                  {result.rawResponses.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-700 opacity-50 italic">
                      No protocol messages captured
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
           <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Diagnostic Engine v1.0</span>
        </div>
        <span className="text-[9px] text-slate-600 font-medium">Tracing: ftpupload.net (Port 21)</span>
      </div>
    </div>
  );
};
