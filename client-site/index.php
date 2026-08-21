<?php
// Public Landing Page & SaaS Entry Point for ShiPu AI PHP Client
$page_title = 'ShiPu AI - Enterprise Cloud Bot Management & Automation';
$is_public_landing = true;

require_once __DIR__ . '/includes/db.php';

include __DIR__ . '/includes/header.php';
?>

<!-- Premium Hero Section -->
<section class="relative bg-white pt-20 pb-24 overflow-hidden border-b border-[#e2e8f0]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div class="lg:grid lg:grid-cols-12 lg:gap-12 items-center">
            <!-- Left Headline Block -->
            <div class="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-6">
                    <span class="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                    Next-Generation Client Gateway
                </span>
                <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#0f172a] leading-[1.1]">
                    Cloud Bot Management <br>
                    <span class="bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">Streamlined for Scale</span>
                </h1>
                <p class="mt-4 text-base sm:text-lg text-[#475569] leading-relaxed">
                    Deploy, configure, and monitor your ShiPu bot sessions securely in the cloud. Eliminate the hassle of running persistent terminal sessions locally. Gain real-time visibility through high-performance Supabase streams.
                </p>
                <div class="mt-8 sm:max-w-lg sm:mx-auto lg:mx-0">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <a href="register.php" class="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all">
                            Start Now (Get Started)
                        </a>
                        <a href="#how-it-works" class="inline-flex justify-center items-center px-6 py-3 border border-[#cbd5e1] text-base font-medium rounded-lg text-[#334155] bg-white hover:bg-[#f8fafc] transition-all">
                            How It Works
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Right Mockup Visual (Dashboard Preview) -->
            <div class="mt-12 sm:mt-16 lg:mt-0 lg:col-span-6">
                <div class="relative mx-auto w-full max-w-lg lg:max-w-none rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 shadow-xl">
                    <div class="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden shadow-sm">
                        <!-- Simulated Terminal Title Bar -->
                        <div class="bg-[#0f172a] px-4 py-3 flex items-center justify-between border-b border-[#1e293b]">
                            <div class="flex space-x-1.5">
                                <span class="w-3 h-3 rounded-full bg-rose-500"></span>
                                <span class="w-3 h-3 rounded-full bg-amber-500"></span>
                                <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                            </div>
                            <span class="text-[11px] font-mono text-[#64748b]">shipu-session-agent-01</span>
                            <span class="w-4"></span>
                        </div>
                        
                        <!-- Simulated Dashboard Metrics -->
                        <div class="p-6 space-y-4">
                            <div class="grid grid-cols-3 gap-3">
                                <div class="bg-slate-50 border border-[#e2e8f0] p-3 rounded-lg">
                                    <span class="text-[10px] font-bold text-[#64748b] uppercase">Session ID</span>
                                    <p class="text-xs font-mono font-bold text-[#0f172a] mt-0.5">bot-902x</p>
                                </div>
                                <div class="bg-slate-50 border border-[#e2e8f0] p-3 rounded-lg">
                                    <span class="text-[10px] font-bold text-[#64748b] uppercase">Uptime</span>
                                    <p class="text-xs font-mono font-bold text-[#0f172a] mt-0.5">14d 6h</p>
                                </div>
                                <div class="bg-emerald-50/50 border border-emerald-200 p-3 rounded-lg">
                                    <span class="text-[10px] font-bold text-emerald-800 uppercase">Status</span>
                                    <p class="text-xs font-bold text-emerald-700 mt-0.5">Active</p>
                                </div>
                            </div>
                            <!-- Terminal Stream -->
                            <div class="bg-slate-950 font-mono text-[11px] p-4 rounded-lg text-slate-300 space-y-1 overflow-hidden h-36">
                                <div class="text-[#64748b]">[18:11:04] Initializing secure cloud context...</div>
                                <div class="text-emerald-400">[18:11:05] Loaded authentication session cookies</div>
                                <div class="text-emerald-400">[18:11:06] Connection established successfully</div>
                                <div class="text-[#38bdf8]">[18:11:08] Sync completed. Standing by for queue commands...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Product/Service Introduction Section -->
<section id="features" class="bg-[#f8fafc] py-20 border-b border-[#e2e8f0]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="text-3xl font-extrabold tracking-tight text-[#0f172a]">
                A Complete Cloud-Native Suite for Automation
            </h2>
            <p class="mt-4 text-base text-[#64748b]">
                Deploy, monitor, and scale automated agents without leaving your web browser. Built on modular client-server synchronization models.
            </p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="bg-white border border-[#e2e8f0] p-8 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div class="h-12 w-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-6">
                    <i data-lucide="cpu" class="h-6 w-6"></i>
                </div>
                <h3 class="text-lg font-bold text-[#0f172a]">Cloud Bot Management</h3>
                <p class="mt-3 text-sm text-[#475569] leading-relaxed">
                    Instantly provision dedicated virtual execution contexts for your bots. No local background CLI required—all actions are handled on high-availability cloud runtimes.
                </p>
            </div>
            
            <div class="bg-white border border-[#e2e8f0] p-8 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div class="h-12 w-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-6">
                    <i data-lucide="cookie" class="h-6 w-6"></i>
                </div>
                <h3 class="text-lg font-bold text-[#0f172a]">Secure Cookie Isolation</h3>
                <p class="mt-3 text-sm text-[#475569] leading-relaxed">
                    Safeguard your authentication sessions. Raw cookies are fully validated, safely compiled, and isolated dynamically with no plain text exposure to third parties.
                </p>
            </div>
            
            <div class="bg-white border border-[#e2e8f0] p-8 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div class="h-12 w-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-6">
                    <i data-lucide="layers" class="h-6 w-6"></i>
                </div>
                <h3 class="text-lg font-bold text-[#0f172a]">Bot Slot Management</h3>
                <p class="mt-3 text-sm text-[#475569] leading-relaxed">
                    Allocate dedicated execution channels dynamically. Upgrade or scale your slot volume through simple, instant payment submissions and zero downtime.
                </p>
            </div>
        </div>
    </div>
</section>

<!-- How the Platform Works Section -->
<section id="how-it-works" class="bg-white py-20 border-b border-[#e2e8f0]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="text-3xl font-extrabold tracking-tight text-[#0f172a]">
                Simple, Three-Step Lifecycle
            </h2>
            <p class="mt-4 text-base text-[#64748b]">
                No configuration scripts or command-line familiarity needed. Follow our stream-lined onboarding flow.
            </p>
        </div>
        
        <div class="relative">
            <div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-[#e2e8f0] h-full top-0"></div>
            <div class="space-y-12 md:space-y-20 relative z-10">
                <!-- Step 1 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div class="md:text-right md:pr-12">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                            Step 01
                        </span>
                        <h3 class="text-xl font-bold text-[#0f172a]">Acquire Executable Slots</h3>
                        <p class="mt-2 text-sm text-[#475569] leading-relaxed">
                            Sign up for an account and request active execution slots. Submit transaction records directly to the administrator for instant, manual ledger reconciliation.
                        </p>
                    </div>
                    <div class="md:pl-12 flex justify-start">
                        <div class="bg-slate-50 border border-[#e2e8f0] p-6 rounded-xl w-full max-w-sm flex items-center shadow-sm">
                            <i data-lucide="shopping-cart" class="h-8 w-8 text-emerald-600 mr-4"></i>
                            <div>
                                <h4 class="font-bold text-sm text-[#0f172a]">Ledger Registration</h4>
                                <p class="text-xs text-[#64748b] mt-0.5">Submit request with your custom BDT transaction ID.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Step 2 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div class="md:order-2 md:pl-12">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                            Step 02
                        </span>
                        <h3 class="text-xl font-bold text-[#0f172a]">Upload Authenticated Cookies</h3>
                        <p class="mt-2 text-sm text-[#475569] leading-relaxed">
                            Export your account's cookies in a JSON format and paste them into your allocated slot page. The cloud runtime compiles, initializes, and maps them instantly.
                        </p>
                    </div>
                    <div class="md:order-1 md:pr-12 flex justify-end">
                        <div class="bg-slate-50 border border-[#e2e8f0] p-6 rounded-xl w-full max-w-sm flex items-center shadow-sm">
                            <i data-lucide="key" class="h-8 w-8 text-emerald-600 mr-4"></i>
                            <div>
                                <h4 class="font-bold text-sm text-[#0f172a]">Secure Transmission</h4>
                                <p class="text-xs text-[#64748b] mt-0.5">Verify your cookie structure via our JSON validator.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Step 3 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div class="md:text-right md:pr-12">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                            Step 03
                        </span>
                        <h3 class="text-xl font-bold text-[#0f172a]">Monitor & Command Live</h3>
                        <p class="mt-2 text-sm text-[#475569] leading-relaxed">
                            Inspect metrics, CPU utilization, current active loops, and stream real-time logs. Trigger remote restarts, re-connection pipelines, or teardowns immediately.
                        </p>
                    </div>
                    <div class="md:pl-12 flex justify-start">
                        <div class="bg-slate-50 border border-[#e2e8f0] p-6 rounded-xl w-full max-w-sm flex items-center shadow-sm">
                            <i data-lucide="play-circle" class="h-8 w-8 text-emerald-600 mr-4"></i>
                            <div>
                                <h4 class="font-bold text-sm text-[#0f172a]">Live Automation</h4>
                                <p class="text-xs text-[#64748b] mt-0.5">Control state, restart pipelines, and inspect stdout.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Detailed Architectural Insights & Explanations -->
<section class="bg-[#f8fafc] py-20 border-b border-[#e2e8f0]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="text-3xl font-extrabold tracking-tight text-[#0f172a]">
                Deep Technological Overview
            </h2>
            <p class="mt-4 text-base text-[#64748b]">
                Designed for optimal efficiency, resource isolation, and resilient backend integrations.
            </p>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <!-- Part 1: Cloud Bot Management & Slotting -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm">
                <h3 class="text-xl font-bold text-[#0f172a] flex items-center">
                    <span class="p-2 bg-emerald-50 rounded-lg text-emerald-600 mr-3">
                        <i data-lucide="cpu" class="h-5 w-5"></i>
                    </span>
                    Isolated Cloud Execution & Slot Allocation
                </h3>
                <p class="mt-4 text-sm text-[#475569] leading-relaxed">
                    Unlike traditional scripts that share execution threads (leading to high failure rates when one session crashes), ShiPu AI allocates an independent runtime context for each active slot. 
                </p>
                <ul class="mt-4 space-y-2.5 text-sm text-[#64748b]">
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Dedicated Memory Heap:</strong> Protects session stability.</span>
                    </li>
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Automated Garbage Collection:</strong> Prevent RAM degradation over months of active loops.</span>
                    </li>
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Robust Fault Recovery:</strong> Automatic instant restart upon third-party disconnect.</span>
                    </li>
                </ul>
            </div>
            
            <!-- Part 2: Session & Cookie Lifecycle -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm">
                <h3 class="text-xl font-bold text-[#0f172a] flex items-center">
                    <span class="p-2 bg-emerald-50 rounded-lg text-emerald-600 mr-3">
                        <i data-lucide="shield-check" class="h-5 w-5"></i>
                    </span>
                    Cookie Isolation & Session Safety Rules
                </h3>
                <p class="mt-4 text-sm text-[#475569] leading-relaxed">
                    Cookies contain sensitive authentication signatures. Keeping them secure is our primary objective. Our system ensures strict isolation between the frontend browser and the persistent datastore.
                </p>
                <ul class="mt-4 space-y-2.5 text-sm text-[#64748b]">
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Server-Side Encryption:</strong> Credentials are encrypted over TLS before rest ingestion.</span>
                    </li>
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>No Local-Storage Footprint:</strong> Avoid cookie theft via browser-based malware.</span>
                    </li>
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Explicit Session Teardown:</strong> Revoke and purge cookies from database records immediately on session exit.</span>
                    </li>
                </ul>
            </div>
            
            <!-- Part 3: Real-Time Monitoring -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm">
                <h3 class="text-xl font-bold text-[#0f172a] flex items-center">
                    <span class="p-2 bg-emerald-50 rounded-lg text-emerald-600 mr-3">
                        <i data-lucide="activity" class="h-5 w-5"></i>
                    </span>
                    High-Frequency Diagnostics & Logs
                </h3>
                <p class="mt-4 text-sm text-[#475569] leading-relaxed">
                    The platform leverages Supabase database streams. When the backend agent writes logs, they propagate to your diagnostic modal within milliseconds without requiring browser poll loops.
                </p>
                <ul class="mt-4 space-y-2.5 text-sm text-[#64748b]">
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>CPU & RAM Telemetry:</strong> Track physical container metrics in real-time.</span>
                    </li>
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Diagnostic Stack Trace:</strong> Rapidly debug syntax issues or blocked API states.</span>
                    </li>
                </ul>
            </div>

            <!-- Part 4: Billing & Account Structure -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm">
                <h3 class="text-xl font-bold text-[#0f172a] flex items-center">
                    <span class="p-2 bg-emerald-50 rounded-lg text-emerald-600 mr-3">
                        <i data-lucide="banknote" class="h-5 w-5"></i>
                    </span>
                    Ledger Transparency & Account Management
                </h3>
                <p class="mt-4 text-sm text-[#475569] leading-relaxed">
                    We prioritize complete transparency. Users submit individual payment requests with valid payment transaction identifiers, which are approved manually by administrators.
                </p>
                <ul class="mt-4 space-y-2.5 text-sm text-[#64748b]">
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Fixed Flat-Rate:</strong> Simple 500 BDT billing increments per slot requested.</span>
                    </li>
                    <li class="flex items-start">
                        <i data-lucide="check" class="h-4 w-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span><strong>Security/Privacy First:</strong> No credit card profiles are compiled or retained.</span>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</section>

<!-- Interactive Slot Pricing Calculator Section -->
<section id="pricing" class="bg-white py-20 border-b border-[#e2e8f0]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-12">
            <h2 class="text-3xl font-extrabold tracking-tight text-[#0f172a]">
                Simple, Predictable Pricing
            </h2>
            <p class="mt-4 text-base text-[#64748b]">
                Expand your automated runtimes with ease. No hidden commitments, flat BDT ledger structure.
            </p>
        </div>
        
        <div class="max-w-lg mx-auto bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-8 shadow-sm">
            <h3 class="text-lg font-bold text-[#0f172a] text-center">Interactive Cost Estimator</h3>
            
            <div class="mt-6">
                <label for="slots-range" class="block text-xs font-semibold text-[#475569] uppercase tracking-wider text-center">
                    Number of Bot Slots: <span id="slots-display" class="text-emerald-700 font-bold text-sm">3</span>
                </label>
                <input type="range" id="slots-range" min="1" max="20" value="3" 
                       class="w-full h-2 bg-[#cbd5e1] rounded-lg appearance-none cursor-pointer mt-3 accent-emerald-600 focus:outline-none">
                <div class="flex justify-between text-[11px] text-[#64748b] mt-1.5 font-mono">
                    <span>1 Slot</span>
                    <span>10 Slots</span>
                    <span>20 Slots</span>
                </div>
            </div>
            
            <div class="mt-8 border-t border-[#e2e8f0] pt-6 flex justify-between items-center">
                <div>
                    <span class="text-xs font-semibold text-[#64748b] uppercase block">Total Flat BDT Rate</span>
                    <span id="price-display" class="text-3xl font-extrabold text-[#0f172a]">1,500</span>
                    <span class="text-xs font-bold text-[#64748b]">BDT</span>
                </div>
                <div class="text-right">
                    <span class="text-xs text-[#64748b] block">Billing Term</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0]">
                        One-Time Ledger Purchase
                    </span>
                </div>
            </div>
            
            <div class="mt-8">
                <a href="register.php" class="block w-full text-center py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all">
                    Register and Purchase Slots Now
                </a>
                <p class="text-center text-[11px] text-[#64748b] mt-2.5">
                    *Ledger accounts will activate instantly upon transaction verification by administrators.
                </p>
            </div>
        </div>
    </div>
</section>

<!-- Frequently Asked Questions Section -->
<section id="faq" class="bg-[#f8fafc] py-20 border-b border-[#e2e8f0]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="text-3xl font-extrabold tracking-tight text-[#0f172a]">
                Frequently Asked Questions
            </h2>
            <p class="mt-4 text-base text-[#64748b]">
                Everything you need to know about the ShiPu AI Client and platform features.
            </p>
        </div>
        
        <div class="max-w-3xl mx-auto space-y-4">
            <!-- FAQ 1 -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
                <button onclick="toggleFaq(1)" class="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none hover:bg-slate-50/50 transition-colors">
                    <span class="font-bold text-[#0f172a]">Do I need to keep my PC or local console open to run the bots?</span>
                    <i id="faq-icon-1" data-lucide="chevron-down" class="h-5 w-5 text-[#64748b] transform transition-transform"></i>
                </button>
                <div id="faq-ans-1" class="hidden px-6 pb-5">
                    <p class="text-sm text-[#475569] leading-relaxed">
                        No. The entire value of ShiPu AI is cloud-native deployment. Once you upload your account session cookies, our backend server executes the bots persistently inside containers. You can shut down your computer or close the browser tab, and the bots will continue working without interruption.
                    </p>
                </div>
            </div>
            
            <!-- FAQ 2 -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
                <button onclick="toggleFaq(2)" class="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none hover:bg-slate-50/50 transition-colors">
                    <span class="font-bold text-[#0f172a]">How safe are my cookies and account credentials?</span>
                    <i id="faq-icon-2" data-lucide="chevron-down" class="h-5 w-5 text-[#64748b] transform transition-transform"></i>
                </button>
                <div id="faq-ans-2" class="hidden px-6 pb-5">
                    <p class="text-sm text-[#475569] leading-relaxed">
                        Extremely safe. Your uploaded cookies are transmitted strictly over SSL/TLS directly into the private database structures, inaccessible to other users. No login credentials (like plain-text account passwords) are processed or held, meaning your primary account credentials remain safe from any potential attack vectors.
                    </p>
                </div>
            </div>
            
            <!-- FAQ 3 -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
                <button onclick="toggleFaq(3)" class="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none hover:bg-slate-50/50 transition-colors">
                    <span class="font-bold text-[#0f172a]">What is the price per execution slot, and how do I pay?</span>
                    <i id="faq-icon-3" data-lucide="chevron-down" class="h-5 w-5 text-[#64748b] transform transition-transform"></i>
                </button>
                <div id="faq-ans-3" class="hidden px-6 pb-5">
                    <p class="text-sm text-[#475569] leading-relaxed">
                        Each slot is billed at a flat rate of 500 BDT one-time cost. You can purchase additional slots directly inside your client dashboard. Choose your payment channel (e.g., Bkash/Nagad), make the transaction, and submit the ledger record (the BDT transaction ID) inside the portal. The administrator will approve your slot allocation quickly.
                    </p>
                </div>
            </div>

            <!-- FAQ 4 -->
            <div class="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
                <button onclick="toggleFaq(4)" class="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none hover:bg-slate-50/50 transition-colors">
                    <span class="font-bold text-[#0f172a]">Can I change the cookie payload of an existing bot session?</span>
                    <i id="faq-icon-4" data-lucide="chevron-down" class="h-5 w-5 text-[#64748b] transform transition-transform"></i>
                </button>
                <div id="faq-ans-4" class="hidden px-6 pb-5">
                    <p class="text-sm text-[#475569] leading-relaxed">
                        Yes. If your session expires or your credentials change, click the "Update Cookies" option inside the respective slot block in your Client Dashboard, paste the fresh JSON payload, and click upload. The server automatically triggers a session reload.
                    </p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Final Call-to-Action Section -->
<section class="bg-[#0f172a] py-20 text-white border-b border-[#1e293b]">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Ready to Automate Your Operations?
        </h2>
        <p class="mt-4 text-md text-[#94a3b8] max-w-2xl mx-auto leading-relaxed">
            Create an account in less than a minute. Secure your dedicated bot runtimes, upload your configurations, and let our highly-available cloud infrastructure handle the persistent loops.
        </p>
        <div class="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <a href="register.php" class="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-[#0f172a] bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all">
                Create Free Account Today
            </a>
            <a href="login.php" class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white border border-[#334155] hover:bg-[#1e293b] rounded-lg transition-all">
                Sign In to Portal
            </a>
        </div>
    </div>
</section>

<script>
// Dynamic calculator logic
const slotsRange = document.getElementById('slots-range');
const slotsDisplay = document.getElementById('slots-display');
const priceDisplay = document.getElementById('price-display');

slotsRange.addEventListener('input', function() {
    const value = parseInt(this.value);
    slotsDisplay.innerText = value;
    const price = value * 500;
    priceDisplay.innerText = price.toLocaleString('en-US');
});

// Interactive Accordion FAQ Logic
function toggleFaq(index) {
    const ans = document.getElementById(`faq-ans-${index}`);
    const icon = document.getElementById(`faq-icon-${index}`);
    
    if (ans.classList.contains('hidden')) {
        ans.classList.remove('hidden');
        icon.classList.add('rotate-180');
    } else {
        ans.classList.add('hidden');
        icon.classList.remove('rotate-180');
    }
}
</script>

<?php
include __DIR__ . '/includes/footer.php';
?>
