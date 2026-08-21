import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Ban,
  PlusCircle,
  RotateCcw,
  UserCheck,
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { safeFetchResponse } from '../lib/fetchUtils';

interface SubscriptionAnalytics {
  summary: {
    totalSubscribers: number;
    activeUsers: number;
    trialUsers: number;
    graceUsers: number;
    limitedUsers: number;
    suspendedUsers: number;
    autoRenewEnabledCount: number;
    totalRevenue: number;
    expectedUpcomingRevenue: number;
  };
  recentPayments: Array<{
    txID: string;
    userID: string;
    name: string;
    amount: number;
    weeks: number;
    paymentSource: string;
    previousExpiry: string;
    newExpiry: string;
    timestamp: string;
    adminAction: boolean;
    isRefunded: boolean;
    note: string;
  }>;
  upcomingExpirations: any[];
  topSubscribers: any[];
}

interface SubscriberUser {
  userID: string;
  name: string;
  status: 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD' | 'LIMITED' | 'SUSPENDED';
  registrationDate: string;
  expiryDate: string;
  autoRenew: boolean;
  weeklyRentAmount: number;
  totalWeeksPurchased: number;
  totalCoinsPaid: number;
  lastPaymentDate: string | null;
  daysLeft: number;
  hoursLeft: number;
  wallet: number;
  bank: number;
  canExecuteCommands: boolean;
}

export const SubscriptionManager: React.FC = () => {
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionModalUser, setActionModalUser] = useState<SubscriberUser | null>(null);
  const [customWeeks, setCustomWeeks] = useState<number>(1);
  const [processing, setProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAnalyticsAndUsers = useCallback(async () => {
    try {
      setLoading(true);
      const [analyticsRes, usersRes] = await Promise.all([
        safeFetchResponse('/api/subscription/analytics'),
        safeFetchResponse(`/api/subscription/users?status=${activeTab}&search=${encodeURIComponent(searchQuery)}`)
      ]);

      if (analyticsRes.ok) {
        setAnalytics(analyticsRes.data);
      }

      if (usersRes.ok) {
        setSubscribers(usersRes.data);
      }
    } catch (err) {
      console.error('[SubscriptionManager] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchAnalyticsAndUsers();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAnalyticsAndUsers();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalyticsAndUsers]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAdminAction = async (action: string, payload: any) => {
    try {
      setProcessing(true);
      const res = await safeFetchResponse('/api/subscription/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });

      if (res.ok) {
        showToast('Subscription action completed successfully!', 'success');
        setActionModalUser(null);
        fetchAnalyticsAndUsers();
      } else {
        showToast(res.data?.error || 'Action failed', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Error communicating with server', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = () => {
    window.open('/api/subscription/export', '_blank');
  };

  const summary = analytics?.summary || {
    totalSubscribers: 0,
    activeUsers: 0,
    trialUsers: 0,
    graceUsers: 0,
    limitedUsers: 0,
    suspendedUsers: 0,
    autoRenewEnabledCount: 0,
    totalRevenue: 0,
    expectedUpcomingRevenue: 0
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE
          </span>
        );
      case 'TRIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" /> FREE TRIAL
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> GRACE PERIOD
          </span>
        );
      case 'LIMITED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Lock className="w-3.5 h-3.5" /> LIMITED MODE
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Ban className="w-3.5 h-3.5" /> SUSPENDED
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/50'
              : 'bg-rose-950/90 text-rose-200 border-rose-800/50'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & Overview Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-5 rounded-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Bot Subscription Economy Manager
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  LIVE
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated weekly rent engine, 7-day trials, auto-renewal, and Messenger UID subscription tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalyticsAndUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Status
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-100 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </button>
        </div>
      </div>

      {/* Analytics Summary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Registered Users</span>
            <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-md">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2">{summary.totalSubscribers.toLocaleString()}</div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
            <span className="text-emerald-400 font-semibold">{summary.activeUsers} Active</span> •{' '}
            <span className="text-indigo-400 font-semibold">{summary.trialUsers} Free Trial</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Coins Collected</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{summary.totalRevenue.toLocaleString()} Coins</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Expected Weekly Revenue: <span className="text-slate-200 font-medium">+{summary.expectedUpcomingRevenue.toLocaleString()} Coins</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Auto-Renew Enabled</span>
            <span className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-md">
              <RotateCcw className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-cyan-400 mt-2">{summary.autoRenewEnabledCount.toLocaleString()} Users</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary.totalSubscribers > 0
              ? `${Math.round((summary.autoRenewEnabledCount / summary.totalSubscribers) * 100)}% Auto-Renewal Rate`
              : '0% Auto-Renewal Rate'}
          </div>
        </div>

        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Attention Needed</span>
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-md">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {(summary.graceUsers + summary.limitedUsers + summary.suspendedUsers).toLocaleString()} Users
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
            <span className="text-amber-400">{summary.graceUsers} Grace</span> •{' '}
            <span className="text-orange-400">{summary.limitedUsers} Limited</span> •{' '}
            <span className="text-rose-400">{summary.suspendedUsers} Suspended</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Subscribers' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'TRIAL', label: 'Free Trial' },
            { id: 'GRACE_PERIOD', label: 'Grace Period' },
            { id: 'LIMITED', label: 'Limited' },
            { id: 'SUSPENDED', label: 'Suspended' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search UID or Name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-md">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            Subscriber Directory
            <span className="px-2 py-0.5 text-xs font-normal text-slate-400 bg-slate-800 rounded-full">
              {subscribers.length} profiles
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-medium uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Time Remaining</th>
                <th className="py-3 px-4">Wallet / Bank</th>
                <th className="py-3 px-4">Auto-Renew</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {subscribers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No subscriber profiles match the current filter.
                  </td>
                </tr>
              ) : (
                subscribers.map(sub => (
                  <tr key={sub.userID} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100">{sub.name || 'Messenger User'}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">UID: {sub.userID}</div>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(sub.status)}</td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-200 font-medium">
                        {new Date(sub.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(sub.expiryDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {sub.status === 'LIMITED' || sub.status === 'SUSPENDED' ? (
                        <span className="text-slate-500 italic">Expired</span>
                      ) : (
                        <div className="font-medium text-slate-200">
                          {sub.daysLeft}d {sub.hoursLeft}h left
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-emerald-400 font-semibold">{sub.wallet.toLocaleString()} Coins</div>
                      <div className="text-[10px] text-slate-400">Bank: {sub.bank.toLocaleString()}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleAdminAction('toggle_autorenew', { userID: sub.userID, enabled: !sub.autoRenew })}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                          sub.autoRenew
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {sub.autoRenew ? '✅ ON' : '❌ OFF'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setActionModalUser(sub)}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 rounded-lg transition-all"
                      >
                        Manage Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Payment Logs Stream */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Recent Subscription Payments & Transactions
        </h3>

        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
          {analytics?.recentPayments?.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">No recent subscription payments recorded yet.</div>
          ) : (
            analytics?.recentPayments?.map(p => (
              <div
                key={p.txID}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg border ${
                      p.isRefunded
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : p.adminAction
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      {p.name || 'User'} ({p.userID})
                      {p.isRefunded && (
                        <span className="px-1.5 py-0.2 text-[10px] bg-rose-500/20 text-rose-300 rounded">REFUNDED</span>
                      )}
                      {p.adminAction && (
                        <span className="px-1.5 py-0.2 text-[10px] bg-purple-500/20 text-purple-300 rounded">ADMIN GRANT</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Paid <span className="text-emerald-400 font-medium">{p.amount.toLocaleString()} Coins</span> for{' '}
                      <span className="text-slate-200 font-medium">{p.weeks} week(s)</span> • Source: {p.paymentSource}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <div className="font-mono text-[10px] text-slate-400">{p.txID}</div>
                    <div className="text-[10px] text-slate-500">{new Date(p.timestamp).toLocaleString()}</div>
                  </div>

                  {!p.isRefunded && p.amount > 0 && (
                    <button
                      onClick={() => handleAdminAction('refund', { userID: p.userID, txID: p.txID })}
                      disabled={processing}
                      className="px-2.5 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded transition-all"
                    >
                      Refund Tx
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Admin Action Modal */}
      {actionModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Manage Subscription
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  User: <span className="font-semibold text-slate-200">{actionModalUser.name}</span> ({actionModalUser.userID})
                </p>
              </div>
              <button
                onClick={() => setActionModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Current Status:</span>
                  <span>{getStatusBadge(actionModalUser.status)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Expiry Date:</span>
                  <span className="font-mono text-slate-100">
                    {new Date(actionModalUser.expiryDate).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action 1: Extend / Grant Free Weeks */}
              <div className="space-y-2 p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl">
                <label className="font-semibold text-slate-200 block">➕ Extend / Grant Free Weeks</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={customWeeks}
                    onChange={e => setCustomWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-slate-400">Week(s)</span>
                  <button
                    onClick={() => handleAdminAction('extend', { userID: actionModalUser.userID, weeks: customWeeks })}
                    disabled={processing}
                    className="ml-auto px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all"
                  >
                    Grant Free Duration
                  </button>
                </div>
              </div>

              {/* Action 2: Change Status */}
              <div className="space-y-2 p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl">
                <label className="font-semibold text-slate-200 block">⚙️ Override Account Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAdminAction('set_status', { userID: actionModalUser.userID, status: 'ACTIVE' })}
                    disabled={processing}
                    className="px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all"
                  >
                    ✅ Set Active
                  </button>
                  <button
                    onClick={() => handleAdminAction('set_status', { userID: actionModalUser.userID, status: 'SUSPENDED' })}
                    disabled={processing}
                    className="px-3 py-2 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-all"
                  >
                    ⛔ Suspend Account
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActionModalUser(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
