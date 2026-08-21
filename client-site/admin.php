<?php
$page_title = 'Admin Control Center - ShiPu AI';
include __DIR__ . '/includes/header.php';

if (!$is_logged_in) {
    header("Location: login.php");
    exit();
}

if (!$is_admin) {
    header("Location: dashboard.php");
    exit();
}

try {
    // Fetch all users from Supabase client_site_users
    $users = DB::select('client_site_users', [], 'created_at.desc');
} catch (Exception $e) {
    $users = [];
}

// Map user records for fast in-memory joins
$userMap = [];
foreach ($users as $u) {
    $userMap[$u['id']] = $u;
}

try {
    // Fetch all slots from Supabase client_site_slots
    $raw_slots = DB::select('client_site_slots', [], 'created_at.asc');
    $slots = [];
    foreach ($raw_slots as $s) {
        $s['username'] = $userMap[$s['user_id']]['username'] ?? 'Unknown';
        $slots[] = $s;
    }
} catch (Exception $e) {
    $slots = [];
}

try {
    // Fetch all payment requests from Supabase client_site_payments
    $raw_payments = DB::select('client_site_payments', [], 'created_at.desc');
    $payments = [];
    foreach ($raw_payments as $p) {
        $p['username'] = $userMap[$p['user_id']]['username'] ?? 'Unknown';
        $payments[] = $p;
    }
} catch (Exception $e) {
    $payments = [];
}

// --- Supabase Config & Live Fetching ---
$supabase_url = DB::getSetting('SUPABASE_URL', '');
$supabase_key = DB::getSetting('SUPABASE_KEY', '');
$supabase_service_role = DB::getSetting('SUPABASE_SERVICE_ROLE', '');
$supabase_configured = !empty($supabase_url) && !empty($supabase_key);

$supabase_sessions = [];
$supabase_error = '';

if ($supabase_configured) {
    try {
        $supabase_sessions = Supabase::getSessions();
    } catch (Exception $e) {
        $supabase_error = $e->getMessage();
    }
}

// Compute counts for dashboard
$total_users = count($users);
$total_slots = count($slots);
$pending_payments = 0;
foreach ($payments as $p) {
    if ($p['status'] === 'pending') {
        $pending_payments++;
    }
}
$supabase_bots_count = count($supabase_sessions);
?>

<div class="flex flex-col md:flex-row gap-8">
    <!-- Left Navigation Sidebar -->
    <aside class="w-full md:w-64 flex-shrink-0">
        <nav class="space-y-1 bg-white border border-[#e2e8f0] p-4 rounded-xl shadow-sm" aria-label="Sidebar">
            <div class="px-3 py-2 border-b border-[#f1f5f9] mb-3">
                <p class="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Management Console</p>
            </div>
            
            <button onclick="switchTab('tab-overview', this)" class="tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-semibold rounded-lg transition-colors text-emerald-700 bg-emerald-50">
                <i data-lucide="layout-dashboard" class="w-4 h-4 mr-2.5"></i>
                Dashboard
            </button>
            
            <button onclick="switchTab('tab-users', this)" class="tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors">
                <i data-lucide="users" class="w-4 h-4 mr-2.5 text-[#64748b]"></i>
                Users <span class="ml-auto bg-[#f1f5f9] text-[#475569] text-[10px] px-2 py-0.5 rounded-full font-bold"><?php echo $total_users; ?></span>
            </button>
            
            <button onclick="switchTab('tab-slots', this)" class="tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors">
                <i data-lucide="layers" class="w-4 h-4 mr-2.5 text-[#64748b]"></i>
                Bot Slots <span class="ml-auto bg-[#f1f5f9] text-[#475569] text-[10px] px-2 py-0.5 rounded-full font-bold"><?php echo $total_slots; ?></span>
            </button>
            
            <button onclick="switchTab('tab-requests', this)" class="tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors">
                <i data-lucide="banknote" class="w-4 h-4 mr-2.5 text-[#64748b]"></i>
                Purchase Requests 
                <?php if ($pending_payments > 0): ?>
                    <span class="ml-auto bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse"><?php echo $pending_payments; ?></span>
                <?php endif; ?>
            </button>
            
            <button onclick="switchTab('tab-bots', this)" class="tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors">
                <i data-lucide="cpu" class="w-4 h-4 mr-2.5 text-[#64748b]"></i>
                Client Bots (Supabase) <span class="ml-auto bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold"><?php echo $supabase_bots_count; ?></span>
            </button>
            
            <button onclick="switchTab('tab-settings', this)" class="tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors">
                <i data-lucide="settings" class="w-4 h-4 mr-2.5 text-[#64748b]"></i>
                Supabase Settings
            </button>
        </nav>
    </aside>

    <!-- Main Content Panels -->
    <div class="flex-grow space-y-6">
        
        <!-- Alerts -->
        <?php if (!$supabase_configured): ?>
            <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <i data-lucide="alert-triangle" class="h-5 w-5 text-amber-500"></i>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-semibold text-amber-800">Supabase Integration Inactive</h3>
                        <p class="mt-1 text-sm text-amber-700">
                            The Supabase database has not been connected. Please proceed to the <strong>Supabase Settings</strong> tab on the sidebar to input your credentials.
                        </p>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <?php if (!empty($supabase_error)): ?>
            <div class="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <i data-lucide="alert-circle" class="h-5 w-5 text-rose-500"></i>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-semibold text-rose-800">Supabase Sync Failure</h3>
                        <p class="mt-1 text-sm text-rose-700"><?php echo htmlspecialchars($supabase_error); ?></p>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <!-- TAB: OVERVIEW -->
        <div id="tab-overview" class="tab-panel space-y-6">
            <!-- Summary stats -->
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-4">
                <div class="bg-white border border-[#e2e8f0] shadow-sm rounded-xl px-5 py-6 flex items-center">
                    <div class="p-3 bg-slate-50 rounded-lg text-slate-700 mr-4">
                        <i data-lucide="users" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Total Clients</p>
                        <p class="text-2xl font-bold text-[#0f172a]"><?php echo $total_users; ?></p>
                    </div>
                </div>

                <div class="bg-white border border-[#e2e8f0] shadow-sm rounded-xl px-5 py-6 flex items-center">
                    <div class="p-3 bg-emerald-50 rounded-lg text-emerald-600 mr-4">
                        <i data-lucide="layers" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Allocated Slots</p>
                        <p class="text-2xl font-bold text-[#0f172a]"><?php echo $total_slots; ?></p>
                    </div>
                </div>

                <div class="bg-white border border-[#e2e8f0] shadow-sm rounded-xl px-5 py-6 flex items-center">
                    <div class="p-3 bg-amber-50 rounded-lg text-amber-600 mr-4">
                        <i data-lucide="clock" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Pending Orders</p>
                        <p class="text-2xl font-bold text-[#0f172a]"><?php echo $pending_payments; ?></p>
                    </div>
                </div>

                <div class="bg-white border border-[#e2e8f0] shadow-sm rounded-xl px-5 py-6 flex items-center">
                    <div class="p-3 bg-indigo-50 rounded-lg text-indigo-600 mr-4">
                        <i data-lucide="cpu" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Live Cloud Bots</p>
                        <p class="text-2xl font-bold text-[#0f172a]"><?php echo $supabase_bots_count; ?></p>
                    </div>
                </div>
            </div>

            <!-- Welcome corporate splash -->
            <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl p-6">
                <h3 class="text-lg font-bold text-[#0f172a]">ShiPu AI Central Control Panel</h3>
                <p class="text-sm text-[#475569] mt-2 leading-relaxed">
                    Welcome to the Administrator portal. Here you can oversee local user registrations, verify payments, grant new bot execution slots, and monitor the live status/runtimes of active client sessions running on the remote ShiPu AI Node.js server through real-time Supabase integrations.
                </p>
            </div>
        </div>

        <!-- TAB: USERS -->
        <div id="tab-users" class="tab-panel hidden space-y-6">
            <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl">
                <div class="px-6 py-5 border-b border-[#f1f5f9]">
                    <h3 class="text-lg font-bold text-[#0f172a]">Registered Clients</h3>
                    <p class="text-sm text-[#64748b]">View all users in the system and manage their configurations.</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-[#f1f5f9] text-sm text-left">
                        <thead class="bg-slate-50 text-xs text-[#64748b] uppercase tracking-wider font-semibold">
                            <tr>
                                <th class="px-6 py-3">ID</th>
                                <th class="px-6 py-3">Username</th>
                                <th class="px-6 py-3">Account Type</th>
                                <th class="px-6 py-3">Registered On</th>
                                <th class="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#f1f5f9]">
                            <?php foreach ($users as $u): ?>
                                <tr class="hover:bg-slate-50/50">
                                    <td class="px-6 py-4 font-bold text-[#64748b]">#<?php echo $u['id']; ?></td>
                                    <td class="px-6 py-4 font-semibold text-[#0f172a]"><?php echo htmlspecialchars($u['username']); ?></td>
                                    <td class="px-6 py-4">
                                        <?php if ($u['role'] === 'admin'): ?>
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">System Admin</span>
                                        <?php else: ?>
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Standard User</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="px-6 py-4 text-[#64748b]"><?php echo $u['created_at']; ?></td>
                                    <td class="px-6 py-4 text-right">
                                        <?php if ($u['role'] !== 'admin'): ?>
                                            <button onclick="deleteUser(<?php echo $u['id']; ?>, '<?php echo htmlspecialchars($u['username']); ?>')" class="text-rose-600 hover:text-rose-900 font-semibold text-xs">Purge User</button>
                                        <?php else: ?>
                                            <span class="text-slate-400 text-xs">Default Owner</span>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- TAB: SLOTS -->
        <div id="tab-slots" class="tab-panel hidden space-y-6">
            <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl">
                <div class="px-6 py-5 border-b border-[#f1f5f9]">
                    <h3 class="text-lg font-bold text-[#0f172a]">Active Bot Slots Ledger</h3>
                    <p class="text-sm text-[#64748b]">Status mapping of all allocated slots and links to remote bot session IDs.</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-[#f1f5f9] text-sm text-left">
                        <thead class="bg-slate-50 text-xs text-[#64748b] uppercase tracking-wider font-semibold">
                            <tr>
                                <th class="px-6 py-3">Slot ID</th>
                                <th class="px-6 py-3">Owner</th>
                                <th class="px-6 py-3">Mapped Bot ID</th>
                                <th class="px-6 py-3">Status</th>
                                <th class="px-6 py-3">Created</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#f1f5f9]">
                            <?php if (empty($slots)): ?>
                                <tr>
                                    <td colspan="5" class="px-6 py-8 text-center text-[#64748b]">No active slots provisioned in the system yet.</td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($slots as $sl): ?>
                                    <tr class="hover:bg-slate-50/50">
                                        <td class="px-6 py-4 font-mono font-bold text-[#64748b]"><?php echo $sl['id']; ?></td>
                                        <td class="px-6 py-4 font-semibold text-[#0f172a]"><?php echo htmlspecialchars($sl['username']); ?></td>
                                        <td class="px-6 py-4">
                                            <?php if ($sl['bot_id']): ?>
                                                <span class="font-mono font-bold text-indigo-700"><?php echo htmlspecialchars($sl['bot_id']); ?></span>
                                            <?php else: ?>
                                                <span class="text-slate-450 italic">None</span>
                                            <?php endif; ?>
                                        </td>
                                        <td class="px-6 py-4">
                                            <?php if ($sl['status'] === 'active'): ?>
                                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Active / Filled</span>
                                            <?php else: ?>
                                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Available / Empty</span>
                                            <?php endif; ?>
                                        </td>
                                        <td class="px-6 py-4 text-xs text-[#64748b]"><?php echo $sl['created_at']; ?></td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- TAB: PURCHASE REQUESTS -->
        <div id="tab-requests" class="tab-panel hidden space-y-6">
            <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl">
                <div class="px-6 py-5 border-b border-[#f1f5f9]">
                    <h3 class="text-lg font-bold text-[#0f172a]">Payment Verification Desk</h3>
                    <p class="text-sm text-[#64748b]">Review pending slot order payments and approve allocations.</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-[#f1f5f9] text-sm text-left">
                        <thead class="bg-slate-50 text-xs text-[#64748b] uppercase tracking-wider font-semibold">
                            <tr>
                                <th class="px-6 py-3">Client</th>
                                <th class="px-6 py-3">Requested Slots</th>
                                <th class="px-6 py-3">Amount</th>
                                <th class="px-6 py-3">Method / TxID</th>
                                <th class="px-6 py-3">Status</th>
                                <th class="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#f1f5f9]">
                            <?php if (empty($payments)): ?>
                                <tr>
                                    <td colspan="6" class="px-6 py-8 text-center text-[#64748b]">No payment records submitted.</td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($payments as $pay): ?>
                                    <tr class="hover:bg-slate-50/50">
                                        <td class="px-6 py-4 font-semibold text-[#0f172a]"><?php echo htmlspecialchars($pay['username']); ?></td>
                                        <td class="px-6 py-4 font-bold text-[#0f172a]"><?php echo $pay['slots_requested']; ?> Slot(s)</td>
                                        <td class="px-6 py-4 font-bold text-emerald-800"><?php echo $pay['amount']; ?> BDT</td>
                                        <td class="px-6 py-4">
                                            <p class="font-semibold text-slate-700"><?php echo htmlspecialchars($pay['payment_method']); ?></p>
                                            <p class="text-xs font-mono text-[#64748b]"><?php echo htmlspecialchars($pay['transaction_id']); ?></p>
                                        </td>
                                        <td class="px-6 py-4">
                                            <?php if ($pay['status'] === 'approved'): ?>
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Approved</span>
                                            <?php elseif ($pay['status'] === 'declined'): ?>
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Declined</span>
                                            <?php else: ?>
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">Pending Review</span>
                                            <?php endif; ?>
                                        </td>
                                        <td class="px-6 py-4 text-right">
                                            <?php if ($pay['status'] === 'pending'): ?>
                                                <div class="flex items-center justify-end space-x-2">
                                                    <button onclick="processPayment(<?php echo $pay['id']; ?>, 'approved')" class="inline-flex items-center px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shadow-sm">
                                                        Approve
                                                    </button>
                                                    <button onclick="processPayment(<?php echo $pay['id']; ?>, 'declined')" class="inline-flex items-center px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors">
                                                        Decline
                                                    </button>
                                                </div>
                                            <?php else: ?>
                                                <span class="text-xs text-[#94a3b8]">Handled</span>
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- TAB: CLIENT BOTS (SUPABASE) -->
        <div id="tab-bots" class="tab-panel hidden space-y-6">
            <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl">
                <div class="px-6 py-5 border-b border-[#f1f5f9] flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-bold text-[#0f172a]">Live Supabase Sessions</h3>
                        <p class="text-sm text-[#64748b]">Active runner connections detected directly on the remote database.</p>
                    </div>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-[#f1f5f9] text-sm text-left">
                        <thead class="bg-slate-50 text-xs text-[#64748b] uppercase tracking-wider font-semibold">
                            <tr>
                                <th class="px-6 py-3">Bot ID</th>
                                <th class="px-6 py-3">Slot Map</th>
                                <th class="px-6 py-3">Server Status</th>
                                <th class="px-6 py-3">Last Active Heartbeat</th>
                                <th class="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#f1f5f9]">
                            <?php if (empty($supabase_sessions)): ?>
                                <tr>
                                    <td colspan="5" class="px-6 py-8 text-center text-[#64748b]">No active bot sessions running in remote Supabase.</td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($supabase_sessions as $ses): ?>
                                    <tr class="hover:bg-slate-50/50">
                                        <td class="px-6 py-4 font-bold font-mono text-[#0f172a]"><?php echo htmlspecialchars($ses['bot_id']); ?></td>
                                        <td class="px-6 py-4">
                                            <p class="text-xs">Slot ID: <span class="font-bold text-[#64748b]"><?php echo htmlspecialchars($ses['slot_id'] ?? 'Unassigned'); ?></span></p>
                                            <p class="text-xs">User Key: <span class="font-bold text-[#64748b]"><?php echo htmlspecialchars($ses['user_id'] ?? 'Unassigned'); ?></span></p>
                                        </td>
                                        <td class="px-6 py-4">
                                            <?php
                                            $st = $ses['status'] ?? 'unknown';
                                            $col = "bg-amber-100 text-amber-800";
                                            if ($st === 'running') $col = "bg-emerald-100 text-emerald-800";
                                            elseif ($st === 'failed') $col = "bg-rose-100 text-rose-800";
                                            ?>
                                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase <?php echo $col; ?>">
                                                <?php echo htmlspecialchars($st); ?>
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 text-xs text-[#64748b]">
                                            <?php echo $ses['last_heartbeat'] ?? 'No signals yet'; ?>
                                        </td>
                                        <td class="px-6 py-4 text-right">
                                            <button onclick="inspectBot('<?php echo htmlspecialchars($ses['bot_id']); ?>')" class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#cbd5e1] rounded-lg shadow-sm transition-all">
                                                <i data-lucide="activity" class="w-3.5 h-3.5 mr-1"></i> Inspect Runtimes
                                            </button>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- TAB: SUPABASE SETTINGS -->
        <div id="tab-settings" class="tab-panel hidden space-y-6">
            <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl p-6">
                <div class="border-b border-[#f1f5f9] pb-4 mb-6">
                    <h3 class="text-lg font-bold text-[#0f172a]">Supabase Gateway Integration</h3>
                    <p class="text-sm text-[#64748b]">Configure your remote database endpoints here. Credentials will be securely saved server-side.</p>
                </div>

                <form id="supabase-settings-form" class="space-y-6">
                    <div>
                        <label for="supabase_url" class="block text-sm font-bold text-[#475569]">Supabase API Endpoint URL</label>
                        <div class="mt-1">
                            <input type="url" id="supabase_url" value="<?php echo htmlspecialchars($supabase_url); ?>" required placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                                   class="block w-full appearance-none rounded-lg border border-[#cbd5e1] px-3 py-2.5 placeholder-[#94a3b8] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm transition-all font-mono">
                        </div>
                    </div>

                    <div>
                        <label for="supabase_key" class="block text-sm font-bold text-[#475569]">Supabase Anon API Key</label>
                        <div class="mt-1">
                            <input type="password" id="supabase_key" value="<?php echo htmlspecialchars($supabase_key); ?>" required placeholder="eyJhbGciOi..."
                                   class="block w-full appearance-none rounded-lg border border-[#cbd5e1] px-3 py-2.5 placeholder-[#94a3b8] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm transition-all font-mono">
                        </div>
                    </div>

                    <div>
                        <label for="supabase_service_role" class="block text-sm font-bold text-[#475569]">Supabase Private Service Role Key</label>
                        <div class="mt-1">
                            <input type="password" id="supabase_service_role" value="<?php echo htmlspecialchars($supabase_service_role); ?>" required placeholder="eyJhbGciOi..."
                                   class="block w-full appearance-none rounded-lg border border-[#cbd5e1] px-3 py-2.5 placeholder-[#94a3b8] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm transition-all font-mono">
                        </div>
                        <span class="text-[10px] text-rose-600 mt-2 block font-medium">CRITICAL SECURITY WARNING: This secret service role token is stored 100% server-side on your secure host. It is never exposed to client browsers or JavaScript.</span>
                    </div>

                    <div class="flex justify-end">
                        <button type="submit" class="inline-flex justify-center px-4 py-2.5 border border-transparent text-sm font-bold rounded-lg shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all">
                            Save Configuration Keys
                        </button>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>

<!-- Detailed Inspect Modal (Slide Over / Center modal) -->
<div id="inspect-modal" class="hidden fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
    <div class="bg-white rounded-xl shadow-xl max-w-3xl w-full overflow-hidden border border-[#e2e8f0]">
        <div class="px-6 py-4 bg-slate-50 border-b border-[#e2e8f0] flex justify-between items-center">
            <div class="flex items-center space-x-2">
                <i data-lucide="activity" class="text-emerald-600 h-5 w-5"></i>
                <h3 class="text-lg font-bold text-[#0f172a]">Live Inspections: <span id="inspect-bot-id" class="text-indigo-700 font-mono"></span></h3>
            </div>
            <button onclick="closeInspectModal()" class="text-[#64748b] hover:text-[#0f172a] transition-all">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
        </div>

        <div class="p-6 space-y-6">
            <!-- Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div class="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg">
                    <span class="text-[10px] uppercase font-bold text-[#64748b]">Pipeline Status</span>
                    <p id="inspect-status" class="text-md font-extrabold text-[#0f172a] mt-0.5">-</p>
                </div>
                <div class="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg">
                    <span class="text-[10px] uppercase font-bold text-[#64748b]">Total Messages</span>
                    <p id="inspect-messages" class="text-md font-extrabold text-[#0f172a] mt-0.5">0</p>
                </div>
                <div class="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg">
                    <span class="text-[10px] uppercase font-bold text-[#64748b]">CPU Percent</span>
                    <p id="inspect-cpu" class="text-md font-extrabold text-[#0f172a] mt-0.5">0%</p>
                </div>
                <div class="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg">
                    <span class="text-[10px] uppercase font-bold text-[#64748b]">RAM MB</span>
                    <p id="inspect-ram" class="text-md font-extrabold text-[#0f172a] mt-0.5">0 MB</p>
                </div>
            </div>

            <!-- Operations Controller -->
            <div class="space-y-2">
                <span class="text-xs font-bold text-[#475569]">Remote Commands:</span>
                <div class="flex flex-wrap gap-2">
                    <button onclick="triggerInspectCmd('SYNC')" class="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-[#cbd5e1] rounded-md transition-all">
                        Sync Sync
                    </button>
                    <button onclick="triggerInspectCmd('RESTART')" class="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-[#cbd5e1] rounded-md transition-all">
                        Restart
                    </button>
                    <button onclick="triggerInspectCmd('RECONNECT')" class="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-[#cbd5e1] rounded-md transition-all">
                        Reconnect
                    </button>
                    <button onclick="triggerInspectCmd('LOGOUT')" class="inline-flex items-center px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-all">
                        Teardown Session
                    </button>
                </div>
            </div>

            <!-- Terminal log output -->
            <div class="space-y-1.5">
                <span class="text-xs font-bold text-[#475569]">Diagnostic Live Terminal Logs:</span>
                <div id="inspect-terminal" class="bg-slate-950 font-mono text-xs p-4 rounded-xl text-slate-200 h-64 overflow-y-auto space-y-1.5">
                    <div class="text-[#64748b]">[SYSTEM] Initializing stream...</div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// Tab Switching controller
function switchTab(tabId, btnElement) {
    // Hide all panels
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    // Show target panel
    document.getElementById(tabId).classList.remove('hidden');

    // Reset button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = "tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors";
    });

    // Mark current button active
    btnElement.className = "tab-btn w-full text-left inline-flex items-center px-3 py-2 text-sm font-semibold rounded-lg transition-colors text-emerald-700 bg-emerald-50";
}

// Admin API submissions
async function processPayment(requestId, status) {
    if (!confirm(`Are you sure you want to ${status} this payment request?`)) {
        return;
    }
    
    try {
        const res = await fetch('api.php?action=handle_payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: requestId, status: status })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert("Error processing operation: " + data.error);
        }
    } catch (e) {
        alert("Transport failure.");
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`WARNING: Are you sure you want to permanently delete user '${username}'? This will purge all associated slots and cloud bot connection records!`)) {
        return;
    }
    
    try {
        const res = await fetch('api.php?action=delete_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        alert("Failed to send request.");
    }
}

// Supabase Settings form
document.getElementById('supabase-settings-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const supabase_url = document.getElementById('supabase_url').value;
    const supabase_key = document.getElementById('supabase_key').value;
    const supabase_service_role = document.getElementById('supabase_service_role').value;

    try {
        const res = await fetch('api.php?action=update_supabase_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supabase_url, supabase_key, supabase_service_role })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert("Error: " + data.error);
        }
    } catch (err) {
        alert("Failed to submit integration credentials.");
    }
});

// Live Inspect Modal Logic
let currentInspectBotId = null;
let inspectPollerInterval = null;

function inspectBot(botId) {
    currentInspectBotId = botId;
    document.getElementById('inspect-bot-id').innerText = botId;
    document.getElementById('inspect-modal').classList.remove('hidden');
    
    // Begin fast polling
    runInspectPoller();
    inspectPollerInterval = setInterval(runInspectPoller, 3000); // 3 seconds interval for admins
}

function closeInspectModal() {
    document.getElementById('inspect-modal').classList.add('hidden');
    if (inspectPollerInterval) {
        clearInterval(inspectPollerInterval);
        inspectPollerInterval = null;
    }
    currentInspectBotId = null;
}

async function runInspectPoller() {
    if (!currentInspectBotId) return;
    try {
        const res = await fetch(`api.php?action=poll_bot_status&bot_id=${encodeURIComponent(currentInspectBotId)}`);
        const data = await res.json();
        
        if (!data.success) return;
        
        if (!data.is_online || !data.session) {
            document.getElementById('inspect-status').innerText = "OFFLINE";
            return;
        }

        document.getElementById('inspect-status').innerText = (data.session.status || 'PENDING').toUpperCase();
        
        if (data.metrics) {
            document.getElementById('inspect-messages').innerText = parseInt(data.metrics.total_messages || 0).toLocaleString();
        }
        
        if (data.runtime) {
            document.getElementById('inspect-cpu').innerText = `${Math.round(data.runtime.cpu || 0)}%`;
            document.getElementById('inspect-ram').innerText = `${Math.round(data.runtime.memory || 0)} MB`;
        }

        // Render logs
        const term = document.getElementById('inspect-terminal');
        if (term && Array.isArray(data.logs)) {
            if (data.logs.length === 0) {
                term.innerHTML = `<div class="text-[#64748b]">[SYSTEM] No runtime logs recorded yet in Supabase.</div>`;
            } else {
                let html = '';
                const sortedLogs = [...data.logs].reverse();
                sortedLogs.forEach(log => {
                    let lvlColor = 'text-blue-400';
                    if (log.level === 'ERROR') lvlColor = 'text-rose-400';
                    else if (log.level === 'WARNING') lvlColor = 'text-amber-400';
                    else if (log.level === 'SUCCESS') lvlColor = 'text-emerald-400';
                    
                    const timeStr = new Date(log.created_at).toLocaleTimeString();
                    html += `<div class="leading-relaxed">
                        <span class="text-[#64748b]">[${timeStr}]</span> 
                        <span class="font-bold uppercase ${lvlColor}">[${log.category}]</span> 
                        <span>${escapeHTML(log.message)}</span>
                    </div>`;
                });
                term.innerHTML = html;
                term.scrollTop = term.scrollHeight;
            }
        }
    } catch (e) {
        console.error("Admin poller error:", e);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

async function triggerInspectCmd(action) {
    if (!currentInspectBotId) return;
    if (!confirm(`Are you sure you want to trigger remote action '${action}' on ${currentInspectBotId}?`)) {
        return;
    }

    try {
        const res = await fetch(`api.php?action=queue_command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bot_id: currentInspectBotId, cmd_action: action })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            if (action === 'LOGOUT') {
                closeInspectModal();
                location.reload();
            } else {
                runInspectPoller();
            }
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        alert("Transport failed.");
    }
}
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
