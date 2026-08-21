<?php
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/supabase.php';

$is_logged_in = isset($_SESSION['user_id']);
$user_id = $_SESSION['user_id'] ?? null;
$username = $_SESSION['username'] ?? '';
$user_role = $_SESSION['role'] ?? 'user';
$is_admin = ($user_role === 'admin');

// Page Title Helper
$page_title = $page_title ?? 'ShiPu AI Client';
?>
<!DOCTYPE html>
<html lang="en" class="h-full bg-[#f8fafc]">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($page_title); ?></title>
    
    <!-- Meta SEO Tags -->
    <meta name="description" content="Manage your ShiPu AI client bots, slots, and runtimes cleanly.">
    <meta name="robots" content="noindex, nofollow">
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                    },
                }
            }
        }
    </script>
    <style type="text/css">
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    </style>
</head>
<body class="h-full flex flex-col text-[#1e293b]">

<!-- Navigation Bar -->
<header class="bg-white border-b border-[#e2e8f0] sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
            <div class="flex items-center space-x-3">
                <a href="index.php" class="flex-shrink-0 flex items-center hover:opacity-90 transition-opacity">
                    <span class="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">
                        ShiPu AI
                    </span>
                    <span class="ml-2 px-2 py-0.5 text-[10px] font-semibold bg-[#f1f5f9] text-[#475569] rounded-full border border-[#e2e8f0]">
                        PHP Client
                    </span>
                </a>
                
                <?php if (isset($is_public_landing) && $is_public_landing): ?>
                    <!-- Public SaaS Links -->
                    <nav class="hidden md:ml-10 md:flex md:space-x-8">
                        <a href="#features" class="text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors">Features</a>
                        <a href="#how-it-works" class="text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors">How It Works</a>
                        <a href="#pricing" class="text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors">Pricing</a>
                        <a href="#faq" class="text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors">FAQ</a>
                    </nav>
                <?php elseif ($is_logged_in): ?>
                    <nav class="hidden md:ml-6 md:flex md:space-x-4">
                        <?php if ($is_admin): ?>
                            <a href="admin.php" class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors <?php echo basename($_SERVER['PHP_SELF']) == 'admin.php' ? 'text-emerald-700 bg-emerald-50/50' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'; ?>">
                                <i data-lucide="shield" class="w-4 h-4 mr-1.5 text-emerald-600"></i>
                                Admin Dashboard
                            </a>
                        <?php else: ?>
                            <a href="dashboard.php" class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors <?php echo basename($_SERVER['PHP_SELF']) == 'dashboard.php' ? 'text-emerald-700 bg-emerald-50/50' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'; ?>">
                                <i data-lucide="layout-dashboard" class="w-4 h-4 mr-1.5 text-emerald-600"></i>
                                My Dashboard
                            </a>
                        <?php endif; ?>
                    </nav>
                <?php endif; ?>
            </div>

            <div class="flex items-center space-x-4">
                <?php if ($is_logged_in): ?>
                    <div class="flex items-center space-x-3">
                        <div class="hidden sm:flex flex-col text-right">
                            <span class="text-sm font-semibold text-[#0f172a]"><?php echo htmlspecialchars($username); ?></span>
                            <span class="text-[11px] text-[#64748b] capitalize"><?php echo htmlspecialchars($user_role); ?> Account</span>
                        </div>
                        <div class="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            <?php echo strtoupper(substr($username, 0, 1)); ?>
                        </div>
                        <?php if (isset($is_public_landing) && $is_public_landing): ?>
                            <a href="<?php echo $is_admin ? 'admin.php' : 'dashboard.php'; ?>" class="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors">
                                Dashboard
                            </a>
                        <?php endif; ?>
                        <a href="logout.php" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors" title="Logout">
                            <i data-lucide="log-out" class="w-4 h-4 md:mr-1"></i>
                            <span class="hidden md:inline">Logout</span>
                        </a>
                    </div>
                <?php else: ?>
                    <div class="flex items-center space-x-3">
                        <a href="login.php" class="text-sm font-semibold text-[#475569] hover:text-[#0f172a] px-3 py-2 transition-colors">
                            Sign In
                        </a>
                        <a href="register.php" class="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors">
                            Get Started
                        </a>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</header>

<?php if (isset($is_public_landing) && $is_public_landing): ?>
<main class="flex-grow">
<?php else: ?>
<main class="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
<?php endif; ?>
