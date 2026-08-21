<?php
$page_title = 'Create Account - ShiPu AI Client';
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
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // CSRF Validation
    $csrf_token = $_POST['csrf_token'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrf_token)) {
        $error = 'Security validation failed (CSRF). Please refresh and try again.';
    } else {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $confirm_password = $_POST['confirm_password'] ?? '';

        if (empty($username) || empty($password) || empty($confirm_password)) {
            $error = 'All fields are required.';
        } elseif (strlen($username) < 3 || strlen($username) > 30) {
            $error = 'Username must be between 3 and 30 characters.';
        } elseif (!preg_match('/^[a-zA-Z0-9_.-]+$/', $username)) {
            $error = 'Username can only contain alphanumeric characters, underscores, dashes, and periods.';
        } elseif (strlen($password) < 6) {
            $error = 'Password must be at least 6 characters.';
        } elseif ($password !== $confirm_password) {
            $error = 'Passwords do not match.';
        } else {
            try {
                // Check if username already exists in Supabase
                $existing = DB::select('client_site_users', ['username' => $username]);
                if (!empty($existing)) {
                    $error = 'Username is already taken.';
                } else {
                    // Insert User (Default role is 'user')
                    $password_hash = password_hash($password, PASSWORD_BCRYPT);
                    DB::insert('client_site_users', [
                        'username' => $username,
                        'password_hash' => $password_hash,
                        'role' => 'user'
                    ]);
                    
                    $success = 'Account created successfully! You can now sign in.';
                }
            } catch (Exception $e) {
                $error = 'Database error: ' . $e->getMessage();
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
            Create a new account
        </h2>
        <p class="mt-2 text-center text-sm text-[#64748b]">
            Or
            <a href="login.php" class="font-medium text-emerald-650 hover:text-emerald-500 transition-colors">
                sign in to your existing account
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

            <?php if (!empty($success)): ?>
                <div class="mb-4 bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-md">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i data-lucide="check-circle" class="h-5 w-5 text-emerald-500"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-emerald-700"><?php echo htmlspecialchars($success); ?></p>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <form class="space-y-6" action="register.php" method="POST">
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
                    <label for="confirm_password" class="block text-sm font-medium text-[#475569]">
                        Confirm Password
                    </label>
                    <div class="mt-1">
                        <input id="confirm_password" name="confirm_password" type="password" required 
                               class="block w-full appearance-none rounded-lg border border-[#cbd5e1] px-3 py-2 placeholder-[#94a3b8] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm transition-all font-sans">
                    </div>
                </div>

                <div>
                    <button type="submit" 
                            class="flex w-full justify-center rounded-lg border border-transparent bg-emerald-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all font-sans">
                        Register
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
