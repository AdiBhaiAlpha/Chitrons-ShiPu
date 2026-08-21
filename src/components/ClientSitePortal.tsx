import React, { useState, useEffect } from 'react';
import { Globe, ExternalLink, Lock, UserPlus, LayoutDashboard, ShieldAlert, Server, Database, Sparkles, CheckCircle2, ArrowRight, Code, Download, RefreshCw, Activity, AlertCircle, CreditCard, Check, X, User, LogOut, ShieldCheck, DollarSign } from 'lucide-react';
import { safeFetchJson } from '../lib/fetchUtils';

interface ClientUser {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  status: string;
  subscription: {
    plan: string;
    status: string;
    expiresAt: string;
    slotsCount: number;
  };
  botSlots: Array<{
    slotId: string;
    botName: string;
    status: string;
    assignedUid?: string;
  }>;
  createdAt: string;
  lastLogin?: string;
}

interface PaymentRequest {
  paymentId: string;
  userId: string;
  username: string;
  amount: number;
  currency: string;
  plan: string;
  slots: number;
  paymentMethod: string;
  transactionReference: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string;
  adminNotes?: string;
}

export const ClientSitePortal: React.FC = () => {
  const [activePortalTab, setActivePortalTab] = useState<'overview' | 'client' | 'admin'>('client');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Client Auth & Dashboard state
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [clientAuthMode, setClientAuthMode] = useState<'login' | 'register'>('login');
  const [authInput, setAuthInput] = useState({ usernameOrEmail: '', password: '', email: '', fullName: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [clientPayments, setClientPayments] = useState<PaymentRequest[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState({ plan: 'Pro Subscription (30 Days)', amount: '29.00', slots: '1', paymentMethod: 'Bank Transfer / QR', transactionReference: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin Auth & Dashboard state
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('shipu_client_admin_token'));
  const [adminLoginInput, setAdminLoginInput] = useState({ username: 'chitron', password: '' });
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<ClientUser[]>([]);
  const [adminPayments, setAdminPayments] = useState<PaymentRequest[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);

  // Fetch client data if logged in
  useEffect(() => {
    const savedUser = localStorage.getItem('shipu_client_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setClientUser(parsed);
        fetchClientProfile(parsed.userId);
        fetchClientPayments(parsed.userId);
      } catch (e) {
        localStorage.removeItem('shipu_client_user');
      }
    }
  }, []);

  useEffect(() => {
    if (adminToken) {
      fetchAdminData();
    }
  }, [adminToken]);

  const fetchClientProfile = async (userId: string) => {
    try {
      const res = await safeFetchJson<any>(`/api/client/profile?userId=${userId}`, null);
      if (res && res.success && res.user) {
        setClientUser(res.user);
        localStorage.setItem('shipu_client_user', JSON.stringify(res.user));
      }
    } catch (e) {}
  };

  const fetchClientPayments = async (userId: string) => {
    try {
      const res = await safeFetchJson<any>(`/api/client/payments?userId=${userId}`, null);
      if (res && res.success && res.payments) {
        setClientPayments(res.payments);
      }
    } catch (e) {}
  };

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/client/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: authInput.usernameOrEmail,
          password: authInput.password
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClientUser(data.user);
        localStorage.setItem('shipu_client_user', JSON.stringify(data.user));
        localStorage.setItem('shipu_client_token', data.token);
        fetchClientPayments(data.user.userId);
        setMessage({ type: 'success', text: 'Welcome back, ' + data.user.fullName + '!' });
      } else {
        setAuthError(data.error || 'Login failed.');
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/client/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authInput.usernameOrEmail,
          email: authInput.email || authInput.usernameOrEmail + '@shipuai.com',
          password: authInput.password,
          fullName: authInput.fullName || authInput.usernameOrEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClientUser(data.user);
        localStorage.setItem('shipu_client_user', JSON.stringify(data.user));
        fetchClientPayments(data.user.userId);
        setMessage({ type: 'success', text: 'Account registered successfully!' });
      } else {
        setAuthError(data.error || 'Registration failed.');
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClientLogout = () => {
    setClientUser(null);
    localStorage.removeItem('shipu_client_user');
    localStorage.removeItem('shipu_client_token');
    setClientPayments([]);
    setMessage({ type: 'success', text: 'Logged out successfully.' });
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientUser) return;
    try {
      const res = await fetch('/api/client/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: clientUser.userId,
          username: clientUser.username,
          amount: parseFloat(paymentForm.amount),
          plan: paymentForm.plan,
          slots: parseInt(paymentForm.slots, 10) || 1,
          paymentMethod: paymentForm.paymentMethod,
          transactionReference: paymentForm.transactionReference || 'TXN-' + Math.floor(Math.random() * 900000 + 100000)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: data.message });
        setIsPaymentModalOpen(false);
        fetchClientPayments(clientUser.userId);
      } else {
        alert(data.error || 'Failed to submit payment.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Admin Actions
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminLoading(true);
    try {
      const res = await fetch('/api/client/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminLoginInput)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminToken(data.token);
        localStorage.setItem('shipu_client_admin_token', data.token);
      } else {
        setAdminError(data.error || 'Admin login failed.');
      }
    } catch (err: any) {
      setAdminError(err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('shipu_client_admin_token');
  };

  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      const [statsRes, usersRes, paymentsRes] = await Promise.all([
        safeFetchJson<any>('/api/client/admin/stats', null),
        safeFetchJson<any>('/api/client/admin/users', null),
        safeFetchJson<any>('/api/client/admin/payments', null)
      ]);
      if (statsRes && statsRes.success) setAdminStats(statsRes.stats);
      if (usersRes && usersRes.success) setAdminUsers(usersRes.users);
      if (paymentsRes && paymentsRes.success) setAdminPayments(paymentsRes.payments);
    } catch (e) {
    } finally {
      setAdminLoading(false);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    if (!confirm('Approve this payment? This will persistently activate the user subscription and add bot slots.')) return;
    try {
      const res = await fetch(`/api/client/admin/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Payment approved and subscription updated successfully!');
        fetchAdminData();
      } else {
        alert(data.error || 'Failed to approve payment.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    const notes = prompt('Enter rejection reason for customer:', 'Verification failed or incorrect reference number');
    if (notes === null) return;
    try {
      const res = await fetch(`/api/client/admin/payments/${paymentId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: notes })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Payment rejected.');
        fetchAdminData();
      } else {
        alert(data.error || 'Failed to reject payment.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/client-site/download-zip');
      if (!response.ok) throw new Error('Failed to download client site ZIP archive');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'client-site-bundle.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Error downloading client-site files: ' + (err as Error).message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-2xl border border-indigo-500/20 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Customer Portal & Admin Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Globe className="w-8 h-8 text-indigo-400" />
              ShiPu Client Site & Subscription Portal
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl leading-relaxed">
              Fully persistent JSON-backed customer management platform. Clients can register, login, view bot slots, and submit payment requests. Admins can securely review and approve orders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 text-sm"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span>{isDownloading ? 'Packing ZIP...' : 'Download Client Site Codebase'}</span>
            </button>
          </div>
        </div>

        {/* Portal Nav Tabs */}
        <div className="mt-6 pt-4 border-t border-indigo-500/20 flex flex-wrap gap-2">
          <button
            onClick={() => setActivePortalTab('client')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'client' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
          >
            <User className="w-4 h-4" /> Client Area Portal {clientUser ? `(${clientUser.username})` : ''}
          </button>
          <button
            onClick={() => setActivePortalTab('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
          >
            <ShieldCheck className="w-4 h-4" /> Client Admin Area {adminToken ? '(Authenticated)' : ''}
          </button>
          <button
            onClick={() => setActivePortalTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
          >
            <Database className="w-4 h-4" /> Architecture & Storage Spec
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center justify-between ${message.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* CLIENT AREA PORTAL */}
      {activePortalTab === 'client' && (
        <div className="space-y-6">
          {!clientUser ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md mx-auto shadow-xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">ShiPu Customer Portal</h2>
                <p className="text-xs text-slate-400">Sign in to manage your bot slots, subscriptions, and payment history.</p>
              </div>

              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setClientAuthMode('login')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${clientAuthMode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setClientAuthMode('register')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${clientAuthMode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Register Account
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={clientAuthMode === 'login' ? handleClientLogin : handleClientRegister} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Username or Email</label>
                  <input
                    type="text"
                    required
                    value={authInput.usernameOrEmail}
                    onChange={(e) => setAuthInput({ ...authInput, usernameOrEmail: e.target.value })}
                    placeholder="e.g. democustomer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {clientAuthMode === 'register' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">Email Address</label>
                      <input
                        type="email"
                        required
                        value={authInput.email}
                        onChange={(e) => setAuthInput({ ...authInput, email: e.target.value })}
                        placeholder="customer@domain.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">Full Name</label>
                      <input
                        type="text"
                        value={authInput.fullName}
                        onChange={(e) => setAuthInput({ ...authInput, fullName: e.target.value })}
                        placeholder="John Doe"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  <input
                    type="password"
                    required
                    value={authInput.password}
                    onChange={(e) => setAuthInput({ ...authInput, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                >
                  {authLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{clientAuthMode === 'login' ? 'Sign In to Portal' : 'Create Account & Register'}</span>
                </button>
              </form>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-center">
                Demo Account: Username <code className="text-indigo-300 font-mono">democustomer</code> | Password <code className="text-indigo-300 font-mono">password123</code>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Dashboard Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 font-bold text-xl">
                    {clientUser.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {clientUser.fullName}
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-full">{clientUser.status}</span>
                    </h2>
                    <div className="text-xs text-slate-400">Username: <span className="text-slate-200 font-mono">@{clientUser.username}</span> | Email: <span className="text-slate-200">{clientUser.email}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { fetchClientProfile(clientUser.userId); fetchClientPayments(clientUser.userId); }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                  <button
                    onClick={handleClientLogout}
                    className="px-3.5 py-2 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              </div>

              {/* Grid: Subscription & Bot Slots */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Subscription Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-400" /> Subscription Status
                    </h3>
                    <span className="text-[11px] px-2.5 py-1 bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 rounded-full font-bold">
                      {clientUser.subscription.status}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-slate-400">Active Plan:</span> <span className="font-bold text-white">{clientUser.subscription.plan}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">Assigned Slots:</span> <span className="font-bold text-emerald-400">{clientUser.subscription.slotsCount} Slots</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">Expires At:</span> <span className="text-slate-200 font-mono text-[11px]">{new Date(clientUser.subscription.expiresAt).toLocaleDateString()}</span></div>
                  </div>

                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" /> Renew / Extend Subscription ($29)
                  </button>
                </div>

                {/* Bot Slots List */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-indigo-400" /> Assigned Bot Slots ({clientUser.botSlots.length})
                    </h3>
                    <span className="text-xs text-slate-400">Server Synchronized</span>
                  </div>

                  <div className="space-y-3">
                    {clientUser.botSlots.map((slot, idx) => (
                      <div key={slot.slotId || idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{slot.botName}</div>
                            <div className="text-[11px] text-slate-400">Slot ID: <code className="text-indigo-300 font-mono">{slot.slotId}</code></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${slot.status === 'ONLINE' ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                            {slot.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment History Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-400" /> Payment & Order Requests History
                  </h3>
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    + Submit Payment Request
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Payment ID</th>
                        <th className="pb-3 font-semibold">Plan & Slots</th>
                        <th className="pb-3 font-semibold">Amount</th>
                        <th className="pb-3 font-semibold">Method / Ref</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {clientPayments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">No payment requests submitted yet.</td>
                        </tr>
                      ) : (
                        clientPayments.map((p) => (
                          <tr key={p.paymentId} className="hover:bg-slate-950/40">
                            <td className="py-3 font-mono text-indigo-300">{p.paymentId}</td>
                            <td className="py-3">
                              <div className="font-bold text-white">{p.plan}</div>
                              <div className="text-[11px] text-slate-400">{p.slots} Slot(s)</div>
                            </td>
                            <td className="py-3 font-bold text-emerald-400">${p.amount} {p.currency}</td>
                            <td className="py-3">
                              <div>{p.paymentMethod}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{p.transactionReference}</div>
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                p.status === 'APPROVED' ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300' :
                                p.status === 'REJECTED' ? 'bg-rose-950/60 border-rose-500/30 text-rose-300' :
                                'bg-amber-950/60 border-amber-500/30 text-amber-300'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400">{new Date(p.submittedAt).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Request Modal */}
              {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-scaleIn">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-indigo-400" /> Submit Payment Request
                      </h3>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                    </div>

                    <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-200">Select Subscription Plan</label>
                        <select
                          value={paymentForm.plan}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.includes('Enterprise')) setPaymentForm({ ...paymentForm, plan: val, amount: '99.00', slots: '5' });
                            else if (val.includes('Professional')) setPaymentForm({ ...paymentForm, plan: val, amount: '49.00', slots: '2' });
                            else setPaymentForm({ ...paymentForm, plan: val, amount: '29.00', slots: '1' });
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Standard Bot Tier">Standard Bot Tier (1 Slot) — $29 / 30 Days</option>
                          <option value="Professional Bot Tier">Professional Bot Tier (2 Slots) — $49 / 30 Days</option>
                          <option value="Enterprise Bot Tier">Enterprise Bot Tier (5 Slots) — $99 / 30 Days</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-200">Amount (USD)</label>
                          <input
                            type="text"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-200">Bot Slots Included</label>
                          <input
                            type="number"
                            value={paymentForm.slots}
                            onChange={(e) => setPaymentForm({ ...paymentForm, slots: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-200">Payment Method</label>
                        <select
                          value={paymentForm.paymentMethod}
                          onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Bank Transfer">Direct Bank Transfer</option>
                          <option value="USDT / Crypto">USDT / Crypto QR Transfer</option>
                          <option value="PayPal / Credit Card">PayPal / Credit Card</option>
                          <option value="Mobile Wallet">Mobile Wallet / GCash / Momo</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-200">Transaction Reference / Receipt ID</label>
                        <input
                          type="text"
                          required
                          value={paymentForm.transactionReference}
                          onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                          placeholder="e.g. TXN-99882211 or Transfer Slip No."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono"
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold">Cancel</button>
                        <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow">Submit Payment Request</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CLIENT ADMIN PORTAL */}
      {activePortalTab === 'admin' && (
        <div className="space-y-6">
          {!adminToken ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md mx-auto shadow-xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-rose-600/20 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">Client Admin Login</h2>
                <p className="text-xs text-slate-400">Secure administrator portal for managing customers, bot slots, and payment approvals.</p>
              </div>

              {adminError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{adminError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Admin Username</label>
                  <input
                    type="text"
                    required
                    value={adminLoginInput.username}
                    onChange={(e) => setAdminLoginInput({ ...adminLoginInput, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Admin Password</label>
                  <input
                    type="password"
                    required
                    value={adminLoginInput.password}
                    onChange={(e) => setAdminLoginInput({ ...adminLoginInput, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adminLoading}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2"
                >
                  {adminLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Secure Admin Login</span>
                </button>
              </form>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-center">
                Admin Username: <code className="text-rose-300 font-mono">chitron</code> | Password: <code className="text-rose-300 font-mono">2448766</code>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Admin Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Client Site Administrator Control Center</h3>
                    <p className="text-xs text-slate-400">Manage users, review payment verification queues, and approve subscriptions.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={fetchAdminData} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
                  </button>
                  <button onClick={handleAdminLogout} className="px-3.5 py-2 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl transition">
                    Admin Logout
                  </button>
                </div>
              </div>

              {/* Admin Stats Grid */}
              {adminStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Customers</div>
                    <div className="text-2xl font-bold text-white mt-1">{adminStats.totalUsers}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Subscribers</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">{adminStats.activeUsers}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Payments</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">{adminStats.pendingPayments}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Approved Revenue</div>
                    <div className="text-2xl font-bold text-indigo-400 mt-1">${adminStats.totalRevenue} USD</div>
                  </div>
                </div>
              )}

              {/* Payment Requests Approval Queue */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" /> Payment Verification & Approval Queue
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Payment ID</th>
                        <th className="pb-3 font-semibold">User</th>
                        <th className="pb-3 font-semibold">Plan & Slots</th>
                        <th className="pb-3 font-semibold">Amount</th>
                        <th className="pb-3 font-semibold">Method & Reference</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminPayments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">No payment requests found in storage.</td>
                        </tr>
                      ) : (
                        adminPayments.map((p) => (
                          <tr key={p.paymentId} className="hover:bg-slate-950/40">
                            <td className="py-3 font-mono text-indigo-300">{p.paymentId}</td>
                            <td className="py-3 font-bold text-white">@{p.username}</td>
                            <td className="py-3">
                              <div>{p.plan}</div>
                              <div className="text-[10px] text-slate-400">+{p.slots} Slot(s)</div>
                            </td>
                            <td className="py-3 font-bold text-emerald-400">${p.amount} {p.currency}</td>
                            <td className="py-3">
                              <div>{p.paymentMethod}</div>
                              <div className="text-[11px] font-mono text-slate-300">{p.transactionReference}</div>
                            </td>
                            <td className="py-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                p.status === 'APPROVED' ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300' :
                                p.status === 'REJECTED' ? 'bg-rose-950/60 border-rose-500/30 text-rose-300' :
                                'bg-amber-950/60 border-amber-500/30 text-amber-300'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {p.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleApprovePayment(p.paymentId)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectPayment(p.paymentId)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shadow flex items-center gap-1"
                                  >
                                    <X className="w-3.5 h-3.5" /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">Reviewed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registered Users Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Registered Client Users ({adminUsers.length})
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">User ID / Username</th>
                        <th className="pb-3 font-semibold">Full Name</th>
                        <th className="pb-3 font-semibold">Email</th>
                        <th className="pb-3 font-semibold">Subscription Plan</th>
                        <th className="pb-3 font-semibold">Bot Slots</th>
                        <th className="pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminUsers.map((u) => (
                        <tr key={u.userId} className="hover:bg-slate-950/40">
                          <td className="py-3">
                            <div className="font-bold text-white">@{u.username}</div>
                            <div className="text-[10px] text-indigo-300 font-mono">{u.userId}</div>
                          </td>
                          <td className="py-3 text-slate-200">{u.fullName}</td>
                          <td className="py-3 text-slate-400">{u.email}</td>
                          <td className="py-3 font-semibold text-emerald-400">{u.subscription.plan}</td>
                          <td className="py-3 font-bold text-white">{u.botSlots.length} Slots</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                              {u.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ARCHITECTURE SPEC */}
      {activePortalTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" /> Filesystem JSON Storage Architecture
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Client user records and payment verification requests are securely stored in isolated JSON files on the server filesystem under <code className="text-indigo-300 font-mono">/data/users/</code> and <code className="text-indigo-300 font-mono">/data/payments/</code>. This ensures data survives application restarts without requiring SQLite or MongoDB dependency.
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
              <div>data/</div>
              <div className="pl-4">├── users/</div>
              <div className="pl-8">├── usr_3a9f2.json (Isolated Client JSON)</div>
              <div className="pl-8">└── usr_7b1e4.json</div>
              <div className="pl-4">├── payments/</div>
              <div className="pl-8">└── pay_9c2d1.json (Persistent Payment Request)</div>
              <div className="pl-4">└── settings/</div>
              <div className="pl-8">└── settings.json (Admin Auth Hash)</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Architectural Isolation Guarantee
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              The Client Site Portal is strictly separated from the internal Bot Admin Dashboard and Messenger Session Manager:
            </p>
            <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
              <li><strong className="text-white">Zero Cookie Exposure:</strong> Messenger cookies and Facebook Appstate JSON are strictly restricted to the internal Bot Admin infrastructure and never exposed to clients.</li>
              <li><strong className="text-white">Independent Admin Authentication:</strong> Admin credentials are securely verified server-side.</li>
              <li><strong className="text-white">Automated Provisioning:</strong> When payment requests are approved by admins, bot slots and subscription expirations update instantly across persistent storage.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
