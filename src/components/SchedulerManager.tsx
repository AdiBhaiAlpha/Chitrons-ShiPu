import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Play, Power, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ScheduledTask } from '../types/shipu';

export const SchedulerManager: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/scheduler');
      const data = await res.json();
      setTasks(data || []);
    } catch (err) {
      console.error('Failed to fetch scheduler tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (taskId: string) => {
    await fetch('/api/bot/scheduler/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    fetchTasks();
  };

  const handleRunNow = async (taskId: string) => {
    await fetch('/api/bot/scheduler/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    fetchTasks();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Cron Task Scheduler Service
            </h2>
            <p className="text-sm text-slate-400">
              Manage automated background loops, daily resets, and system maintenance jobs
            </p>
          </div>
        </div>
        <button
          onClick={fetchTasks}
          className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          <span>Refresh Tasks</span>
        </button>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map(t => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">{t.name}</h3>
                <span className="font-mono text-xs text-indigo-400 mt-0.5 block">{t.cronExpression}</span>
              </div>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                t.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {t.status.toUpperCase()}
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span>Last Executed:</span>
                <span className="text-slate-300">{t.lastRun}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Next Scheduled:</span>
                <span className="text-slate-300">{t.nextRun}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggle(t.id)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition flex items-center justify-center gap-1.5 ${
                  t.status === 'active'
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{t.status === 'active' ? 'Pause' : 'Activate'}</span>
              </button>

              <button
                onClick={() => handleRunNow(t.id)}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                <span>Run Now</span>
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
