import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Users, Link as LinkIcon, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Plus, Trash2, Save, Globe } from 'lucide-react';

interface OfficialGroup {
  threadID: string;
  threadName: string;
  inviteLink: string;
  order: number;
  active: boolean;
}

interface UserAccessUser {
  userID: string;
  userName: string;
  joinedGroupIDs: string[];
  missingGroupIDs: string[];
  totalJoinedCount: number;
  totalRequiredCount: number;
  hasAccess: boolean;
  authorizedThreadIDs: string[];
  lastVerifiedAt: number;
}

import { safeFetchJson } from '../lib/fetchUtils';

export const SharedAccessManager: React.FC = () => {
  const [officialGroups, setOfficialGroups] = useState<OfficialGroup[]>([
    { threadID: '', threadName: 'ShiPu Ai Official Community 1', inviteLink: '', order: 1, active: true }
  ]);
  const [users, setUsers] = useState<UserAccessUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resConfig, resUsers] = await Promise.all([
        safeFetchJson('/api/shared-access/config', { groups: [] }),
        safeFetchJson('/api/shared-access/users', { users: [] })
      ]);

      if (resConfig && Array.isArray(resConfig.groups) && resConfig.groups.length > 0) {
        setOfficialGroups(resConfig.groups);
      }
      if (resUsers && Array.isArray(resUsers.users)) {
        setUsers(resUsers.users);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to fetch shared access data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddGroup = () => {
    if (officialGroups.length >= 5) {
      setMessage({ type: 'error', text: 'Maximum limit of 5 Official Access Groups reached.' });
      return;
    }
    setOfficialGroups([
      ...officialGroups,
      { threadID: '', threadName: `Official Group ${officialGroups.length + 1}`, inviteLink: '', order: officialGroups.length + 1, active: true }
    ]);
  };

  const handleRemoveGroup = (index: number) => {
    const updated = officialGroups.filter((_, i) => i !== index).map((g, idx) => ({ ...g, order: idx + 1 }));
    setOfficialGroups(updated.length > 0 ? updated : [{ threadID: '', threadName: 'Official Group 1', inviteLink: '', order: 1, active: true }]);
  };

  const handleGroupChange = (index: number, field: keyof OfficialGroup, value: any) => {
    const updated = [...officialGroups];
    updated[index] = { ...updated[index], [field]: value };
    setOfficialGroups(updated);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/shared-access/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: officialGroups })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: data.message || 'Official Access Groups successfully saved!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Failed to save configuration.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Network error while saving configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRunVerification = async () => {
    setVerifying(true);
    setMessage(null);
    try {
      const res = await fetch('/api/shared-access/verify', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Verification pass completed successfully across all users.' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Verification failed.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Verification error.' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-white">Shared Bot Access Membership System</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Configure up to 5 Official Access Groups. Users must remain members of all configured groups simultaneously to keep Shared Bot Access active.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRunVerification}
              disabled={verifying}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center space-x-2 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying...' : 'Verify All Users'}</span>
            </button>
          </div>
        </div>

        {message && (
          <div className={`mt-4 p-4 rounded-xl border text-sm flex items-center space-x-3 ${message.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Official Groups Configuration Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Official Access Groups Configuration (1 to 5)</h2>
            <p className="text-slate-400 text-xs mt-0.5">Users are verified against all configured active groups simultaneously.</p>
          </div>
          <button
            type="button"
            onClick={handleAddGroup}
            disabled={officialGroups.length >= 5}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 border border-slate-700"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add Group ({officialGroups.length}/5)</span>
          </button>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {officialGroups.map((g, idx) => (
              <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-indigo-400 font-semibold uppercase tracking-wider">Official Group #{idx + 1}</span>
                  {officialGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGroup(idx)}
                      className="p-1.5 text-rose-400 hover:bg-rose-950/50 rounded-lg transition"
                      title="Remove Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Group Thread ID</label>
                    <input
                      type="text"
                      value={g.threadID}
                      onChange={(e) => handleGroupChange(idx, 'threadID', e.target.value)}
                      placeholder="e.g. 100000000000001"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Group Name</label>
                    <input
                      type="text"
                      value={g.threadName}
                      onChange={(e) => handleGroupChange(idx, 'threadName', e.target.value)}
                      placeholder="e.g. ShiPu Ai Official Community"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Invite / Join Link</label>
                    <input
                      type="url"
                      value={g.inviteLink}
                      onChange={(e) => handleGroupChange(idx, 'inviteLink', e.target.value)}
                      placeholder="https://m.me/join/..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center space-x-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Users Verification & Checklist Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Tracked Shared Access Users ({users.length})</h2>
            <p className="text-slate-400 text-xs mt-0.5">Visual checklist of official group membership status for each user.</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium text-sm">No users have requested shared access yet.</p>
            <p className="text-slate-500 text-xs mt-1">Users will appear here after running the <code className="text-indigo-400">#request</code> command in Messenger.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Membership Checklist</th>
                  <th className="px-4 py-3">Access Status</th>
                  <th className="px-4 py-3">Authorized Groups</th>
                  <th className="px-4 py-3">Last Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {users.map((u) => {
                  const checklistRatio = `${u.totalJoinedCount}/${u.totalRequiredCount}`;
                  const isFull = u.hasAccess;

                  return (
                    <tr key={u.userID} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white font-sans">{u.userName}</div>
                        <div className="text-slate-500 text-[11px]">UID: {u.userID}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isFull ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'}`}>
                            {checklistRatio} Joined
                          </span>
                          {u.missingGroupIDs.length > 0 && (
                            <span className="text-rose-400 text-[10px]">
                              (Missing {u.missingGroupIDs.length})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {isFull ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active Access</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Revoked / Missing</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 font-bold">{u.authorizedThreadIDs?.length || 0} Groups</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(u.lastVerifiedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
