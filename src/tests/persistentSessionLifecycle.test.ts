import { AccountConnection } from '../adapters/messenger/AccountConnection';
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

async function runPersistentSessionLifecycleTest() {
  console.log('\n=================================================================');
  console.log('🧪 RUNNING MESSENGER PERSISTENT SESSION & LIFECYCLE VERIFICATION');
  console.log('=================================================================\n');

  const testAccountId = 'acc_test_persistent_session_9000';
  const testUid = '1000889201982';
  const validDummyCookie = JSON.stringify([
    { key: 'sb', value: 'persistent_sb_123', domain: '.facebook.com', path: '/' },
    { key: 'c_user', value: testUid, domain: '.facebook.com', path: '/' },
    { key: 'xs', value: 'persistent_xs_456', domain: '.facebook.com', path: '/' },
    { key: 'fr', value: 'persistent_fr_789', domain: '.facebook.com', path: '/' }
  ]);

  const mockRecord: any = {
    accountId: testAccountId,
    uid: testUid,
    displayName: 'Test Persistent Bot',
    authType: 'cookie',
    provider: 'DongDev FCA',
    encryptedAuthState: validDummyCookie,
    status: 'CONNECTED',
    mqttStatus: 'LISTENING',
    loginStatus: 'LOGGED_IN',
    botEnabled: true,
    enabled: true,
    creationSource: 'LOCAL_ADMIN',
    updatedAt: Date.now()
  };

  await messengerAccountsData.upsert(mockRecord);

  const conn = new AccountConnection(mockRecord);
  
  // Track login attempts by mocking fallbackManager
  let loginCount = 0;
  (conn as any).fallbackManager = {
    authenticate: async () => {
      loginCount++;
      const mockApi = {
        getCurrentUserID: () => testUid,
        listenMqtt: (cb: Function) => {
          setTimeout(() => {
            cb(null, { type: 'message', body: 'hello', threadID: '123', senderID: '999' });
          }, 50);
          return () => {};
        },
        sendMessage: async () => {}
      };
      return {
        connection: {
          providerName: 'MockFCA',
          api: mockApi,
          botUserId: testUid,
          listen: async () => () => {},
          disconnect: async () => {},
          logout: async () => {}
        },
        activeProviderName: 'MockFCA',
        isHardFailure: false
      };
    }
  };

  MultiAccountManager.getInstance().addAccountConnection(testAccountId, conn);

  // ----------------------------------------------------
  // TEST 1: First-time authentication runs ONCE
  // ----------------------------------------------------
  console.log('\n[TEST 1] First-time authentication...');
  const firstConnectResult = await conn.connect();
  assert(firstConnectResult === true, 'First connect succeeds');
  assert(loginCount === 1, 'Authenticate executed exactly ONCE on initial connect', { loginCount });
  assert(conn.sessionState.authenticated === true, 'Session state marked authenticated');

  // ----------------------------------------------------
  // TEST 2: Re-connecting or starting account REUSES existing FCA instance (0 additional logins)
  // ----------------------------------------------------
  console.log('\n[TEST 2] Subsequent connect() call reusing existing session...');
  const secondConnectResult = await conn.connect();
  assert(secondConnectResult === true, 'Second connect succeeds');
  assert(loginCount === 1, 'Authenticate was NOT executed again (loginCount remains 1)', { loginCount });

  console.log('\n[TEST 3] CloudAccountManager.startAccount() reusing existing session...');
  const cloudStartResult = await cloudAccountManager.startAccount(testAccountId, mockRecord);
  assert(cloudStartResult === true, 'CloudAccountManager.startAccount succeeds');
  assert(loginCount === 1, 'CloudAccountManager reused session without re-login (loginCount remains 1)', { loginCount });

  // ----------------------------------------------------
  // TEST 4: Forced MQTT Disconnect & Reconnect reuses FCA instance
  // ----------------------------------------------------
  console.log('\n[TEST 4] Simulating MQTT drop and reconnection...');
  (conn as any).mqttStatus = 'DISCONNECTED';
  (conn as any).status = 'TEMPORARY_ERROR';
  
  const recoveryResult = await cloudAccountManager.recoverAccount(testAccountId);
  assert(recoveryResult === true, 'Supervisor recovery succeeds');
  assert(loginCount === 1, 'MQTT recovery reuses existing FCA instance (loginCount remains 1)', { loginCount });

  // ----------------------------------------------------
  // TEST 5: Concurrent login attempt protection
  // ----------------------------------------------------
  console.log('\n[TEST 5] Testing protection against concurrent/duplicate login attempts...');
  const freshConn = new AccountConnection(mockRecord);
  let freshLoginCount = 0;
  (freshConn as any).fallbackManager = {
    authenticate: async () => {
      freshLoginCount++;
      await new Promise(res => setTimeout(res, 200)); // Delay to simulate network auth
      return {
        connection: {
          providerName: 'MockFCA',
          api: { getCurrentUserID: () => testUid, listenMqtt: () => () => {} },
          botUserId: testUid,
          listen: async () => () => {},
          disconnect: async () => {},
          logout: async () => {}
        },
        activeProviderName: 'MockFCA'
      };
    }
  };

  // Launch 5 concurrent connect calls
  const concurrentResults = await Promise.all([
    freshConn.connect(),
    freshConn.connect(),
    freshConn.connect(),
    freshConn.connect(),
    freshConn.connect()
  ]);

  assert(concurrentResults.every(r => r === true), 'All concurrent connect promises resolved to true');
  assert(freshLoginCount === 1, 'Only ONE authentication operation executed across 5 concurrent calls', { freshLoginCount });

  // ----------------------------------------------------
  // TEST 6: AUTH_INVALID stops automatic login loops
  // ----------------------------------------------------
  console.log('\n[TEST 6] Testing AUTH_INVALID loop prevention...');
  freshConn.sessionState.authenticated = false;
  freshConn.sessionState.status = 'AUTH_INVALID';
  freshConn.status = 'COOKIE_EXPIRED';

  const invalidAttemptResult = await freshConn.connect();
  assert(invalidAttemptResult === false, 'connect() returns false when marked AUTH_INVALID');
  assert(freshLoginCount === 1, 'No additional login attempt made when marked AUTH_INVALID', { freshLoginCount });

  // Cleanup
  await MultiAccountManager.getInstance().removeAccount(testAccountId);
  await messengerAccountsData.delete(testAccountId);

  console.log('\n=================================================================');
  console.log(`📊 LIFECYCLE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPersistentSessionLifecycleTest().catch((err) => {
  console.error('Lifecycle test fatal error:', err);
  process.exit(1);
});
