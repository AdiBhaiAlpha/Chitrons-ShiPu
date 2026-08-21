<?php
// Secure Supabase REST-based Database Adapter for ShiPu PHP Client
// Completely replaces SQLite

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

define('SHIPU_ACCESS', true);
define('CONFIG_FILE', __DIR__ . '/../data/config.php');
define('LEGACY_DB_PATH', __DIR__ . '/../data/system.db');

class DB {
    private static $config = null;

    public static function loadConfig() {
        if (self::$config === null) {
            if (file_exists(CONFIG_FILE)) {
                self::$config = include CONFIG_FILE;
            } else {
                self::$config = [
                    'SUPABASE_URL' => '',
                    'SUPABASE_KEY' => '',
                    'SUPABASE_SERVICE_ROLE' => ''
                ];
            }
        }
        return self::$config;
    }

    public static function getSetting($key, $default = null) {
        $cfg = self::loadConfig();
        if (in_array($key, ['SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE'])) {
            return $cfg[$key] ?? $default;
        }
        
        // Otherwise, fetch from client_site_settings table in Supabase
        try {
            if (!empty($cfg['SUPABASE_URL']) && !empty($cfg['SUPABASE_KEY'])) {
                $res = self::select('client_site_settings', ['key' => $key]);
                if (!empty($res)) {
                    return $res[0]['value'];
                }
            }
        } catch (Exception $e) {
            // Fallback or ignore if table doesn't exist yet
        }
        return $default;
    }

    public static function setSetting($key, $value) {
        $cfg = self::loadConfig();
        if (in_array($key, ['SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE'])) {
            $cfg[$key] = $value;
            self::$config = $cfg;
            self::saveLocalConfig($cfg);
            return;
        }

        // Save in Supabase client_site_settings
        self::upsert('client_site_settings', [
            'key' => $key,
            'value' => $value,
            'updated_at' => date('c')
        ], 'key');
    }

    private static function saveLocalConfig($cfg) {
        $dir = dirname(CONFIG_FILE);
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }
        $content = "<?php\n";
        $content .= "if (!defined('SHIPU_ACCESS')) { header('HTTP/1.0 403 Forbidden'); exit('Direct access forbidden.'); }\n";
        $content .= "return " . var_export($cfg, true) . ";\n";
        file_put_contents(CONFIG_FILE, $content);
    }

    public static function request($method, $table, $path = '', $data = null, $extraHeaders = []) {
        $cfg = self::loadConfig();
        $url = $cfg['SUPABASE_URL'] ?? '';
        
        // Use Service Role Key for privileged operations if available, otherwise Anon Key
        $key = !empty($cfg['SUPABASE_SERVICE_ROLE']) ? $cfg['SUPABASE_SERVICE_ROLE'] : ($cfg['SUPABASE_KEY'] ?? '');

        if (empty($url) || empty($key)) {
            throw new Exception("Supabase integration is not fully configured. Please configure Supabase settings in the Admin Panel.");
        }

        $url = rtrim($url, '/');
        $fullUrl = $url . '/rest/v1/' . $table;
        if (!empty($path)) {
            $fullUrl .= '?' . $path;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $fullUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $headers = [
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
            'Content-Type: application/json'
        ];

        foreach ($extraHeaders as $k => $v) {
            $headers[] = "$k: $v";
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("Database Transport Error: " . $error);
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            $errObj = json_decode($response, true);
            $msg = isset($errObj['message']) ? $errObj['message'] : $response;
            throw new Exception("Supabase DB Error (HTTP {$httpCode}): " . $msg);
        }

        return json_decode($response, true);
    }

    // CRUD Abstractions

    public static function select($table, $filters = [], $order = '', $limit = null, $offset = null) {
        $query = [];
        foreach ($filters as $k => $v) {
            if ($v === null) {
                $query[] = $k . '=is.null';
            } else {
                $query[] = $k . '=eq.' . urlencode($v);
            }
        }
        if (!empty($order)) {
            $query[] = 'order=' . urlencode($order);
        }
        if ($limit !== null) {
            $query[] = 'limit=' . intval($limit);
        }
        if ($offset !== null) {
            $query[] = 'offset=' . intval($offset);
        }

        $path = implode('&', $query);
        return self::request('GET', $table, $path);
    }

    public static function insert($table, $data) {
        return self::request('POST', $table, '', $data, ['Prefer' => 'return=representation']);
    }

    public static function update($table, $data, $filters = []) {
        $query = [];
        foreach ($filters as $k => $v) {
            $query[] = $k . '=eq.' . urlencode($v);
        }
        $path = implode('&', $query);
        return self::request('PATCH', $table, $path, $data, ['Prefer' => 'return=representation']);
    }

    public static function upsert($table, $data, $onConflictColumn = '') {
        $headers = ['Prefer' => 'resolution=merge-duplicates,return=representation'];
        if (!empty($onConflictColumn)) {
            $headers['On-Conflict'] = $onConflictColumn;
        }
        return self::request('POST', $table, '', $data, $headers);
    }

    public static function delete($table, $filters = []) {
        $query = [];
        foreach ($filters as $k => $v) {
            $query[] = $k . '=eq.' . urlencode($v);
        }
        $path = implode('&', $query);
        return self::request('DELETE', $table, $path);
    }

    public static function count($table, $filters = []) {
        $query = [];
        foreach ($filters as $k => $v) {
            $query[] = $k . '=eq.' . urlencode($v);
        }
        $query[] = 'select=count';
        $path = implode('&', $query);
        $res = self::request('GET', $table, $path, null, ['Prefer' => 'count=exact']);
        return isset($res[0]['count']) ? intval($res[0]['count']) : 0;
    }

    // SQLite to Supabase Migration Tool
    public static function runMigration() {
        if (!file_exists(LEGACY_DB_PATH)) {
            return ['success' => true, 'message' => 'No legacy SQLite database found.'];
        }

        try {
            $lite = new PDO('sqlite:' . LEGACY_DB_PATH);
            $lite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $lite->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

            // Fetch users
            $users = $lite->query("SELECT * FROM users")->fetchAll();
            $userMap = []; // old_id => new_uuid

            foreach ($users as $u) {
                // Check if user exists in Supabase
                $existing = self::select('client_site_users', ['username' => $u['username']]);
                if (!empty($existing)) {
                    $userMap[$u['id']] = $existing[0]['id'];
                } else {
                    // Create new
                    $created = self::insert('client_site_users', [
                        'username' => $u['username'],
                        'password_hash' => $u['password'],
                        'role' => $u['role'],
                        'created_at' => $u['created_at']
                    ]);
                    if (!empty($created)) {
                        $userMap[$u['id']] = $created[0]['id'];
                    }
                }
            }

            // Fetch payments
            $payments = $lite->query("SELECT * FROM payment_requests")->fetchAll();
            foreach ($payments as $p) {
                $supabaseUserId = $userMap[$p['user_id']] ?? null;
                if (!$supabaseUserId) continue;

                // Check if transaction_id exists
                $existingPay = self::select('client_site_payments', ['transaction_id' => $p['transaction_id']]);
                if (empty($existingPay)) {
                    self::insert('client_site_payments', [
                        'user_id' => $supabaseUserId,
                        'amount' => intval($p['amount']),
                        'slots_requested' => intval($p['slots_requested']),
                        'payment_method' => $p['payment_method'],
                        'transaction_id' => $p['transaction_id'],
                        'status' => $p['status'],
                        'created_at' => $p['created_at'],
                        'updated_at' => $p['updated_at']
                    ]);
                }
            }

            // Fetch slots
            $slots = $lite->query("SELECT * FROM slots")->fetchAll();
            foreach ($slots as $s) {
                $supabaseUserId = $userMap[$s['user_id']] ?? null;
                if (!$supabaseUserId) continue;

                // Check if already matches
                $existingSlots = self::select('client_site_slots', [
                    'user_id' => $supabaseUserId,
                    'bot_id' => $s['bot_id']
                ]);
                if (empty($existingSlots)) {
                    self::insert('client_site_slots', [
                        'user_id' => $supabaseUserId,
                        'bot_id' => $s['bot_id'],
                        'status' => $s['status'],
                        'created_at' => $s['created_at'],
                        'updated_at' => $s['created_at']
                    ]);
                }
            }

            // Fetch settings
            $settings = $lite->query("SELECT * FROM settings")->fetchAll();
            foreach ($settings as $se) {
                if (in_array($se['key'], ['SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE'])) {
                    // Update local file config
                    self::setSetting($se['key'], $se['value']);
                } else {
                    self::upsert('client_site_settings', [
                        'key' => $se['key'],
                        'value' => $se['value'],
                        'updated_at' => date('c')
                    ], 'key');
                }
            }

            // Rename SQLite file to prevent running migration again
            rename(LEGACY_DB_PATH, LEGACY_DB_PATH . '.bak');

            return ['success' => true, 'message' => 'Legacy database migrated successfully. ' . count($users) . ' users, ' . count($slots) . ' slots and ' . count($payments) . ' payments transitioned to Supabase.'];
        } catch (Exception $e) {
            return ['success' => false, 'error' => 'Migration failed: ' . $e->getMessage()];
        }
    }
}
