import React, { useState } from 'react';
import {
  Users2,
  Hash,
  Shield,
  MessageSquare,
  Settings,
  Plus,
  CheckCircle2,
  Ban,
  Radio,
  Clock
} from 'lucide-react';
import { ShiPuThread } from '../types/shipu';

interface ThreadManagerProps {
  threads: ShiPuThread[];
  onUpdateThread: (threadID: string, data: Partial<ShiPuThread>) => void;
  onCreateThread: (name: string, prefix: string) => void;
}

export const ThreadManager: React.FC<ThreadManagerProps> = React.memo(({
  threads,
  onUpdateThread,
  onCreateThread
}) => {
  const [selectedThreadID, setSelectedThreadID] = useState<string>(threads[0]?.threadID || '');
  const [editPrefix, setEditPrefix] = useState<string>('');
  const [editWelcome, setEditWelcome] = useState<string>('');

  const activeThread = threads.find(t => t.threadID === selectedThreadID) || threads[0];

  const handleSaveSettings = () => {
    if (!activeThread) return;
    onUpdateThread(activeThread.threadID, {
      prefix: editPrefix || activeThread.prefix,
      welcomeMessage: editWelcome || activeThread.welcomeMessage
    });
    alert(`✅ Settings updated for group "${activeThread.name}"!`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users2 className="w-6 h-6 text-indigo-400" /> Facebook Messenger Group Threads
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage thread prefixes, welcome greeting automation, member roles, and group ban states.
          </p>
        </div>
      </div>

      {/* Main Grid: Thread List + Thread Details Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Thread List Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 mb-2">
            Connected Groups ({threads.length})
          </h3>

          {threads.length === 0 ? (
            <div className="p-6 bg-slate-950/60 border border-slate-800 rounded-2xl text-center space-y-2">
              <Users2 className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">No Messenger groups yet</p>
              <p className="text-[11px] text-slate-400">Waiting for live Messenger connection or simulator group activity.</p>
            </div>
          ) : (
            threads.map(t => {
              const isSelected = activeThread?.threadID === t.threadID;

              return (
                <div
                  key={t.threadID}
                  onClick={() => {
                    setSelectedThreadID(t.threadID);
                    setEditPrefix(t.prefix);
                    setEditWelcome(t.welcomeMessage);
                  }}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center shrink-0">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{t.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Prefix: <code className="text-indigo-300 font-mono font-bold">{t.prefix}</code> • {t.members.length} Members
                      </p>
                    </div>
                  </div>

                  {t.isBanned && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                      BANNED
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Selected Thread Manager */}
        {activeThread && (
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                  <Hash className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{activeThread.name}</h3>
                  <p className="text-xs text-slate-400">Thread ID: <code>{activeThread.threadID}</code></p>
                </div>
              </div>

              <button
                onClick={() => onUpdateThread(activeThread.threadID, { isBanned: !activeThread.isBanned })}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeThread.isBanned
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30'
                }`}
              >
                <Ban className="w-4 h-4" />
                <span>{activeThread.isBanned ? 'Unban Thread' : 'Ban Thread'}</span>
              </button>
            </div>

            {/* Group Auto-Setup & Initialization Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Bot Presence</span>
                <span className={`font-bold ${activeThread.botPresent !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeThread.botPresent !== false ? 'PRESENT ✅' : 'REMOVED ❌'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Bot Nickname</span>
                <span className="font-bold text-indigo-300">
                  {activeThread.botNickname || 'ShiPu Ai🤖'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Group Connected Msg</span>
                <span className={`font-bold ${activeThread.connectionMessageSent ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {activeThread.connectionMessageSent ? 'SENT ✅' : 'PENDING ⏳'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Initialized At</span>
                <span className="font-mono text-slate-300">
                  {activeThread.initializedAt ? new Date(activeThread.initializedAt).toLocaleDateString() : 'Active'}
                </span>
              </div>
            </div>

            {/* Prefix & Auto Welcome Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Group Command Prefix</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    defaultValue={activeThread.prefix}
                    onChange={e => setEditPrefix(e.target.value)}
                    placeholder="e.g. #"
                    maxLength={5}
                    className="flex-1 bg-slate-900 text-slate-100 px-3.5 py-2 rounded-xl border border-slate-700 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Update
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Auto Welcome New Members</label>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">Greeting on member join</span>
                  <button
                    onClick={() => onUpdateThread(activeThread.threadID, { autoWelcome: !activeThread.autoWelcome })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      activeThread.autoWelcome
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {activeThread.autoWelcome ? 'ENABLED ✅' : 'DISABLED 🛑'}
                  </button>
                </div>
              </div>

            </div>

            {/* Custom Welcome Message Editor */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Custom Welcome Message</label>
              <textarea
                defaultValue={activeThread.welcomeMessage}
                onChange={e => setEditWelcome(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              ></textarea>
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                <span>Variables available: <code>{'{name}'}</code>, <code>{'{group}'}</code>, <code>{'{prefix}'}</code></span>
                <button
                  onClick={handleSaveSettings}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  Save Message
                </button>
              </div>
            </div>

            {/* Group Members List */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Group Members ({activeThread.members.length})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeThread.members.map(m => (
                  <div key={m.userID} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 font-bold flex items-center justify-center text-xs">
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-200 text-xs">{m.name}</div>
                        <div className="text-[10px] text-slate-400">Cash: ${(m.money ?? 0).toLocaleString()} • Lvl {m.level ?? 1}</div>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      m.role === 3 ? 'bg-amber-500/20 text-amber-300' :
                      m.role === 2 ? 'bg-purple-500/20 text-purple-300' :
                      m.role === 1 ? 'bg-blue-500/20 text-blue-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {m.role === 3 ? 'Owner' : m.role === 2 ? 'Bot Admin' : m.role === 1 ? 'Group Admin' : 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
});

