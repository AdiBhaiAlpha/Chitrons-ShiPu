<?php
// Secure Server-side Supabase REST API client for PHP Client

require_once __DIR__ . '/db.php';

class Supabase {
    private static function request($method, $path, $data = null, $extraHeaders = []) {
        $url = DB::getSetting('SUPABASE_URL');
        $key = DB::getSetting('SUPABASE_KEY');

        if (!$url || !$key) {
            throw new Exception("Supabase integration is not configured. Please contact the Administrator to set it up.");
        }

        // Clean trailing slash
        $url = rtrim($url, '/');
        $fullUrl = $url . '/rest/v1/' . ltrim($path, '/');

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $fullUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        
        // Disable SSL verify only if needed, but default to true for production safety
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
            throw new Exception("Transport Error: " . $error);
        }

        // 2xx Codes are successes
        if ($httpCode < 200 || $httpCode >= 300) {
            $errObj = json_decode($response, true);
            $msg = isset($errObj['message']) ? $errObj['message'] : $response;
            throw new Exception("Supabase Error (HTTP {$httpCode}): " . $msg);
        }

        return json_decode($response, true);
    }

    // Sessions management
    public static function getSessions($filters = []) {
        $query = [];
        foreach ($filters as $k => $v) {
            $query[] = $k . '=eq.' . urlencode($v);
        }
        $path = 'client_bot_sessions?select=*&order=created_at.desc';
        if (!empty($query)) {
            $path .= '&' . implode('&', $query);
        }
        return self::request('GET', $path);
    }

    public static function getSessionByBotId($botId) {
        $sessions = self::getSessions(['bot_id' => $botId]);
        return !empty($sessions) ? $sessions[0] : null;
    }

    public static function insertSession($botId, $slotId, $userId, $cookie, $connectionMode = 'default') {
        $data = [
            'bot_id' => $botId,
            'slot_id' => (string)$slotId,
            'user_id' => (string)$userId,
            'cookie' => $cookie,
            'owner' => 'Client Bot',
            'status' => 'pending',
            'connection_mode' => $connectionMode,
            'version' => 1
        ];
        return self::request('POST', 'client_bot_sessions', $data, ['Prefer' => 'return=representation']);
    }

    public static function updateSessionCookie($botId, $cookie) {
        // Fetch current session to increment version
        $session = self::getSessionByBotId($botId);
        $nextVersion = $session ? (($session['version'] ?? 1) + 1) : 1;

        $data = [
            'cookie' => $cookie,
            'status' => 'pending', // Reset status to pending so the server picks up the cookie reload
            'version' => $nextVersion,
            'updated_at' => date('c')
        ];
        return self::request('PATCH', "client_bot_sessions?bot_id=eq." . urlencode($botId), $data, ['Prefer' => 'return=representation']);
    }

    public static function deleteSession($botId) {
        return self::request('DELETE', "client_bot_sessions?bot_id=eq." . urlencode($botId));
    }

    // Queue commands
    public static function queueAction($botId, $slotId, $userId, $sessionId, $action) {
        $data = [
            'bot_id' => $botId,
            'slot_id' => (string)$slotId,
            'user_id' => (string)$userId,
            'session_id' => $sessionId,
            'action' => strtoupper($action),
            'status' => 'pending'
        ];
        return self::request('POST', 'client_bot_queue', $data, ['Prefer' => 'return=representation']);
    }

    // Diagnostics fetching
    public static function getMetrics($botId) {
        $res = self::request('GET', "client_bot_metrics?bot_id=eq." . urlencode($botId) . "&select=*");
        return !empty($res) ? $res[0] : null;
    }

    public static function getRuntime($botId) {
        $res = self::request('GET', "client_bot_runtime?bot_id=eq." . urlencode($botId) . "&select=*");
        return !empty($res) ? $res[0] : null;
    }

    public static function getLogs($botId, $limit = 50) {
        return self::request('GET', "client_bot_logs?bot_id=eq." . urlencode($botId) . "&select=*&order=created_at.desc&limit=" . $limit);
    }

    public static function getErrors($botId, $limit = 10) {
        return self::request('GET', "client_bot_errors?bot_id=eq." . urlencode($botId) . "&select=*&order=created_at.desc&limit=" . $limit);
    }
}
