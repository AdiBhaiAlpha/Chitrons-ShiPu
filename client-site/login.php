<?php
$page_title = 'Sign In - ShiPu AI Client';
require_once __DIR__ . '/includes/db.php';

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Redirect logged in users
if (isset($_SESSION['user_id'])) {
    if ($_SESSION['role'] === 'admin') {
        header("Location: admin.php");
    } else {
        header("Location: dashboard.php");
    }
    exit();
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Phase 10: CSRF Validation
    $csrf_token = $_POST['csrf_token'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrf_token)) {
        $error = 'Security validation failed (CSRF). Please refresh and try again.';
    } else {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        if (empty($username) || empty($password)) {
            $error = 'Both fields are required.';
        } else {
            // Hardcoded Administrator Credentials
            if ($username === 'chitron' && $password === '2448766') {
                session_regenerate_id(true);
                $_SESSION['user_id'] = 'admin_chitron';
                $_SESSION['username'] = 'chitron';
                $_SESSION['role'] = 'admin';
                unset($_SESSION['csrf_token']);
                header("Location: admin.php");
                exit();
            }

            try {
                // Find user in Supabase client_site_users
                $results = DB::select('client_site_users', ['username' => $username]);
                $user = !empty($results) ? $results[0] : null;

                if ($user && password_verify($password, $user['password_hash'])) {
                    // Session Setup with session_regenerate_id(true)
                    session_regenerate_id(true);
                    
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['role'] = $user['role'] ?? 'user';

                    // Ensure CSRF is regenerated
                    unset($_SESSION['csrf_token']);

                    if ($user['role'] === 'admin') {
                        header("Location: admin.php");
                    } else {
                        header("Location: dashboard.php");
                    }
                    exit();
                } else {
                    $error = 'Invalid username or password.';
                }
            } catch (Exception $e) {
                $error = 'Authentication service error: ' . $e->getMessage();
            }
        }
    }
}

// Generate CSRF token if none exists
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

include __DIR__ . '/includes/header.php';
?>

<div class="min-h-[70vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 class="text-center text-3xl font-bold tracking-tight text-[#0f172a]">
            Sign in to your account
        </h2>
        <p class="mt-2 text-center text-sm text-[#64748b]">
            Or
            <a href="register.php" class="font-medium text-emerald-650 hover:text-emerald-500 transition-colors">
                register a new account today
            </a>
        </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow-sm border border-[#e2e8f0] rounded-xl sm:px-10">
            
            <?php if (!empty($error)): ?>
                <div class="mb-4 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-md">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i data-lucide="alert-circle" class="h-5 w-5 text-rose-500"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-rose-700"><?php echo htmlspecialchars($error); ?></p>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <form class="space-y-6" action="login.php" method="POST">
                <!-- CSRF Token -->
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">

                <div>
                    <label for="username" class="block text-sm font-medium text-[#475569]">
                        Username
                    </label>
                    <div class="mt-1">
                        <input id="username" name="username" type="text" autocomplete="username" required 
                               value="<?php echo isset($_POST['username']) ? htmlspecialchars($_POST['username']) : ''; ?>"
                               class="block w-full appearance-none rounded-lg border border-[#cbd5e1] px-3 py-2 placeholder-[#94a3b8] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm transition-all font-sans">
                    </div>
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-[#475569]">
                        Password
                    </label>
                    <div class="mt-1">
                        <input id="password" name="password" type="password" required 
                               class="block w-full appearance-none rounded-lg border border-[#cbd5e1] px-3 py-2 placeholder-[#94a3b8] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm transition-all font-sans">
                    </div>
                </div>

                <div>
                    <button type="submit" 
                            class="flex w-full justify-center rounded-lg border border-transparent bg-emerald-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all font-sans">
                        Sign In
                    </button>
                </div>
            </form>

            <div class="mt-6 border-t border-[#f1f5f9] pt-4">
                <div class="text-[12px] text-[#64748b] text-center">
                    <p class="font-medium">Admin Credentials:</p>
                    <p class="mt-1">Admin: <span class="font-bold text-emerald-700">chitron</span> / Password: <span class="font-bold text-emerald-700">2448766</span></p>
                </div>
            </div>
        </div>
    </div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
