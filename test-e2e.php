<?php
session_start();
$userId = 'b0a80121-0000-1000-8000-00805f9b34fb'; // UUID
$_SESSION['user_id'] = $userId;
$_SESSION['username'] = 'testuser';
$_SESSION['role'] = 'user';

require_once __DIR__ . '/client-site/includes/db.php';

$slotId = 'c0a80121-0000-1000-8000-00805f9b34fb'; // UUID

// Insert a slot
DB::insert('client_site_slots', [
    'id' => $slotId,
    'user_id' => $userId,
    'bot_id' => null,
    'status' => 'empty'
]);

// Prepare POST data
$cookie = '[{"domain":".facebook.com","name":"c_user","value":"1000123456789","path":"/","secure":true,"session":false},{"domain":".facebook.com","name":"xs","value":"dummy_xs","path":"/","secure":true,"session":false}]';
$payload = json_encode([
    'slot_id' => $slotId,
    'bot_id' => 'e2e_test_bot_' . time(),
    'cookie' => $cookie
]);

$_SERVER['REQUEST_METHOD'] = 'POST';
$_GET['action'] = 'submit_bot_cookie';

// Mock php://input
stream_wrapper_unregister("php");
class MockPhpStream {
    private $position = 0;
    private $data;
    public function stream_open($path, $mode, $options, &$opened_path) {
        $this->data = $GLOBALS['MOCK_POST_DATA'];
        return true;
    }
    public function stream_read($count) {
        $ret = substr($this->data, $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }
    public function stream_eof() { return $this->position >= strlen($this->data); }
    public function stream_stat() { return []; }
}
stream_wrapper_register("php", "MockPhpStream");
$GLOBALS['MOCK_POST_DATA'] = $payload;

ob_start();
require __DIR__ . '/client-site/api.php';
$out = ob_get_clean();
echo "API Response:\n" . $out . "\n";
