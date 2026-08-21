import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Landmark,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Download,
  DollarSign,
  Coins,
  History,
  CheckCircle2,
  Sliders,
  Users,
  Edit,
  Activity,
  Flame,
  PlusCircle,
  MinusCircle,
  UserCheck
} from 'lucide-react';
import { safeFetchJson } from '../lib/fetchUtils';

interface CryptoDashboardProps {
  adminToken?: string;
}

export const CryptoDashboard: React.FC<CryptoDashboardProps> = ({ adminToken }) => {
  const [overview, setOverview] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTxUser, setSearchTxUser] = useState<string>('');
  const [isUpdatingConfig, setIsUpdatingConfig] = useState<boolean>(false);
  const [configNotice, setConfigNotice] = useState<string>('');

  // Users List & Search State
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);

  // Edit User Balances Modal State
  const [editUserModalOpen, setEditUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editWallet, setEditWallet] = useState<number>(0);
  const [editBank, setEditBank] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editMessage, setEditMessage] = useState<string>('');

  // Config Form State
  const [configForm, setConfigForm] = useState<any>({
    dailyRewardBase: 200,
    dailyRewardBonusMax: 500,
    workMinReward: 50,
    workMaxReward: 150,
    interestRatePercent: 1.5,
    dailyCooldownMs: 86400000,
    workCooldownMs: 3600000
  });

  // Delta Adjustment State
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [adjustTargetUserID, setAdjustTargetUserID] = useState<string>('');
  const [adjustWalletDelta, setAdjustWalletDelta] = useState<number>(0);
  const [adjustBankDelta, setAdjustBankDelta] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState<boolean>(false);
  const [adjustMessage, setAdjustMessage] = useState<string>('');
  const [resetLoadingState, setResetLoadingState] = useState<boolean>(false);

  const handleResetAllBalances = async () => {
    if (!window.confirm("⚠️ Are you sure you want to reset ALL users' balances to 0? This will start a fresh economy reconfiguration from today.")) return;
    setResetLoadingState(true);
    try {
      const res: any = await safeFetchJson('/api/economy/reset-all', { success: false }, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken || 'default_admin_session'}`
        }
      });
      if (res && res.success) {
        alert('✅ All user balances have been successfully reset to 0!');
        fetchEconomyData();
        fetchEconomyUsers(userSearchQuery);
      } else {
        alert(`❌ Failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setResetLoadingState(false);
    }
  };

  const fetchEconomyData = async () => {
    setLoading(true);
    try {
      const stats: any = await safeFetchJson('/api/economy/overview', null);
      if (stats) {
        setOverview(stats);
        if (stats.config) {
          setConfigForm({
            dailyRewardBase: stats.config.dailyRewardBase ?? 500,
            dailyRewardBonusMax: stats.config.dailyRewardBonusMax ?? 500,
            workMinReward: stats.config.workMinReward ?? 150,
            workMaxReward: stats.config.workMaxReward ?? 350,
            interestRatePercent: stats.config.interestRatePercent ?? 1.5,
            dailyCooldownMs: stats.config.dailyCooldownMs ?? 86400000,
            workCooldownMs: stats.config.workCooldownMs ?? 600000
          });
        }
      }

      const txRes: any = await safeFetchJson('/api/economy/transactions?limit=100', []);
      if (Array.isArray(txRes)) {
        setTransactions(txRes);
      }
    } catch (err) {
      console.error('Failed to load economy overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEconomyUsers = async (query: string = '') => {
    setUsersLoading(true);
    try {
      const res: any = await safeFetchJson(`/api/economy/users?search=${encodeURIComponent(query)}&limit=100`, []);
      if (Array.isArray(res)) {
        setUsersList(res);
      }
    } catch (err) {
      console.error('Failed to search economy users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchEconomyData();
    fetchEconomyUsers();
  }, []);

  const handleSearchUsersSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEconomyUsers(userSearchQuery);
  };

  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setEditWallet(user.money ?? 0);
    setEditBank(user.bankMoney ?? 0);
    setEditNote('');
    setEditMessage('');
    setEditUserModalOpen(true);
  };

  const handleSaveSetBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    setEditMessage('');
    try {
      const res: any = await safeFetchJson('/api/economy/set-balance', { success: false }, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken || 'default_admin_session'}`
        },
        body: JSON.stringify({
          userID: editingUser.userID,
          wallet: Number(editWallet),
          bankMoney: Number(editBank),
          note: editNote || `Admin updated balance for ${editingUser.userID}`
        })
      });

      if (res && res.success) {
        setEditMessage('✅ Balances updated successfully!');
        setTimeout(() => {
          setEditUserModalOpen(false);
          setEditingUser(null);
          setEditMessage('');
          fetchEconomyData();
          fetchEconomyUsers(userSearchQuery);
        }, 1200);
      } else {
        setEditMessage(`❌ Failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setEditMessage(`❌ Error: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingConfig(true);
    setConfigNotice('');
    try {
      const res: any = await safeFetchJson('/api/economy/config', { success: false }, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken || 'default_admin_session'}`
        },
        body: JSON.stringify(configForm)
      });
      if (res && res.success) {
        setConfigNotice('✅ Economy configuration saved successfully!');
        fetchEconomyData();
      } else {
        setConfigNotice(`❌ Save failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setConfigNotice(`❌ Error: ${err.message}`);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUserID) return;
    setAdjustLoading(true);
    setAdjustMessage('');
    try {
      const res: any = await safeFetchJson('/api/economy/adjust', { success: false }, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken || 'default_admin_session'}`
        },
        body: JSON.stringify({
          userID: adjustTargetUserID,
          walletDelta: Number(adjustWalletDelta),
          bankDelta: Number(adjustBankDelta),
          note: adjustNote
        })
      });
      if (res && res.success) {
        setAdjustMessage('✅ Balance delta applied and recorded in ledger!');
        setTimeout(() => {
          setAdjustModalOpen(false);
          setAdjustMessage('');
          setAdjustWalletDelta(0);
          setAdjustBankDelta(0);
          setAdjustNote('');
          fetchEconomyData();
          fetchEconomyUsers(userSearchQuery);
        }, 1200);
      } else {
        setAdjustMessage(`❌ Failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setAdjustMessage(`❌ Error: ${err.message}`);
    } finally {
      setAdjustLoading(false);
    }
  };

  const exportTransactionsToCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['TransactionID', 'Timestamp', 'SenderID', 'ReceiverID', 'Type', 'Amount', 'Status', 'Note'];
    const rows = filteredTransactions.map(t => [
      t.transactionID,
      new Date(t.timestamp).toISOString(),
      t.senderID,
      t.receiverID || '',
      t.type,
      t.amount,
      t.status,
      `"${(t.note || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shipu_economy_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesType = filterType === 'ALL' || t.type === filterType;
    const matchesSearch = !searchTxUser || 
      t.senderID?.includes(searchTxUser) || 
      t.receiverID?.includes(searchTxUser) || 
      t.transactionID?.includes(searchTxUser) ||
      (t.note && t.note.toLowerCase().includes(searchTxUser.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const totalRegisteredUsers = overview?.totalUsers ?? overview?.totalAccounts ?? 0;
  const walletCirculation = overview?.walletCirculation ?? overview?.totalWalletBalance ?? 0;
  const bankCirculation = overview?.bankCirculation ?? overview?.totalBankBalance ?? 0;
  const totalInCirculation = overview?.totalEcosystemCoins ?? (walletCirculation + bankCirculation);
  const coinsCreatedToday = overview?.coinsCreatedToday ?? 0;
  const coinsDestroyedToday = overview?.coinsDestroyedToday ?? 0;
  const healthStatus = overview?.serverEconomyHealth ?? 'Healthy & Stable';
  const inflationRate = overview?.inflationRate ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Landmark className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
                Server Economy & Banking Dashboard
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  SINGLE SOURCE OF TRUTH
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time financial analytics, user wallet search, and administrative balance controls.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAllBalances}
            disabled={resetLoadingState}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${resetLoadingState ? 'animate-spin' : ''}`} /> Reset All Balances (0)
          </button>
          <button
            onClick={() => setAdjustModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" /> Balance Delta Override
          </button>
          <button
            onClick={() => {
              fetchEconomyData();
              fetchEconomyUsers(userSearchQuery);
            }}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Economy Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* OVERVIEW ANALYTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Registered Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-bl-full pointer-events-none transition group-hover:bg-sky-500/10" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-black text-sky-300 font-mono">
            {totalRegisteredUsers.toLocaleString()} <span className="text-xs text-slate-400 font-normal">Accounts</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-sky-400" /> Active today: {overview?.activeUsersToday ?? 0}
          </p>
        </div>

        {/* Total Coins in Circulation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none transition group-hover:bg-emerald-500/10" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Coins in Circulation</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400 font-mono">
            ${totalInCirculation.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Wallet: <span className="text-slate-200 font-semibold">${walletCirculation.toLocaleString()}</span> | Bank: <span className="text-indigo-300 font-semibold">${bankCirculation.toLocaleString()}</span>
          </p>
        </div>

        {/* Coins Created / Destroyed Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none transition group-hover:bg-amber-500/10" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">24h Minted / Burned</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1">
              <PlusCircle className="w-3.5 h-3.5" /> +${coinsCreatedToday.toLocaleString()}
            </div>
            <div className="text-lg font-bold text-rose-400 font-mono flex items-center gap-1">
              <MinusCircle className="w-3.5 h-3.5" /> -${coinsDestroyedToday.toLocaleString()}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Net flow today: <span className={coinsCreatedToday - coinsDestroyedToday >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {coinsCreatedToday - coinsDestroyedToday >= 0 ? '+' : ''}${(coinsCreatedToday - coinsDestroyedToday).toLocaleString()}
            </span>
          </p>
        </div>

        {/* Economy Health Monitor */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none transition group-hover:bg-indigo-500/10" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Economy Health</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${
              healthStatus.includes('Healthy') 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {healthStatus}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Inflation index: <span className="text-slate-200 font-bold font-mono">{inflationRate}%</span>
          </p>
        </div>

      </div>

      {/* USER WALLET & BANK BALANCE SEARCH & MANAGEMENT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> User Balances & Financial Profiles
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Search any Messenger UID or display name to inspect and edit wallet balance & bank savings directly.
            </p>
          </div>

          <form onSubmit={handleSearchUsersSubmit} className="flex items-center gap-2 w-full sm:w-80">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Search UID or user name..."
                className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={usersLoading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition font-sans"
            >
              Search
            </button>
          </form>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="p-3">User Profile</th>
                <th className="p-3">Messenger UID</th>
                <th className="p-3 text-right">Wallet Balance</th>
                <th className="p-3 text-right">Bank Savings</th>
                <th className="p-3 text-right">Total Net Worth</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300 font-mono">
              {usersLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Searching financial profiles...
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 italic font-sans">
                    No matching user profiles found.
                  </td>
                </tr>
              ) : (
                usersList.map((u, idx) => (
                  <tr key={u.userID || `user-${idx}`} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-sans">
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        {u.name || `User_${u.userID.slice(-4)}`}
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-amber-300 border border-slate-700 font-mono">
                          {u.levelName || 'Starter 🔰'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Last Active: {new Date(u.lastActive || Date.now()).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="p-3 text-slate-300 text-xs font-mono select-all">
                      {u.userID}
                    </td>

                    <td className="p-3 text-right font-bold text-emerald-400">
                      ${(u.money ?? 0).toLocaleString()}
                    </td>

                    <td className="p-3 text-right font-bold text-indigo-300">
                      ${(u.bankMoney ?? 0).toLocaleString()}
                    </td>

                    <td className="p-3 text-right font-bold text-amber-300">
                      ${((u.money ?? 0) + (u.bankMoney ?? 0)).toLocaleString()}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleOpenEditUser(u)}
                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 mx-auto font-sans"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit Balances
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRANSACTION LEDGER & CONFIG GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Transaction Ledger Explorer (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" /> Central Transaction Ledger Explorer
              </h3>
              <p className="text-xs text-slate-400">
                Immutable record of all transfers, deposits, rewards, and admin adjustments.
              </p>
            </div>

            <button
              onClick={exportTransactionsToCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 font-sans"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTxUser}
                onChange={e => setSearchTxUser(e.target.value)}
                placeholder="Search UID, TX ID, or notes..."
                className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full sm:w-44 bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            >
              <option value="ALL">All Event Types</option>
              <option value="DAILY_CLAIM">DAILY_CLAIM</option>
              <option value="WORK_REWARD">WORK_REWARD</option>
              <option value="BANK_DEPOSIT">BANK_DEPOSIT</option>
              <option value="BANK_WITHDRAW">BANK_WITHDRAW</option>
              <option value="PEER_TRANSFER">PEER_TRANSFER</option>
              <option value="ADMIN_ADJUST">ADMIN_ADJUST</option>
              <option value="INITIAL_GRANT">INITIAL_GRANT</option>
            </select>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <th className="p-3">Type</th>
                  <th className="p-3">Sender / Recipient</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Timestamp & Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300 font-mono">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic font-sans">
                      No matching transaction records found in ledger.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.slice(0, 50).map((tx, idx) => (
                    <tr key={tx.transactionID || tx._id || `tx-${idx}`} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'INITIAL_GRANT' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                          tx.type === 'DAILY_CLAIM' || tx.type === 'WORK_REWARD' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          tx.type === 'BANK_DEPOSIT' || tx.type === 'BANK_WITHDRAW' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                          tx.type === 'ADMIN_ADJUST' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}>
                          {tx.type}
                        </span>
                      </td>

                      <td className="p-3 text-[11px]">
                        <div>From: <span className="text-slate-200">{tx.senderID}</span></div>
                        {tx.receiverID && <div className="text-slate-400">To: <span className="text-slate-300">{tx.receiverID}</span></div>}
                      </td>

                      <td className="p-3 text-right font-bold text-emerald-400">
                        ${(tx.amount || 0).toLocaleString()}
                      </td>

                      <td className="p-3">
                        <span className="text-[10px] text-emerald-400 font-bold">
                          {tx.status || 'SUCCESS'}
                        </span>
                      </td>

                      <td className="p-3 text-[11px] font-sans">
                        <div className="text-slate-400 text-[10px]">
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>
                        <div className="text-slate-300 truncate max-w-xs" title={tx.note}>
                          {tx.note || '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Economy Configuration Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-sans">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" /> Economy Parameters
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live adjustments for daily rewards, work bonuses & banking interest.
            </p>
          </div>

          {configNotice && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              configNotice.includes('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
            }`}>
              {configNotice}
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Daily Base Reward (Coins)
              </label>
              <input
                type="number"
                value={configForm.dailyRewardBase}
                onChange={e => setConfigForm({ ...configForm, dailyRewardBase: Number(e.target.value) })}
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Daily Bonus Range (Coins)
              </label>
              <input
                type="number"
                value={configForm.dailyRewardBonusMax}
                onChange={e => setConfigForm({ ...configForm, dailyRewardBonusMax: Number(e.target.value) })}
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Work Min ($)
                </label>
                <input
                  type="number"
                  value={configForm.workMinReward}
                  onChange={e => setConfigForm({ ...configForm, workMinReward: Number(e.target.value) })}
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Work Max ($)
                </label>
                <input
                  type="number"
                  value={configForm.workMaxReward}
                  onChange={e => setConfigForm({ ...configForm, workMaxReward: Number(e.target.value) })}
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bank Interest Rate (% APY/Daily)
              </label>
              <input
                type="number"
                step="0.1"
                value={configForm.interestRatePercent}
                onChange={e => setConfigForm({ ...configForm, interestRatePercent: Number(e.target.value) })}
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingConfig}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg font-sans"
            >
              {isUpdatingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              Save Economy Parameters
            </button>
          </form>
        </div>

      </div>

      {/* MODAL: DIRECT USER BALANCE EDIT (WALLET & BANK) */}
      {editUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-emerald-400" /> Edit Financial Balances
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Target UID: {editingUser.userID}
                </p>
              </div>
              <button
                onClick={() => setEditUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {editMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                editMessage.includes('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}>
                {editMessage}
              </div>
            )}

            <form onSubmit={handleSaveSetBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  User Display Name
                </label>
                <input
                  type="text"
                  disabled
                  value={editingUser.name || editingUser.userID}
                  className="w-full bg-slate-950/50 text-slate-400 text-xs px-3 py-2 rounded-xl border border-slate-800 cursor-not-allowed font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Wallet Balance ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editWallet}
                    onChange={e => setEditWallet(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bank Savings ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editBank}
                    onChange={e => setEditBank(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Audit Reason / Note
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  placeholder="e.g. Admin balance adjustment"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5"
                >
                  {editLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />} Save Balances
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELTA ADJUSTMENT */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" /> Delta Balance Adjustment
              </h3>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {adjustMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                adjustMessage.includes('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}>
                {adjustMessage}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Messenger User ID (UID)
                </label>
                <input
                  type="text"
                  required
                  value={adjustTargetUserID}
                  onChange={e => setAdjustTargetUserID(e.target.value)}
                  placeholder="e.g. 1000889201982"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Wallet Delta (+/- Coins)
                  </label>
                  <input
                    type="number"
                    value={adjustWalletDelta}
                    onChange={e => setAdjustWalletDelta(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bank Savings Delta (+/- Coins)
                  </label>
                  <input
                    type="number"
                    value={adjustBankDelta}
                    onChange={e => setAdjustBankDelta(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Audit Note / Reason
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder="e.g. Admin compensation grant"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5"
                >
                  {adjustLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />} Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
