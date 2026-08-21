<?php
// API Gateway for ShiPu AI PHP Client - Completely SQLite-Free

header('Content-Type: application/json');

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/supabase.php';

// Authentication Guard
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized access. Please sign in again.']);
    exit();
}

$user_id = $_SESSION['user_id'];
$username = $_SESSION['username'];
$user_role = $_SESSION['role'];
$is_admin = ($user_role === 'admin');

$action = $_GET['action'] ?? '';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Post Requests
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true) ?? $_POST;

        if ($action === 'purchase_slots') {
            $slots = intval($input['slots_requested'] ?? 0);
            $payment_method = trim($input['payment_method'] ?? '');
            $transaction_id = trim($input['transaction_id'] ?? '');

            if ($slots <= 0) {
                throw new Exception('Please specify a valid number of slots (minimum 1).');
            }
            if (empty($payment_method) || empty($transaction_id)) {
                throw new Exception('Payment method and Transaction ID are required.');
            }

            $amount = $slots * 500;

            // Save request in Supabase client_site_payments
            DB::insert('client_site_payments', [
                'user_id' => $user_id,
                'amount' => $amount,
                'slots_requested' => $slots,
                'payment_method' => $payment_method,
                'transaction_id' => $transaction_id,
                'status' => 'pending',
                'created_at' => date('c'),
                'updated_at' => date('c')
            ]);

            echo json_encode(['success' => true, 'message' => "Payment request of {$amount} BDT for {$slots} slots submitted successfully! It is pending administrator approval."]);
            exit();
        }

        if ($action === 'submit_bot_cookie') {
            $slot_id = trim($input['slot_id'] ?? '');
            $bot_id = trim($input['bot_id'] ?? '');
            $cookie_raw = trim($input['cookie'] ?? '');
            $connection_mode = trim($input['connection_mode'] ?? 'default');

            if (empty($slot_id) || empty($bot_id) || empty($cookie_raw)) {
                throw new Exception('All fields (Slot ID, Bot ID, and Cookies) are required.');
            }

            // Validate cookie is JSON
            $cookie_parsed = json_decode($cookie_raw, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($cookie_parsed) || (isset($cookie_parsed[0]) === false && count($cookie_parsed) > 0)) {
                throw new Exception('Invalid cookie format. Cookie must be a valid JSON array string.');
            }

            // Ensure slot belongs to user
            $slotQuery = DB::select('client_site_slots', ['id' => $slot_id, 'user_id' => $user_id]);
            if (empty($slotQuery)) {
                throw new Exception('Specified slot not found or access denied.');
            }
            $slot = $slotQuery[0];

            // Verify Supabase is configured
            if (!DB::getSetting('SUPABASE_URL') || !DB::getSetting('SUPABASE_KEY')) {
                throw new Exception('Supabase integration is not fully configured yet. Please ask the administrator to configure Supabase Settings.');
            }

            // Double check if bot_id is already registered in Supabase
            $existing = Supabase::getSessionByBotId($bot_id);
            if ($existing) {
                if ($existing['user_id'] != $user_id) {
                    throw new Exception("Bot ID '{$bot_id}' is already registered by another user.");
                }
                
                // Perform cookie update
                Supabase::updateSessionCookie($bot_id, $cookie_raw);
                $msg = "Bot account cookies updated successfully.";
            } else {
                // Insert brand new session on Supabase
                Supabase::insertSession($bot_id, $slot_id, $user_id, $cookie_raw, $connection_mode);
                $msg = "Bot credentials submitted successfully to Supabase. Launching startup pipeline...";
            }

            // Save/Update local slot status in Supabase
            DB::update('client_site_slots', [
                'bot_id' => $bot_id,
                'status' => 'active',
                'updated_at' => date('c')
            ], ['id' => $slot_id]);

            echo json_encode(['success' => true, 'message' => $msg]);
            exit();
        }

        if ($action === 'queue_command') {
            $bot_id = trim($input['bot_id'] ?? '');
            $cmd_action = trim($input['cmd_action'] ?? '');

            if (empty($bot_id) || empty($cmd_action)) {
                throw new Exception('Bot ID and command action are required.');
            }

            // Verify slot ownership
            if (!$is_admin) {
                $count = DB::count('client_site_slots', ['bot_id' => $bot_id, 'user_id' => $user_id]);
                if ($count === 0) {
                    throw new Exception('Access denied. You do not own this bot connection.');
                }
            }

            // Get session from Supabase
            $session = Supabase::getSessionByBotId($bot_id);
            if (!$session) {
                throw new Exception('Active session not found in Supabase.');
            }

            // Push to Queue
            Supabase::queueAction($bot_id, $session['slot_id'], $session['user_id'], $session['id'], $cmd_action);

            if ($cmd_action === 'LOGOUT' || $cmd_action === 'DELETE') {
                // Reset slot
                DB::update('client_site_slots', [
                    'bot_id' => null,
                    'status' => 'empty',
                    'updated_at' => date('c')
                ], ['bot_id' => $bot_id]);

                // Also delete session on Supabase
                Supabase::deleteSession($bot_id);
            }

            echo json_encode(['success' => true, 'message' => "Command '" . strtoupper($cmd_action) . "' queued successfully! The server will process it shortly."]);
            exit();
        }

        if ($is_admin && $action === 'update_supabase_settings') {
            $url = trim($input['supabase_url'] ?? '');
            $key = trim($input['supabase_key'] ?? '');
            $service_role = trim($input['supabase_service_role'] ?? '');

            if (empty($url) || empty($key) || empty($service_role)) {
                throw new Exception('Supabase URL, Anon Key, and Service Role Key are required.');
            }

            DB::setSetting('SUPABASE_URL', $url);
            DB::setSetting('SUPABASE_KEY', $key);
            DB::setSetting('SUPABASE_SERVICE_ROLE', $service_role);

            // Run migration if any local SQLite db exists
            $mig = DB::runMigration();

            $msg = 'Supabase credentials saved successfully. System is now fully synced!';
            if (isset($mig['success']) && $mig['success'] && strpos($mig['message'], 'No legacy') === false) {
                $msg .= ' ' . $mig['message'];
            }

            echo json_encode(['success' => true, 'message' => $msg]);
            exit();
        }

        if ($is_admin && $action === 'handle_payment') {
            $request_id = trim($input['request_id'] ?? '');
            $payment_status = trim($input['status'] ?? ''); // 'approved' or 'declined'

            if (empty($request_id) || !in_array($payment_status, ['approved', 'declined'])) {
                throw new Exception('Invalid parameters provided.');
            }

            // Fetch payment details
            $paymentQuery = DB::select('client_site_payments', ['id' => $request_id]);
            if (empty($paymentQuery)) {
                throw new Exception('Payment request not found.');
            }
            $payment = $paymentQuery[0];

            if ($payment['status'] !== 'pending') {
                throw new Exception('This payment request has already been processed.');
            }

            // Update request
            DB::update('client_site_payments', [
                'status' => $payment_status,
                'updated_at' => date('c')
            ], ['id' => $request_id]);

            // If approved, create slots for the user in Supabase
            if ($payment_status === 'approved') {
                $slots_count = intval($payment['slots_requested']);
                for ($i = 0; $i < $slots_count; $i++) {
                    DB::insert('client_site_slots', [
                        'user_id' => $payment['user_id'],
                        'bot_id' => null,
                        'status' => 'empty',
                        'created_at' => date('c'),
                        'updated_at' => date('c')
                    ]);
                }
            }

            echo json_encode(['success' => true, 'message' => "Payment request " . ucfirst($payment_status) . " successfully."]);
            exit();
        }
        
        if ($is_admin && $action === 'delete_user') {
            $target_user_id = trim($input['user_id'] ?? '');
            if (empty($target_user_id)) {
                throw new Exception('Invalid user ID.');
            }
            if ($target_user_id == $user_id) {
                throw new Exception('You cannot delete your own admin account.');
            }

            // Find any active bots for this user and clean them up from Supabase
            $bots = DB::select('client_site_slots', ['user_id' => $target_user_id]);
            foreach ($bots as $bot) {
                if (!empty($bot['bot_id'])) {
                    try {
                        Supabase::deleteSession($bot['bot_id']);
                    } catch (Exception $e) {}
                }
            }

            // Delete cascading elements
            DB::delete('client_site_slots', ['user_id' => $target_user_id]);
            DB::delete('client_site_payments', ['user_id' => $target_user_id]);
            DB::delete('client_site_users', ['id' => $target_user_id]);

            echo json_encode(['success' => true, 'message' => 'User and associated slots/bots purged successfully from Supabase.']);
            exit();
        }

        throw new Exception('Action not implemented.');
    } else {
        // GET Requests
        if ($action === 'poll_bot_status') {
            $bot_id = trim($_GET['bot_id'] ?? '');
            if (empty($bot_id)) {
                throw new Exception('Bot ID is required.');
            }

            // Verification
            if (!$is_admin) {
                $count = DB::count('client_site_slots', ['bot_id' => $bot_id, 'user_id' => $user_id]);
                if ($count === 0) {
                    throw new Exception('Access denied.');
                }
            }

            // Fetch info from Supabase
            $session = Supabase::getSessionByBotId($bot_id);
            if (!$session) {
                echo json_encode([
                    'success' => true,
                    'is_online' => false,
                    'session' => null,
                    'metrics' => null,
                    'runtime' => null,
                    'logs' => [],
                    'errors' => []
                ]);
                exit();
            }

            $metrics = Supabase::getMetrics($bot_id);
            $runtime = Supabase::getRuntime($bot_id);
            $logs = Supabase::getLogs($bot_id, 15);
            $errors = Supabase::getErrors($bot_id, 5);

            echo json_encode([
                'success' => true,
                'is_online' => true,
                'session' => $session,
                'metrics' => $metrics,
                'runtime' => $runtime,
                'logs' => $logs,
                'errors' => $errors
            ]);
            exit();
        }

        throw new Exception('Method not allowed.');
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}
