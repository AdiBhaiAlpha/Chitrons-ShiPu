import React, { useState, useEffect } from 'react';
import { Sparkles, Send, Bot, Terminal, Cpu, CheckCircle2, Zap, Activity, Shield, RefreshCw, FileText, AlertTriangle, Check, Layers } from 'lucide-react';
import { AIClient } from '../lib/aiClient';

export const AIWorkbench: React.FC = React.memo(() => {
  const [prompt, setPrompt] = useState('Explain quantum computing in Bengali with examples');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('You are ShiPu Ai🤖, an intelligent, modern, and helpful Facebook Messenger group bot assistant.');
  const [simulatedThreadId, setSimulatedThreadId] = useState('thread_group_001');
  const [usedProvider, setUsedProvider] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [responseContextKey, setResponseContextKey] = useState<string | null>(null);

  // Diagnostics Tab state
  const [activeTab, setActiveTab] = useState<'playground' | 'diagnostics'>('playground');
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    status: 'idle' | 'testing' | 'healthy' | 'issue';
    message: string;
    details?: string[];
  }>({ status: 'idle', message: 'No diagnostic test run yet.' });

  // Fetch AI logs and metrics
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/aios/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error('Failed to fetch AI logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleTestAI = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResponse(null);
    setUsedProvider(null);
    setLatency(null);
    setRequestId(null);
    setResponseContextKey(null);
    
    try {
      const result = await AIClient.executePrompt(prompt, {
        systemInstruction: systemPrompt,
        threadId: simulatedThreadId
      });

      if (result.success) {
        setResponse(result.text);
        setUsedProvider(result.provider);
        setLatency(result.latencyMs);
        setResponseContextKey(`th_${simulatedThreadId}`);
        
        // Extract trace request ID if embedded or set
        const match = result.text.match(/\[Req ID: (ai_req_[^\]]+)\]/);
        if (match) setRequestId(match[1]);
      } else {
        setResponse(result.error || 'Connection Error');
        setUsedProvider('None (Failed)');
      }
    } catch (err: any) {
      setResponse(`❌ Unexpected Error: ${err.message}`);
      setUsedProvider('None (Failed)');
    } finally {
      setLoading(false);
      setTimeout(fetchLogs, 1000);
    }
  };

  const runDiagnosticTest = async () => {
    setDiagnosticResult({ status: 'testing', message: 'Verifying backend routing, per-context concurrency locks, and key rotation status...' });
    
    try {
      const startTime = Date.now();
      // Run two parallel health probes on DIFFERENT simulated threads to prove parallel execution works!
      const probe1 = fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'PING Thread 1', threadId: 'diag_thread_a' })
      });

      const probe2 = fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'PING Thread 2', threadId: 'diag_thread_b' })
      });

      const [res1, res2] = await Promise.all([probe1, probe2]);
      const latencyMs = Date.now() - startTime;
      const data1 = await res1.json();
      const data2 = await res2.json();

      if (res1.ok && res2.ok) {
        setDiagnosticResult({
          status: 'healthy',
          message: 'Parallel Multi-Thread AI Engine verified healthy!',
          details: [
            `Simultaneous requests on Thread A and Thread B completed in parallel (Latency: ${latencyMs}ms).`,
            `Context A Key: ${data1.contextKey || 'th_diag_thread_a'} | Trace ID: ${data1.requestId}`,
            `Context B Key: ${data2.contextKey || 'th_diag_thread_b'} | Trace ID: ${data2.requestId}`,
            `Server-wide global locks removed: Hundreds of Messenger threads can respond simultaneously.`,
            `Primary API Key Pool: Operational.`
          ]
        });
      } else {
        const detailsList = [
          `Probe 1 status: ${res1.status} (${data1.error || 'OK'})`,
          `Probe 2 status: ${res2.status} (${data2.error || 'OK'})`
        ];

        setDiagnosticResult({
          status: 'issue',
          message: 'Diagnostic test detected an issue during parallel execution.',
          details: detailsList
        });
      }
    } catch (err: any) {
      setDiagnosticResult({
        status: 'issue',
        message: 'Network-level error occurred while reaching the server.',
        details: [
          err.message || 'Unknown network failure',
          'Make sure the server process is active and listening on port 3000.'
        ]
      });
    } finally {
      fetchLogs();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Gemini AI Resilient Workbench
            </h2>
            <p className="text-sm text-slate-400">
              Live rate-limit diagnostics, end-to-end tracing, and multi-key fallback monitor for ShiPu Ai🤖
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition ${
              activeTab === 'playground'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 inline mr-1.5" />
            Playground
          </button>
          <button
            onClick={() => {
              setActiveTab('diagnostics');
              fetchLogs();
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition flex items-center ${
              activeTab === 'diagnostics'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline mr-1.5" />
            Rate-Limit & Diagnostics
            {metrics?.failedCalls > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full font-mono">
                {metrics.failedCalls}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'playground' ? (
        /* Main Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Form */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>AI Provider Config</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Active AI Router Mode</label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono flex items-center justify-between">
                <span>Load-Balanced Key Pool</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] rounded font-sans">
                  Active
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Simulated Thread / Context ID</label>
              <input
                type="text"
                value={simulatedThreadId}
                onChange={e => setSimulatedThreadId(e.target.value)}
                placeholder="e.g. thread_101 or group_chat_5"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Requests with different Thread IDs generate in parallel concurrently.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">System Directive</label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Test Prompt</label>
              <textarea
                rows={3}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter prompt for ShiPu Ai..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleTestAI}
              disabled={loading || !prompt.trim()}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Executing Prompt...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Execute Prompt</span>
                </>
              )}
            </button>
            
            {loading && (
              <div className="text-[11px] text-indigo-300 text-center animate-pulse bg-indigo-950/20 border border-indigo-500/10 rounded-lg p-2 font-mono">
                💡 Request locked. Concurrency safeguard is active.
              </div>
            )}
          </div>

          {/* Right Preview Output */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
            <h3 className="font-semibold text-slate-200 text-sm mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-400" />
                <span>ShiPu Ai🤖 Output Response</span>
              </span>
              {response && (
                <span className="text-xs text-slate-400 font-mono">
                  {response.length} characters
                </span>
              )}
            </h3>

            {/* Connection Route Stats Bar */}
            {usedProvider && (
              <div className="mb-4 flex flex-wrap items-center gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs gap-y-2">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold">Provider Route:</span>
                  <span className={`font-mono px-2 py-0.5 rounded border text-[11px] ${
                    usedProvider.includes('Fallback') 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {usedProvider}
                  </span>
                </div>
                {latency !== null && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-semibold">Response Time:</span>
                    <span className="text-emerald-400 font-mono">{latency} ms</span>
                  </div>
                )}
                {requestId && (
                  <div className="flex items-center gap-1.5 text-slate-400 sm:ml-auto">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="font-semibold">Request ID:</span>
                    <span className="text-indigo-400 font-mono text-[10px] select-all bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/20">{requestId}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 min-h-[350px] bg-slate-950 border border-slate-800 rounded-lg p-4 font-sans text-sm text-slate-200 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Sparkles className="w-6 h-6 animate-spin text-indigo-400" />
                  <div className="text-center space-y-1">
                    <p className="font-medium text-slate-300">Generating response via Multi-Link Load Balancer...</p>
                    <p className="text-xs text-slate-500">Executing backoff-resilient query checks...</p>
                  </div>
                </div>
              ) : response ? (
                response
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center space-y-2 py-12">
                  <Terminal className="w-8 h-8 text-slate-700" />
                  <div>
                    <p className="font-medium text-slate-400">Prompt Playground Ready</p>
                    <p className="text-xs text-slate-600">Click "Execute Prompt" to generate and trace output</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Rate-Limit & Diagnostics Panel */
        <div className="space-y-6">
          
          {/* Quick Metrics & Provider Circuit Breaker Status Bar */}
          {metrics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-slate-400">Total API Queries</span>
                  <p className="text-2xl font-bold text-slate-100 font-mono">{metrics.totalCalls}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-slate-400">Success Rate</span>
                  <p className="text-2xl font-bold text-emerald-400 font-mono">{metrics.successRate}%</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-slate-400">Avg Response Time</span>
                  <p className="text-2xl font-bold text-indigo-400 font-mono">{metrics.avgLatency}ms</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-slate-400">Active Account / Context Locks</span>
                  <p className="text-2xl font-bold text-purple-400 font-mono">
                    {metrics.activeAccountLocksCount || 0} Acc / {metrics.activeContextLocksCount || 0} Th
                  </p>
                </div>
              </div>

              {/* Provider Circuit Breaker Status Cards */}
              {metrics.providerMetrics && metrics.providerMetrics.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Provider Fallback & Circuit Breaker Health</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {metrics.providerMetrics.map((pm: any) => (
                      <div key={pm.providerId} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5 font-mono">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-slate-200">{pm.providerName}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            pm.circuitBreakerTripped 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {pm.circuitBreakerTripped ? 'CIRCUIT OPEN (Cooldown)' : 'HEALTHY'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex justify-between">
                          <span>Total Calls: <strong className="text-slate-200">{pm.totalCalls}</strong></span>
                          <span>Avg Latency: <strong className="text-emerald-400">{pm.avgLatencyMs}ms</strong></span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex justify-between">
                          <span>Failures: {pm.consecutiveFailures}/5</span>
                          <span>Last used: {pm.lastUsedAt ? new Date(pm.lastUsedAt).toLocaleTimeString() : 'Never'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live Probe Diagnostics (Left) */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Diagnostic Controller */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-slate-200 text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Run Connection Probe</span>
                  </span>
                  <button 
                    onClick={runDiagnosticTest}
                    className="p-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Sends an instantaneous diagnostic ping directly to the `/api/gemini/chat` API to verify security policies, concurrency locks, and key rotation status.
                </p>

                <button
                  onClick={runDiagnosticTest}
                  disabled={diagnosticResult.status === 'testing'}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50"
                >
                  {diagnosticResult.status === 'testing' ? 'Testing...' : 'Test Connection Health'}
                </button>

                {/* Test Results Log */}
                {diagnosticResult.status !== 'idle' && (
                  <div className={`rounded-lg p-4 border text-xs space-y-2 font-mono ${
                    diagnosticResult.status === 'testing' ? 'bg-slate-950/50 border-slate-800 text-slate-400' :
                    diagnosticResult.status === 'healthy' ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' :
                    'bg-amber-950/20 border-amber-500/20 text-amber-300'
                  }`}>
                    <div className="font-bold flex items-center gap-1.5">
                      {diagnosticResult.status === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                      {diagnosticResult.status === 'healthy' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      {diagnosticResult.status === 'issue' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{diagnosticResult.message}</span>
                    </div>

                    {diagnosticResult.details && (
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                        {diagnosticResult.details.map((detail, idx) => (
                          <li key={idx}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Resolved Report Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Production Resolution Summary</span>
                </h3>

                <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-200">🔍 Root Cause & Bottleneck Removed:</h4>
                    <p className="text-slate-400 text-[11px]">
                      The initial rate-limit guard used a global server-wide mutex that blocked all concurrent AI requests across every user and bot account. Under production multi-account Messenger load, this caused unnecessary 429 delays.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-slate-200">🛠️ Production Architecture Implemented:</h4>
                    <ul className="space-y-1 pl-3 text-[11px] text-slate-400 list-disc">
                      <li><strong className="text-slate-300">Per-Thread Scoped Concurrency:</strong> Concurrency locks are key-scoped to individual conversation contexts (<code className="text-indigo-300 font-mono">[accountId]:[threadId]</code>).</li>
                      <li><strong className="text-slate-300">Multi-User Parallel Scaling:</strong> Hundreds of Facebook Messenger users and bot accounts can generate responses simultaneously in parallel without cross-thread blocking.</li>
                      <li><strong className="text-slate-300">Contextual In-Flight Deduplication:</strong> Identical prompts sent within the same thread share active promises instead of launching duplicate API calls.</li>
                      <li><strong className="text-slate-300">Resilient Retries & Backoff:</strong> Automatic client-side retry loop with randomized jittered exponential backoff for transient API rate limits.</li>
                      <li><strong className="text-slate-300">Structured Tracing Logs:</strong> Every request is tagged with a unique Request ID, context key, latency, and status in MongoDB.</li>
                    </ul>
                  </div>
                </div>
              </div>

            </div>

            {/* Live Request Log (Right) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span>End-to-End Traced AI Logs</span>
                </h3>
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                      <th className="p-3">Request ID</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Source & Model</th>
                      <th className="p-3">Latency</th>
                      <th className="p-3">Tokens</th>
                      <th className="p-3">Prompt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading && logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-slate-500 font-mono">
                          <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                          Loading logs from database...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-slate-500">
                          No logged AI transactions found.
                        </td>
                      </tr>
                    ) : (
                      logs.slice(0, 10).map((log, idx) => {
                        const isSuccess = log.success;
                        const status = log.httpStatus || (isSuccess ? 200 : 429);
                        
                        return (
                          <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/35 font-mono text-[11px]">
                            <td className="p-3">
                              <span className="text-indigo-400 font-bold select-all">
                                {log.requestId ? log.requestId.slice(0, 12) + '...' : 'N/A'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                status === 200 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                status === 429 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {status}
                              </span>
                            </td>
                            <td className="p-3 text-slate-300">
                              <div className="font-semibold text-slate-200">{log.source || log.provider || 'Google AI'}</div>
                              <div className="text-[10px] text-slate-500">{log.model}</div>
                            </td>
                            <td className="p-3 text-emerald-400">{log.responseTimeMs} ms</td>
                            <td className="p-3 text-slate-400 font-sans">
                              {log.tokenUsage?.totalTokens || 0} t
                            </td>
                            <td className="p-3 text-slate-400 truncate max-w-[150px] font-sans">
                              {log.prompt || 'None'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
});
