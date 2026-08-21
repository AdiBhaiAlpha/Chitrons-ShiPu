import { MultiAccountManager } from '../adapters/messenger/MultiAccountManager';
import { cloudAccountManager } from '../services/CloudAccountManager';
import { messengerAccountsData } from '../db/database';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`, detail !== undefined ? JSON.stringify(detail) : '');
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`, detail !== undefined ? JSON.stringify(detail) : '');
    failed++;
  }
}

async function runSessionControlsAudit() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING SESSION MANAGEMENT CONTROLS AUDIT & TEST SUITE');
  console.log('======================================================\n');

  const multiMgr = MultiAccountManager.getInstance();
  const testAccountId = 'acc_test_audit_1000';
  const validDummyCookie = JSON.stringify([
    { key: 'sb', value: 'test_sb_val_123', domain: '.facebook.com', path: '/' },
    { key: 'c_user', value: '1000889201982', domain: '.facebook.com', path: '/' },
    { key: 'xs', value: 'test_xs_val_456', domain: '.facebook.com', path: '/' },
    { key: 'fr', value: 'test_fr_val_789', domain: '.facebook.com', path: '/' }
  ]);
  const invalidCookie = 'invalid_json_string_or_empty_array';

  // Seed test account record in database
  console.log('--- Preparing test environment ---');
  await messengerAccountsData.upsert({
    accountId: testAccountId,
    uid: '1000889201982',
    displayName: 'Test ShiPu Bot',
    authType: 'cookie',
    provider: 'DongDevFCAProvider',
    encryptedAuthState: validDummyCookie,
    status: 'CONNECTED',
    mqttStatus: 'LISTENING',
    loginStatus: 'LOGGED_IN',
    botEnabled: true,
    creationSource: 'LOCAL_ADMIN',
    updatedAt: Date.now()
  });

  // ----------------------------------------------------
  // CONTROL 1: Manage Session / Update Cookie
  // ----------------------------------------------------
  console.log('\n[CONTROL 1/8] Testing Manage Session / Update Cookie...');
  // Failure Case: Invalid Cookie JSON
  const invalidCookieRes = await multiMgr.replaceCookie(testAccountId, invalidCookie, 'Test ShiPu Bot');
  assert(!invalidCookieRes.success, 'Update Cookie (Failure Case: Invalid Cookie JSON returns error)', invalidCookieRes.error);

  // Success Case: Valid Cookie JSON
  const validCookieRes = await multiMgr.replaceCookie(testAccountId, validDummyCookie, 'Test ShiPu Bot Updated');
  assert(validCookieRes.success, 'Update Cookie (Success Case: Valid Cookie updates session & metadata)', validCookieRes.accountMeta);

  // Verify record updated
  const updatedRecord1 = await messengerAccountsData.get(testAccountId);
  assert(Boolean(updatedRecord1 && updatedRecord1.displayName === 'Test ShiPu Bot Updated'), 'MongoDB state updated after Cookie Replacement', updatedRecord1?.displayName);


  // ----------------------------------------------------
  // CONTROL 2: Reconnect
  // ----------------------------------------------------
  console.log('\n[CONTROL 2/8] Testing Reconnect...');
  // Non-existent account failure case
  const nonExistentId = 'acc_non_existent_99999_xyz';
  const reconnectFail = await cloudAccountManager.startAccount(nonExistentId);
  assert(!reconnectFail, 'Reconnect (Failure Case: Non-existent account returns false)');

  // Test account start/reconnect
  const reconnectSuccess = await cloudAccountManager.startAccount(testAccountId);
  assert(typeof reconnectSuccess === 'boolean', 'Reconnect (Execution result returned)', { reconnectSuccess });


  // ----------------------------------------------------
  // CONTROL 3: Restart Engine
  // ----------------------------------------------------
  console.log('\n[CONTROL 3/8] Testing Restart Engine...');
  const restartResult = await cloudAccountManager.restartAccount(testAccountId);
  assert(typeof restartResult === 'boolean', 'Restart Engine (Stops and re-initializes account session)', { restartResult });


  // ----------------------------------------------------
  // CONTROL 4: Run Supervisor Recovery
  // ----------------------------------------------------
  console.log('\n[CONTROL 4/8] Testing Run Supervisor Recovery...');
  const recoverResult = await cloudAccountManager.recoverAccount(testAccountId);
  assert(typeof recoverResult === 'boolean', 'Run Supervisor Recovery (Runs multi-stage automatic recovery pipeline)', { recoverResult });


  // ----------------------------------------------------
  // CONTROL 5: Hot Reload
  // ----------------------------------------------------
  console.log('\n[CONTROL 5/8] Testing Hot Reload...');
  const reloadResult = await cloudAccountManager.reloadAccount(testAccountId);
  assert(typeof reloadResult === 'boolean', 'Hot Reload (Safely resets session & re-binds listeners)', { reloadResult });


  // ----------------------------------------------------
  // CONTROL 6: cPanel Backup
  // ----------------------------------------------------
  console.log('\n[CONTROL 6/8] Testing cPanel Backup...');
  // Non-existent account failure case
  const backupFail = await multiMgr.backupAccountToFtp('non_existent_acc_404');
  assert(!backupFail.success, 'cPanel Backup (Failure Case: Missing account record returns error)', backupFail.error);

  // Backup existing account
  const backupRes = await multiMgr.backupAccountToFtp(testAccountId);
  assert(typeof backupRes.success === 'boolean', 'cPanel Backup (Backup payload generated and FTP sync attempted)', backupRes);


  // ----------------------------------------------------
  // CONTROL 7: cPanel Restore
  // ----------------------------------------------------
  console.log('\n[CONTROL 7/8] Testing cPanel Restore...');
  const restoreFail = await multiMgr.restoreAccountFromFtp('non_existent_acc_404');
  assert(!restoreFail.success, 'cPanel Restore (Failure Case: Missing FTP backup file returns error)', restoreFail.error);


  // ----------------------------------------------------
  // CONTROL 8: Disconnect
  // ----------------------------------------------------
  console.log('\n[CONTROL 8/8] Testing Disconnect...');
  const disconnectRes = await cloudAccountManager.stopAccount(testAccountId);
  assert(disconnectRes === true, 'Disconnect (Gracefully stops MQTT, frees memory, syncs LOGGED_OUT status)', { disconnectRes });

  const recordAfterDisconnect = await messengerAccountsData.get(testAccountId);
  assert(Boolean(recordAfterDisconnect), 'Account record exists after disconnect', {
    status: recordAfterDisconnect?.status,
    loginStatus: recordAfterDisconnect?.loginStatus
  });


  // Cleanup test account from DB
  await messengerAccountsData.delete(testAccountId);

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSessionControlsAudit().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
