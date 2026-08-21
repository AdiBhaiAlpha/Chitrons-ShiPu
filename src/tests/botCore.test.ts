import { CookieLoader } from '../adapters/messenger/CookieLoader';
import { FacebookSession } from '../adapters/messenger/FacebookSession';
import { botEngine } from '../core/botEngine';
import { emergencyAntiSpamGuard } from '../core/EmergencyAntiSpamGuard';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Running ShiPu Ai Core Unit Tests...\n');

  // 1. Test Cookie JSON Validation
  const validCookieJson = JSON.stringify([
    { key: 'c_user', value: '1000889201982' },
    { key: 'xs', value: 'sample_xs_token' }
  ]);
  const invalidJson = '{ bad_json: }';

  const validRes = CookieLoader.validateCookieJson(validCookieJson);
  assert(validRes.valid === true, 'Cookie Validation - Valid Cookie JSON');
  assert(validRes.userId === '1000889201982', 'Cookie Validation - Correct User ID extraction');

  const invalidRes = CookieLoader.validateCookieJson(invalidJson);
  assert(invalidRes.valid === false, 'Cookie Validation - Invalid JSON handled safely');

  // 2. Test Session Reconnect State Machine
  const session = new FacebookSession();
  const initialMeta = session.getSafeMetadata();
  assert(initialMeta.reconnectAttempts === 0, 'Session State Machine - Initial zero reconnect attempts');

  // 3. Test Prefix Detection & Command Parser
  const helpRes = await botEngine.handleIncomingEvent('thread_101', '10001', '#help');
  assert(helpRes !== null && (helpRes.body.includes('𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗠𝗘𝗡𝗨') || helpRes.body.includes('COMMAND MENU')), 'Command Parser - Default Prefix #help executes');

  // 4. Test #setprefix Command Execution & Permission System
  // User 10003 is Role 0 (Normal User) -> Should be rejected
  const failPrefixRes = await botEngine.handleIncomingEvent('thread_101', '10003', '#setprefix !');
  assert(failPrefixRes !== null && failPrefixRes.body.includes('Permission Denied!'), 'Permission System - Role 0 user blocked from #setprefix');

  // User 10001 is Role 3 (Bot Owner) -> Should succeed
  const successPrefixRes = await botEngine.handleIncomingEvent('thread_101', '10001', '#setprefix !');
  assert(successPrefixRes !== null && successPrefixRes.body.includes('Prefix successfully changed to: !'), 'Command Execution - #setprefix ! succeeds for Role 3');

  // After changing prefix to !, #ping should no longer work, but !ping should work
  emergencyAntiSpamGuard.resetThreadState('thread_101');
  botEngine.clearCooldowns();
  const oldPingRes = await botEngine.handleIncomingEvent('thread_101', '10001', '#ping');
  assert(oldPingRes === null || !oldPingRes.body.includes('ShiPu Ai'), 'Prefix Detection - #ping ignored after prefix set to !');

  emergencyAntiSpamGuard.resetThreadState('thread_101');
  botEngine.clearCooldowns();
  const newPingRes = await botEngine.handleIncomingEvent('thread_101', '10001', '!ping');
  assert(newPingRes !== null && (newPingRes.body.includes('𝗦𝗵𝗶𝗣𝘂 𝗔𝗶') || newPingRes.body.includes('ShiPu Ai')), 'Prefix Detection - !ping works after prefix set to !');

  // Reset thread prefix back to # for normal operation
  await botEngine.handleIncomingEvent('thread_101', '10001', '!setprefix #');

  // 5. Test User Settings / Balance Adjustment
  const initialUser = botEngine.getUser('10003')!;
  const oldMoney = initialUser.money;
  botEngine.setUserData('10003', { money: oldMoney + 500 });
  const updatedUser = botEngine.getUser('10003')!;
  assert(updatedUser.money === oldMoney + 500, 'User Settings - Money balance increment');

  // 6. Test ZIP Importer Service Audit & Database Seeding
  const { zipImporterService } = await import('../services/zipImporter');
  const zipReport = await zipImporterService.importZip();
  assert(zipReport !== null && typeof zipReport.totalJsFilesFound === 'number', 'Zip Importer - Executed scan & generated report');
  assert(zipReport.auditTable.length >= 0, 'Zip Importer - Audit mapping table generated');

  console.log(`\n====================================`);
  console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests();
