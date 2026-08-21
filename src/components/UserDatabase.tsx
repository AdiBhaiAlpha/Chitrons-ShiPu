import React, { useState } from 'react';
import {
  Wallet,
  Search,
  Shield,
  Coins,
  Crown,
  User,
  Ban,
  Edit2,
  DollarSign
} from 'lucide-react';
import { ShiPuUser } from '../types/shipu';

interface UserDatabaseProps {
  users: ShiPuUser[];
  onUpdateUser: (userID: string, data: Partial<ShiPuUser>) => void;
}

export const UserDatabase: React.FC<UserDatabaseProps> = React.memo(({
  users,
  onUpdateUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<ShiPuUser | null>(null);

  const [editRole, setEditRole] = useState<number>(0);
  const [editMoney, setEditMoney] = useState<number>(0);

  const filteredUsers = users.filter(
    u =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.userID.includes(searchQuery)
  );

  const handleOpenEdit = (user: ShiPuUser) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditMoney(user.money);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    onUpdateUser(editingUser.userID, {
      role: editRole as any,
      money: Number(editMoney)
    });
    setEditingUser(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" /> User Economy & Role Database
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Total Registered Members: <strong className="text-emerald-300">{users.length}</strong> | Manage roles, cash balances, and ban list.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or User ID..."
            className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-4 pl-6">Member Name</th>
                <th className="p-4">User ID</th>
                <th className="p-4">Role</th>
                <th className="p-4">Cash Balance</th>
                <th className="p-4">Bank Balance</th>
                <th className="p-4">Level (EXP)</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs text-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No registered members found in database.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                <tr key={u.userID} className="hover:bg-slate-800/50 transition">
                  <td className="p-4 pl-6 font-bold flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-indigo-300 font-bold flex items-center justify-center text-xs">
                      {u.name.charAt(0)}
                    </div>
                    <span>{u.name}</span>
                  </td>

                  <td className="p-4 font-mono text-slate-400">{u.userID}</td>

                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      u.role === 3 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      u.role === 2 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                      u.role === 1 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {u.role === 3 ? '👑 Bot Owner' : u.role === 2 ? '🛡️ Bot Admin' : u.role === 1 ? '⭐ Group Admin' : '👤 User'}
                    </span>
                  </td>

                  <td className="p-4 font-semibold text-emerald-400">${(u.money ?? 0).toLocaleString()}</td>
                  <td className="p-4 font-semibold text-indigo-300">${(u.bankMoney ?? 0).toLocaleString()}</td>
                  
                  <td className="p-4">
                    <span className="font-semibold text-slate-200">Lvl {u.level}</span>
                    <span className="text-slate-500 text-[10px] block">({u.exp} XP)</span>
                  </td>

                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.isBanned ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {u.isBanned ? 'BANNED 🛑' : 'ACTIVE ✅'}
                    </span>
                  </td>

                  <td className="p-4 pr-6 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onUpdateUser(u.userID, { isBanned: !u.isBanned })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        u.isBanned ? 'bg-emerald-600/20 text-emerald-300' : 'bg-rose-600/20 text-rose-300'
                      }`}
                    >
                      {u.isBanned ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Edit Member: {editingUser.name}</h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">User Permission Role</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(Number(e.target.value))}
                  className="w-full bg-slate-800 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>Role 0 - General User</option>
                  <option value={1}>Role 1 - Group Thread Admin</option>
                  <option value={2}>Role 2 - Bot Admin</option>
                  <option value={3}>Role 3 - ShiPu Ai Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cash Balance ($)</label>
                <input
                  type="number"
                  value={editMoney}
                  onChange={e => setEditMoney(Number(e.target.value))}
                  className="w-full bg-slate-800 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
});

