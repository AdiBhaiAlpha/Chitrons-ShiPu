<?php
$page_title = 'Client Dashboard - ShiPu AI';
include __DIR__ . '/includes/header.php';

if (!$is_logged_in) {
    header("Location: login.php");
    exit();
}

if ($is_admin) {
    header("Location: admin.php");
    exit();
}

try {
    // Fetch slots for this user from Supabase client_site_slots
    $slots = DB::select('client_site_slots', ['user_id' => $user_id], 'created_at.asc');
} catch (Exception $e) {
    $slots = [];
}

// Count stats
$total_slots = count($slots);
$active_bots_count = 0;
$empty_slots_count = 0;
foreach ($slots as $s) {
    if (($s['status'] ?? '') === 'active') {
        $active_bots_count++;
    } else {
        $empty_slots_count++;
    }
}

try {
    // Fetch payment requests from Supabase client_site_payments
    $payment_requests = DB::select('client_site_payments', ['user_id' => $user_id], 'created_at.desc');
} catch (Exception $e) {
    $payment_requests = [];
}

// Is Supabase fully configured?
$supabase_configured = DB::getSetting('SUPABASE_URL') && DB::getSetting('SUPABASE_KEY');
?>

<!-- Info Alerts -->
<?php if (!$supabase_configured): ?>
    <div class="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
        <div class="flex">
            <div class="flex-shrink-0">
                <i data-lucide="alert-triangle" class="h-5 w-5 text-amber-500"></i>
            </div>
            <div class="ml-3">
                <h3 class="text-sm font-semibold text-amber-800">Supabase Connection Required</h3>
                <p class="mt-1 text-sm text-amber-700">
                    The platform is not connected to Supabase yet. Please ask your administrator to configure Supabase URL and Key in Supabase Settings.
                </p>
            </div>
        </div>
    </div>
<?php endif; ?>

<!-- Dashboard Metrics -->
<div class="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
    <div class="bg-white overflow-hidden shadow-sm border border-[#e2e8f0] rounded-xl px-5 py-6 flex items-center">
        <div class="p-3 bg-emerald-50 rounded-lg text-emerald-600 mr-4">
            <i data-lucide="cpu" class="h-6 w-6"></i>
        </div>
        <div>
            <p class="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Total Bot Slots</p>
            <p class="text-2xl font-bold text-[#0f172a]"><?php echo $total_slots; ?></p>
        </div>
    </div>

    <div class="bg-white overflow-hidden shadow-sm border border-[#e2e8f0] rounded-xl px-5 py-6 flex items-center">
        <div class="p-3 bg-indigo-50 rounded-lg text-indigo-600 mr-4">
            <i data-lucide="circle-dot" class="h-6 w-6"></i>
        </div>
        <div>
            <p class="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Active Bots</p>
            <p class="text-2xl font-bold text-[#0f172a]"><?php echo $active_bots_count; ?></p>
        </div>
    </div>

    <div class="bg-white overflow-hidden shadow-sm border border-[#e2e8f0] rounded-xl px-5 py-6 flex items-center">
        <div class="p-3 bg-amber-50 rounded-lg text-amber-600 mr-4">
            <i data-lucide="pocket" class="h-6 w-6"></i>
        </div>
        <div>
            <p class="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Available Slots</p>
            <p class="text-2xl font-bold text-[#0f172a]"><?php echo $empty_slots_count; ?></p>
        </div>
    </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Left 2 columns: Bot Slots -->
    <div class="lg:col-span-2 space-y-6">
        <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl">
            <div class="px-6 py-5 border-b border-[#f1f5f9] flex justify-between items-center">
                <div>
                    <h2 class="text-lg font-bold text-[#0f172a]">Your Bot Slots</h2>
                    <p class="text-sm text-[#64748b]">Configure and monitor your client bots in real-time.</p>
                </div>
            </div>

            <div class="p-6">
                <?php if ($total_slots === 0): ?>
                    <div class="text-center py-12">
                        <div class="inline-flex p-3 bg-slate-50 text-slate-400 rounded-full mb-4">
                            <i data-lucide="layers" class="h-8 w-8"></i>
                        </div>
                        <h3 class="text-sm font-semibold text-[#0f172a]">No bot slots available</h3>
                        <p class="mt-1 text-sm text-[#64748b] max-w-md mx-auto">
                            Purchase your first bot slot from the order panel on the right (1 Slot = 500 BDT) to launch a running bot!
                        </p>
                    </div>
                <?php else: ?>
                    <div class="space-y-4">
                        <?php foreach ($slots as $index => $slot): ?>
                            <div class="border border-[#e2e8f0] rounded-xl p-5 hover:border-emerald-300 hover:shadow-sm transition-all" id="slot-card-<?php echo $slot['id']; ?>">
                                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                                    <div class="flex items-start space-x-3.5">
                                        <div class="p-2.5 bg-slate-50 text-[#475569] rounded-lg border border-[#e2e8f0] font-bold text-sm">
                                            #<?php echo $index + 1; ?>
                                        </div>
                                        <div>
                                            <div class="flex items-center space-x-2">
                                                <h4 class="font-bold text-[#0f172a]">Slot ID: <?php echo htmlspecialchars($slot['id']); ?></h4>
                                                <?php if ($slot['status'] === 'active'): ?>
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Active
                                                    </span>
                                                <?php else: ?>
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                        Unassigned
                                                    </span>
                                                <?php endif; ?>
                                            </div>
                                            
                                            <?php if ($slot['status'] === 'active'): ?>
                                                <p class="text-sm text-[#475569] mt-1 flex items-center">
                                                    <i data-lucide="tag" class="w-3.5 h-3.5 mr-1 text-[#64748b]"></i>
                                                    Bot ID: <span class="font-semibold text-indigo-700 ml-1"><?php echo htmlspecialchars($slot['bot_id']); ?></span>
                                                </p>
                                                <div class="mt-2 text-xs text-[#64748b] flex items-center space-x-3">
                                                    <span>Live Status:</span>
                                                    <span id="live-badge-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="font-semibold text-amber-600 flex items-center">
                                                        <span class="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
                                                        Initializing...
                                                    </span>
                                                </div>
                                            <?php else: ?>
                                                <p class="text-sm text-[#64748b] mt-1">Ready for cookie submission. Set up your bot to run 24/7 on our cloud host.</p>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center space-x-2 self-end sm:self-center">
                                        <?php if ($slot['status'] === 'active'): ?>
                                            <button onclick="openConfigModal(<?php echo $slot['id']; ?>, '<?php echo htmlspecialchars($slot['bot_id']); ?>')"
                                                    class="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all mr-2">
                                                <i data-lucide="refresh-cw" class="w-4 h-4 mr-1.5"></i>
                                                Update Cookie
                                            </button>
                                            <button onclick="toggleBotConsole('<?php echo htmlspecialchars($slot['bot_id']); ?>')"
                                                    class="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#cbd5e1] rounded-lg shadow-sm transition-all">
                                                <i data-lucide="terminal" class="w-4 h-4 mr-1.5"></i>
                                                Console & Live Monitor
                                            </button>
                                        <?php else: ?>
                                            <button onclick="openConfigModal(<?php echo $slot['id']; ?>)"
                                                    class="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all">
                                                <i data-lucide="plus-circle" class="w-4 h-4 mr-1.5"></i>
                                                Setup / Add Cookie
                                            </button>
                                        <?php endif; ?>
                                    </div>
                                </div>

                                <!-- Dynamic Console & Logs Panel (Collapsible) -->
                                <?php if ($slot['status'] === 'active'): ?>
                                    <div id="console-panel-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="hidden mt-5 border-t border-[#f1f5f9] pt-5 space-y-5">
                                        
                                        <!-- Live Resource Bars & System Counts -->
                                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div class="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                                                <span class="text-[10px] uppercase font-bold text-[#64748b]">Total Processed</span>
                                                <p id="stat-messages-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="text-xl font-bold text-[#0f172a] mt-0.5">0</p>
                                                <span class="text-[10px] text-[#64748b]">messages received</span>
                                            </div>
                                            <div class="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                                                <span class="text-[10px] uppercase font-bold text-[#64748b]">AI Queries</span>
                                                <p id="stat-ai-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="text-xl font-bold text-[#0f172a] mt-0.5">0</p>
                                                <span class="text-[10px] text-[#64748b]">completions executed</span>
                                            </div>
                                            <div class="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                                                <span class="text-[10px] uppercase font-bold text-[#64748b]">CPU usage</span>
                                                <div class="flex items-center space-x-2 mt-1">
                                                    <div class="flex-grow bg-slate-200 rounded-full h-2">
                                                        <div id="cpu-progress-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="bg-indigo-600 h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
                                                    </div>
                                                    <span id="cpu-val-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="text-xs font-bold text-indigo-700">0%</span>
                                                </div>
                                            </div>
                                            <div class="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                                                <span class="text-[10px] uppercase font-bold text-[#64748b]">RAM consumption</span>
                                                <div class="flex items-center space-x-2 mt-1">
                                                    <div class="flex-grow bg-slate-200 rounded-full h-2">
                                                        <div id="ram-progress-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="bg-indigo-600 h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
                                                    </div>
                                                    <span id="ram-val-<?php echo htmlspecialchars($slot['bot_id']); ?>" class="text-xs font-bold text-indigo-700">0 MB</span>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Diagnostic Controller buttons -->
                                        <div class="flex flex-wrap gap-2">
                                            <button onclick="triggerCommand('<?php echo htmlspecialchars($slot['bot_id']); ?>', 'SYNC')"
                                                    class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-[#cbd5e1] rounded-md transition-all">
                                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 mr-1"></i> Sync Sync
                                            </button>
                                            <button onclick="triggerCommand('<?php echo htmlspecialchars($slot['bot_id']); ?>', 'RESTART')"
                                                    class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-[#cbd5e1] rounded-md transition-all">
                                                <i data-lucide="power" class="w-3.5 h-3.5 mr-1"></i> Restart Bot
                                            </button>
                                            <button onclick="triggerCommand('<?php echo htmlspecialchars($slot['bot_id']); ?>', 'RECONNECT')"
                                                    class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-[#cbd5e1] rounded-md transition-all">
                                                <i data-lucide="wifi" class="w-3.5 h-3.5 mr-1"></i> Force Reconnect
                                            </button>
                                            <button onclick="triggerCommand('<?php echo htmlspecialchars($slot['bot_id']); ?>', 'LOGOUT')"
                                                    class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-all">
                                                <i data-lucide="trash-2" class="w-3.5 h-3.5 mr-1"></i> Uninstall & Logout
                                            </button>
                                        </div>

                                        <!-- Live Scrolling Console Log terminal widget -->
                                        <div class="space-y-1.5">
                                            <span class="text-xs font-bold text-[#475569]">System Log Output:</span>
                                            <div id="log-terminal-<?php echo htmlspecialchars($slot['bot_id']); ?>" 
                                                 class="bg-slate-950 font-mono text-xs p-4 rounded-xl text-slate-200 h-64 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                                                <div class="text-[#64748b]">[SYSTEM] Initializing console listener for Bot ID: <?php echo htmlspecialchars($slot['bot_id']); ?>...</div>
                                            </div>
                                        </div>
                                    </div>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Right 1 Column: Purchase Portal -->
    <div class="space-y-6">
        <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl p-6">
            <h3 class="text-lg font-bold text-[#0f172a]">Order Bot Slots</h3>
            <p class="text-sm text-[#64748b] mt-1">Acquire additional 24/7 cloud hosts.</p>
            
            <div class="my-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p class="text-xs text-[#64748b] uppercase font-bold">Standard Pricing</p>
                <p class="text-xl font-black text-emerald-800 mt-1">500 BDT <span class="text-sm font-normal text-[#475569]">/ slot</span></p>
            </div>

            <form id="purchase-form" class="space-y-4">
                <div>
                    <label for="slots_requested" class="block text-sm font-medium text-[#475569]">How many slots?</label>
                    <input type="number" id="slots_requested" min="1" max="10" value="1" oninput="calculatePrice(this.value)"
                           class="mt-1 block w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none transition-all">
                </div>

                <div class="bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0] text-sm">
                    <div class="flex justify-between font-medium">
                        <span>Total Price:</span>
                        <span id="calculated-price" class="font-bold text-emerald-700">500 BDT</span>
                    </div>
                </div>

                <div>
                    <label for="payment_method" class="block text-sm font-medium text-[#475569]">Payment Method</label>
                    <select id="payment_method" class="mt-1 block w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none transition-all">
                        <option value="bKash">bKash Personal (01700-000000)</option>
                        <option value="Nagad">Nagad Personal (01900-000000)</option>
                        <option value="Rocket">Rocket Personal (01800-000000)</option>
                    </select>
                    <span class="text-[10px] text-[#64748b] mt-1 block">Please send money manually to the selected number first before filling details.</span>
                </div>

                <div>
                    <label for="transaction_id" class="block text-sm font-medium text-[#475569]">Transaction ID</label>
                    <input type="text" id="transaction_id" placeholder="e.g. BAX873H7Y8" required
                           class="mt-1 block w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none transition-all">
                </div>

                <button type="submit" class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all">
                    Submit Payment Request
                </button>
            </form>
        </div>

        <!-- Ledger ledger -->
        <div class="bg-white shadow-sm border border-[#e2e8f0] rounded-xl p-6">
            <h3 class="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-4">Payment Requests History</h3>
            <?php if (empty($payment_requests)): ?>
                <p class="text-xs text-[#64748b] text-center py-4">No recent payment submissions found.</p>
            <?php else: ?>
                <div class="flow-root">
                    <ul role="list" class="-my-5 divide-y divide-[#f1f5f9]">
                        <?php foreach ($payment_requests as $req): ?>
                            <li class="py-4">
                                <div class="flex items-center justify-between">
                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-semibold text-[#0f172a]"><?php echo $req['slots_requested']; ?> Slot(s) Request</p>
                                        <p class="text-xs text-[#64748b] mt-0.5">Trx ID: <?php echo htmlspecialchars($req['transaction_id']); ?></p>
                                        <p class="text-[10px] text-[#94a3b8] mt-0.5"><?php echo $req['created_at']; ?></p>
                                    </div>
                                    <div class="flex flex-col items-end">
                                        <span class="text-sm font-bold text-[#0f172a]"><?php echo $req['amount']; ?> BDT</span>
                                        <?php if ($req['status'] === 'approved'): ?>
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 mt-1">Approved</span>
                                        <?php elseif ($req['status'] === 'declined'): ?>
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 mt-1">Declined</span>
                                        <?php else: ?>
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 mt-1 animate-pulse">Pending</span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Slide Over Setup modal -->
<div id="setup-modal" class="hidden fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
    <div class="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-[#e2e8f0]">
        <div class="px-6 py-4 bg-slate-50 border-b border-[#e2e8f0] flex justify-between items-center">
            <h3 class="text-lg font-bold text-[#0f172a]">Configure Client Bot</h3>
            <button onclick="closeConfigModal()" class="text-[#64748b] hover:text-[#0f172a] transition-all">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
        </div>
        
        <form id="setup-form" class="p-6 space-y-4">
            <input type="hidden" id="modal_slot_id" name="slot_id">
            
            <div>
                <label for="modal_bot_id" class="block text-sm font-bold text-[#475569]">Unique Bot ID</label>
                <input type="text" id="modal_bot_id" name="bot_id" required placeholder="e.g. bot_fb_10294"
                       class="mt-1 block w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none transition-all">
                <span class="text-[10px] text-[#64748b] mt-1 block">A distinct identifier for your cloud bot (e.g. your Facebook numerical Account UID).</span>
            </div>

            <div>
                <label for="modal_connection_mode" class="block text-sm font-bold text-[#475569]">Connection Protocol Mode</label>
                <select id="modal_connection_mode" name="connection_mode" class="mt-1 block w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none transition-all">
                    <option value="default">Default (IPv4 Preferred)</option>
                    <option value="ipv6">Force IPv6 Proxy</option>
                    <option value="auto">Automatic Fallback</option>
                </select>
            </div>

            <div>
                <label for="modal_cookie" class="block text-sm font-bold text-[#475569]">Raw FB Cookie JSON Array</label>
                <textarea id="modal_cookie" name="cookie" rows="6" required placeholder='[{"key":"c_user","value":"1000..."}, ...]'
                          class="mt-1 block w-full font-mono text-xs rounded-lg border border-[#cbd5e1] px-3 py-2 focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none transition-all"></textarea>
                <span class="text-[10px] text-[#64748b] mt-1 block">Paste the raw JSON array containing your logged-in cookies. Ensure to keep your keys safe.</span>
            </div>

            <div class="flex justify-end space-x-3 pt-4 border-t border-[#f1f5f9]">
                <button type="button" onclick="closeConfigModal()" class="px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#cbd5e1] rounded-lg transition-all">
                    Cancel
                </button>
                <button type="submit" class="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all">
                    Save and Boot Bot
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Interactive JavaScript state logic -->
<script>
function calculatePrice(slots) {
    const total = (parseInt(slots) || 0) * 500;
    document.getElementById('calculated-price').innerText = total + " BDT";
}

function openConfigModal(slotId, botId = '') {
    document.getElementById('modal_slot_id').value = slotId;
    document.getElementById('modal_bot_id').value = botId;
    if (botId) {
        document.getElementById('modal_bot_id').readOnly = true;
        document.getElementById('modal_bot_id').classList.add('bg-slate-100');
    } else {
        document.getElementById('modal_bot_id').readOnly = false;
        document.getElementById('modal_bot_id').classList.remove('bg-slate-100');
    }
    document.getElementById('setup-modal').classList.remove('hidden');
}

function closeConfigModal() {
    document.getElementById('setup-modal').classList.add('hidden');
    document.getElementById('setup-form').reset();
}

// Global reference for active poller loops
const activePollers = {};

function toggleBotConsole(botId) {
    const panel = document.getElementById(`console-panel-${botId}`);
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        startPolling(botId);
    } else {
        panel.classList.add('hidden');
        stopPolling(botId);
    }
}

function startPolling(botId) {
    if (activePollers[botId]) return;
    
    // First immediate load
    pollBotStatus(botId);
    
    // Set 5-second interval loop
    activePollers[botId] = setInterval(() => {
        pollBotStatus(botId);
    }, 5000);
}

function stopPolling(botId) {
    if (activePollers[botId]) {
        clearInterval(activePollers[botId]);
        delete activePollers[botId];
    }
}

// Fetch status from PHP Proxy
async function pollBotStatus(botId) {
    try {
        const res = await fetch(`api.php?action=poll_bot_status&bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        
        if (!data.success) return;
        
        const liveBadge = document.getElementById(`live-badge-${botId}`);
        if (!data.is_online || !data.session) {
            if (liveBadge) {
                liveBadge.className = "font-semibold text-rose-600 flex items-center";
                liveBadge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-rose-500 mr-1.5"></span>Offline / Dead`;
            }
            return;
        }

        // Update live status badge
        const status = data.session.status || 'pending';
        let statusClass = "text-amber-600";
        let dotClass = "bg-amber-500 animate-pulse";
        
        if (status === 'running') {
            statusClass = "text-emerald-600";
            dotClass = "bg-emerald-500";
        } else if (status === 'failed') {
            statusClass = "text-rose-600";
            dotClass = "bg-rose-500";
        } else if (status === 'recovering') {
            statusClass = "text-orange-600";
            dotClass = "bg-orange-500 animate-bounce";
        }

        if (liveBadge) {
            liveBadge.className = `font-semibold ${statusClass} flex items-center`;
            liveBadge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full ${dotClass} mr-1.5"></span>${status.toUpperCase()}`;
        }

        // Update metrics
        if (data.metrics) {
            const msgEl = document.getElementById(`stat-messages-${botId}`);
            if (msgEl) msgEl.innerText = parseInt(data.metrics.total_messages || 0).toLocaleString();
            
            const aiEl = document.getElementById(`stat-ai-${botId}`);
            if (aiEl) aiEl.innerText = parseInt(data.metrics.ai_messages || 0).toLocaleString();
        }

        // Update resource usages
        if (data.runtime) {
            const cpu = Math.round(data.runtime.cpu || 0);
            const memory = Math.round(data.runtime.memory || 0);

            const cpuBar = document.getElementById(`cpu-progress-${botId}`);
            const cpuVal = document.getElementById(`cpu-val-${botId}`);
            if (cpuBar) cpuBar.style.width = `${cpu}%`;
            if (cpuVal) cpuVal.innerText = `${cpu}%`;

            const ramBar = document.getElementById(`ram-progress-${botId}`);
            const ramVal = document.getElementById(`ram-val-${botId}`);
            if (ramBar) ramBar.style.width = `${Math.min(100, (memory / 512) * 100)}%`; // Relative to 512MB standard
            if (ramVal) ramVal.innerText = `${memory} MB`;
        }

        // Update scrolling console logs
        const term = document.getElementById(`log-terminal-${botId}`);
        if (term && Array.isArray(data.logs)) {
            // Check if there are logs
            if (data.logs.length === 0) {
                term.innerHTML = `<div class="text-[#64748b]">[SYSTEM] No runtime logs recorded yet in Supabase.</div>`;
            } else {
                let html = '';
                // Render from oldest to newest
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
                // Auto-scroll to bottom on each update
                term.scrollTop = term.scrollHeight;
            }
        }
    } catch (e) {
        console.error("Poller error:", e);
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

// Remote Trigger queue commands
async function triggerCommand(botId, action) {
    if (!confirm(`Are you sure you want to trigger '${action}' on this bot instance?`)) {
        return;
    }
    
    try {
        const res = await fetch(`api.php?action=queue_command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bot_id: botId, cmd_action: action })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            if (action === 'LOGOUT' || action === 'DELETE') {
                location.reload();
            } else {
                pollBotStatus(botId);
            }
        } else {
            alert("Execution failed: " + data.error);
        }
    } catch (e) {
        alert("Transport failure: " + e.message);
    }
}

// Forms Submissions
document.getElementById('setup-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting...";

    const slot_id = document.getElementById('modal_slot_id').value;
    const bot_id = document.getElementById('modal_bot_id').value;
    const connection_mode = document.getElementById('modal_connection_mode').value;
    const cookie = document.getElementById('modal_cookie').value;

    try {
        const res = await fetch('api.php?action=submit_bot_cookie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot_id, bot_id, connection_mode, cookie })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert("Error: " + data.error);
            submitBtn.disabled = false;
            submitBtn.innerText = "Save and Boot Bot";
        }
    } catch (err) {
        alert("Failed to submit credentials.");
        submitBtn.disabled = false;
        submitBtn.innerText = "Save and Boot Bot";
    }
});

document.getElementById('purchase-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const slots_requested = document.getElementById('slots_requested').value;
    const payment_method = document.getElementById('payment_method').value;
    const transaction_id = document.getElementById('transaction_id').value;

    try {
        const res = await fetch('api.php?action=purchase_slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slots_requested, payment_method, transaction_id })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert("Error: " + data.error);
        }
    } catch (err) {
        alert("Transport failed to place slot order.");
    }
});
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
