import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Smartphone,
  Send,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Play,
  Zap,
  Search,
  Filter,
  Copy,
  Check,
  ExternalLink,
  Layers,
  BarChart3,
  Terminal,
  Shield,
  FileText,
  ChevronRight,
  Info
} from 'lucide-react';
import { smsValidator, smsSimulationService, SmsSimulationJob, SmsRoundLog } from '../services/smsSimulationService';

interface SmsDashboardProps {
  token?: string;
  onNavigateToSimulator?: (prefilledText?: string) => void;
}

export const SmsDashboard: React.FC<SmsDashboardProps> = ({ token, onNavigateToSimulator }) => {
  // State
  const [activeJobs, setActiveJobs] = useState<SmsSimulationJob[]>([]);
  const [jobHistory, setJobHistory] = useState<SmsSimulationJob[]>([]);
  const [stats, setStats] = useState({
    activeJobsCount: 0,
    totalHistoricalJobs: 0,
    completedJobsCount: 0,
    failedJobsCount: 0,
    totalDeliveredRounds: 0,
    totalFailedRounds: 0,
    avgLatencyMs: 45,
    globalConcurrencyLimit: 3
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Form input state
  const [phoneInput, setPhoneInput] = useState<string>('01316655254');
  const [roundsInput, setRoundsInput] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filtering & Modal state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'FAILED' | 'RUNNING'>('ALL');
  const [selectedJob, setSelectedJob] = useState<SmsSimulationJob | null>(null);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<boolean>(false);

  // Fetch status from API or local fallback
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sms/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveJobs(data.activeJobs || []);
          setJobHistory(data.history || []);
          if (data.stats) {
            setStats(data.stats);
          }
          return;
        }
      }
    } catch {
      // Fallback directly to client-side service instance
    }

    // Direct in-memory fallback
    const active = smsSimulationService.getActiveJobs();
    const history = smsSimulationService.getJobHistory();
    const metrics = smsSimulationService.getStats();
    setActiveJobs(active);
    setJobHistory(history);
    setStats(metrics);
  }, []);

  // Initial load and periodic polling
  useEffect(() => {
    fetchStatus();

    // Subscribe to direct client-side events for instant reaction
    const unsubscribe = smsSimulationService.subscribe(() => {
      fetchStatus();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchStatus]);

  // Auto-refresh interval (every 3 seconds when enabled or if active jobs exist)
  useEffect(() => {
    if (!autoRefresh && activeJobs.length === 0) return;
    const intervalTime = activeJobs.length > 0 ? 1000 : 3000;
    const timer = setInterval(() => {
      fetchStatus();
    }, intervalTime);
    return () => clearInterval(timer);
  }, [autoRefresh, activeJobs.length, fetchStatus]);

  // Phone operator detector & validation feedback
  const phoneValidation = useMemo(() => {
    const raw = phoneInput.trim();
    if (!raw) return { isValid: false, normalized: null, masked: null, operator: null, error: 'Phone number is required' };

    const normalized = smsValidator.normalizePhoneNumber(raw);
    if (!normalized) {
      return { isValid: false, normalized: null, masked: null, operator: null, error: 'Invalid Bangladesh phone format' };
    }

    const masked = smsValidator.maskPhoneNumber(normalized);
    let operator = 'Bangladesh Mobile';
    if (normalized.startsWith('+88013') || normalized.startsWith('+88017')) operator = 'Grameenphone (GP)';
    else if (normalized.startsWith('+88014') || normalized.startsWith('+88019')) operator = 'Banglalink (BL)';
    else if (normalized.startsWith('+88018')) operator = 'Robi Axiata';
    else if (normalized.startsWith('+88016')) operator = 'Airtel';
    else if (normalized.startsWith('+88015')) operator = 'Teletalk Bangladesh';

    return { isValid: true, normalized, masked, operator, error: null };
  }, [phoneInput]);

  // Trigger Simulation from Dashboard UI
  const handleLaunchSimulation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!phoneValidation.isValid || !phoneValidation.normalized) {
      setFormError('Please enter a valid 11-digit Bangladesh mobile number.');
      return;
    }

    if (roundsInput < 1 || roundsInput > 100) {
      setFormError('Rounds must be between 1 and 100.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Send simulation request to backend or execute via client-side service
      const res = await fetch('/api/sms/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneValidation.normalized,
          rounds: roundsInput,
          userId: 'dashboard_admin',
          threadID: 'dashboard_channel',
          async: false
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.job) {
          setFormSuccess(`Simulation Job ${data.job.jobId} completed (${data.job.completedRounds}/${data.job.requestedRounds} delivered).`);
          fetchStatus();
          setSelectedJob(data.job);
        } else {
          throw new Error(data.error || 'Simulation failed');
        }
      } else {
        const errData = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      // Try client-side fallback if server route is unavailable
      try {
        const job = await smsSimulationService.createAndRunSimulation(
          'dashboard_admin',
          'dashboard_channel',
          phoneValidation.normalized,
          roundsInput
        );
        setFormSuccess(`Simulation Job ${job.jobId} completed successfully!`);
        fetchStatus();
        setSelectedJob(job);
      } catch (clientErr: any) {
        setFormError(clientErr.message || err.message || 'Failed to execute SMS simulation');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered job history
  const filteredHistory = useMemo(() => {
    return jobHistory.filter((job) => {
      const matchesSearch =
        searchQuery === '' ||
        job.jobId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.maskedPhone.includes(searchQuery) ||
        job.userId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [jobHistory, searchQuery, statusFilter]);

  const handleCopyJobId = (jobId: string) => {
    navigator.clipboard.writeText(jobId);
    setCopiedJobId(jobId);
    setTimeout(() => setCopiedJobId(null), 2000);
  };

  const handleCopyCommand = () => {
    const cmd = `#sms ${phoneValidation.normalized || phoneInput} ${roundsInput}`;
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const overallSuccessRate = useMemo(() => {
    const total = stats.totalDeliveredRounds + stats.totalFailedRounds;
    if (total === 0) return 100;
    return Math.round((stats.totalDeliveredRounds / total) * 100);
  }, [stats.totalDeliveredRounds, stats.totalFailedRounds]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & METRICS BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100">SMS Gateway Simulator & Monitor</h1>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Safe Engine 2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live monitoring, route simulation, and round logs for Bangladesh carrier gateways (+8801)
            </p>
          </div>
        </div>

        {/* Action buttons & controls */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto">
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle real-time auto refresh"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            Auto-Sync {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => {
              setIsLoading(true);
              fetchStatus().finally(() => setIsLoading(false));
            }}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. LIVE METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active Jobs */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Active Jobs</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {stats.activeJobsCount}
            </span>
            <span className="text-xs text-slate-500">/ {stats.globalConcurrencyLimit} max</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Global worker slots</span>
        </div>

        {/* Total Runs */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Runs</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {stats.totalHistoricalJobs}
            </span>
            <span className="text-xs text-slate-500">sims</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Completed & logged</span>
        </div>

        {/* Delivered Rounds */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {stats.totalDeliveredRounds}
            </span>
            <span className="text-xs text-slate-500">rounds</span>
          </div>
          <span className="text-[10px] text-emerald-500/80 mt-1">Virtual delivered</span>
        </div>

        {/* Failed Rounds */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Failed</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {stats.totalFailedRounds}
            </span>
            <span className="text-xs text-slate-500">rounds</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Route packet drops</span>
        </div>

        {/* Avg Latency */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Avg Latency</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {stats.avgLatencyMs}
            </span>
            <span className="text-xs text-slate-500">ms</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Mock route latency</span>
        </div>

        {/* Success Rate */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Success Rate</span>
            <BarChart3 className="w-4 h-4 text-violet-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-violet-400 font-mono">
              {overallSuccessRate}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Simulated accuracy</span>
        </div>
      </div>

      {/* 3. SIMULATION LAUNCHER & ACTIVE RUNNING JOBS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LAUNCHER PANEL (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-200">Interactive Test Launcher</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                #sms
              </span>
            </div>

            <form onSubmit={handleLaunchSimulation} className="space-y-4">
              {/* Phone Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Mobile Number (Bangladesh)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 01316655254 or +8801316655254"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition font-mono"
                  />
                  {phoneValidation.isValid && (
                    <div className="absolute right-3 top-2.5 text-emerald-400 flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Live validation indicator */}
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {phoneValidation.isValid ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span>✓ {phoneValidation.operator}</span>
                      <span className="text-slate-500">({phoneValidation.masked})</span>
                    </span>
                  ) : (
                    <span className="text-amber-400/90 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {phoneValidation.error}
                    </span>
                  )}
                  <span className="text-slate-500">BD +8801 E.164</span>
                </div>
              </div>

              {/* Rounds Slider & Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Simulation Rounds
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {roundsInput} {roundsInput === 1 ? 'Round' : 'Rounds'}
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="100"
                  value={roundsInput}
                  onChange={(e) => setRoundsInput(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />

                {/* Quick preset buttons */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[1, 5, 10, 25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRoundsInput(preset)}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-lg border transition ${
                        roundsInput === preset
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alerts */}
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !phoneValidation.isValid}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Simulating ({roundsInput} rounds)...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Start Simulation Job</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
                  title="Copy #sms CLI Command"
                >
                  {copiedCommand ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick simulator shortcut */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Test directly in Live Messenger Simulator
            </span>
            {onNavigateToSimulator && (
              <button
                onClick={() => onNavigateToSimulator(`#sms ${phoneValidation.normalized || '01316655254'} ${roundsInput}`)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition"
              >
                <span>Launch in Simulator</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ACTIVE SIMULATION JOBS MONITOR (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-200">Active Simulation Workers</h2>
              <span className="text-xs font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                {activeJobs.length} Running
              </span>
            </div>
            <span className="text-xs text-slate-500">Live Concurrency Queue</span>
          </div>

          {activeJobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400/80" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">No Active Simulations</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                All worker queues are idle. Use the launcher or test <code className="text-indigo-300">#sms &lt;number&gt; &lt;rounds&gt;</code> in the chat simulator.
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1 custom-scrollbar">
              {activeJobs.map((job) => {
                const total = job.requestedRounds || 1;
                const processed = (job.completedRounds || 0) + (job.failedRounds || 0);
                const progressPct = Math.min(100, Math.round((processed / total) * 100));

                return (
                  <div
                    key={job.jobId}
                    className="p-4 bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-xl transition shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                        <span className="font-mono text-xs font-bold text-slate-200 truncate">
                          {job.jobId}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ({job.maskedPhone})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {progressPct}%
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          RUNNING
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 rounded-full"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    {/* Sub info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>
                        Round {processed} of {total} ({job.completedRounds} delivered, {job.failedRounds} failed)
                      </span>
                      <span>User: {job.userId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Safety note banner */}
          <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Hard-enforced mock simulation (zero carrier traffic &amp; automatic PII masking)</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">SuS***SMS</span>
          </div>
        </div>
      </div>

      {/* 4. SIMULATION HISTORY & AUDIT TRAIL */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-200">Simulation History &amp; Round Logs</h2>
              <p className="text-xs text-slate-500">Detailed records of executed virtual SMS gateway test jobs</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search Job ID or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 w-48 sm:w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="RUNNING">Running</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            No simulation history records found matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px] bg-slate-950/40">
                  <th className="py-3 px-3">Job ID</th>
                  <th className="py-3 px-3">Target (Masked)</th>
                  <th className="py-3 px-3">Rounds (Delivered/Total)</th>
                  <th className="py-3 px-3">Success Rate</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredHistory.map((job) => {
                  const durationSec = job.totalDurationMs
                    ? `${(job.totalDurationMs / 1000).toFixed(2)}s`
                    : '--';
                  const rate =
                    job.requestedRounds > 0
                      ? Math.round((job.completedRounds / job.requestedRounds) * 100)
                      : 0;

                  return (
                    <tr
                      key={job.jobId}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => setSelectedJob(job)}
                    >
                      {/* Job ID */}
                      <td className="py-3 px-3 font-bold text-slate-200 flex items-center gap-1.5">
                        <span className="text-indigo-400">#</span>
                        <span>{job.jobId}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyJobId(job.jobId);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded text-slate-400 transition"
                          title="Copy Job ID"
                        >
                          {copiedJobId === job.jobId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </td>

                      {/* Target */}
                      <td className="py-3 px-3 text-slate-300">
                        {job.maskedPhone}
                      </td>

                      {/* Rounds */}
                      <td className="py-3 px-3 text-slate-300">
                        <span className="text-emerald-400 font-semibold">{job.completedRounds}</span>
                        <span className="text-slate-500"> / {job.requestedRounds}</span>
                      </td>

                      {/* Success Rate */}
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            rate >= 90
                              ? 'text-emerald-400'
                              : rate >= 70
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 text-slate-400">
                        {durationSec}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : job.status === 'RUNNING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {new Date(job.startTime).toLocaleTimeString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(job);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-sans font-medium transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. JOB DETAILS INSPECTION MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">Job Inspection: {selectedJob.jobId}</h3>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                        selectedJob.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {selectedJob.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Target: {selectedJob.maskedPhone}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Rounds</span>
                  <p className="text-sm font-mono font-bold text-slate-200 mt-0.5">{selectedJob.requestedRounds}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Delivered</span>
                  <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{selectedJob.completedRounds}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Failed</span>
                  <p className="text-sm font-mono font-bold text-rose-400 mt-0.5">{selectedJob.failedRounds}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Duration</span>
                  <p className="text-sm font-mono font-bold text-cyan-400 mt-0.5">
                    {selectedJob.totalDurationMs ? `${(selectedJob.totalDurationMs / 1000).toFixed(2)}s` : '--'}
                  </p>
                </div>
              </div>

              {/* Endpoint & Redaction */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
                <span className="text-slate-500 text-[11px] block font-sans font-semibold">Simulated Gateway Route &amp; Endpoint</span>
                <div className="text-indigo-300 break-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  {selectedJob.simulatedEndpoint}
                </div>
              </div>

              {/* Round-by-Round Logs */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Round Execution Log ({selectedJob.roundLogs.length} entries)</span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {selectedJob.roundLogs[0]?.provider || 'RenderGateway-BD (84 APIs)'}
                  </span>
                </h4>

                <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-48 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
                  {selectedJob.roundLogs.map((log: SmsRoundLog) => (
                    <div key={log.round} className="p-2.5 flex items-center justify-between hover:bg-slate-900/60">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">#{log.round}</span>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                            log.status === 'DELIVERED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                        <span>{log.latencyMs}ms latency</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
              <span className="text-xs text-slate-500 font-mono">Job ID: {selectedJob.jobId}</span>
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
