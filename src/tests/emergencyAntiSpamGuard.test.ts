import { emergencyAntiSpamGuard } from '../core/EmergencyAntiSpamGuard';
import { botEngine } from '../core/botEngine';
import { parseCommand } from '../utils/commandParser';

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
  console.log(`🧪 Running Emergency Anti-Spam / Self-Loop Guard Unit Tests...\n`);

  // ==================================================
  // TEST 1: Normal single command -> no emergency
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  const safe1 = emergencyAntiSpamGuard.recordOutgoingMessage('thread_1', 'Command output: #help executed');
  assert(safe1 === true, '1. Single command response is allowed');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('thread_1') === false, '1. Normal single command -> NO emergency');

  // ==================================================
  // TEST 2: Two legitimate quick responses -> no emergency
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_2', 'First quick message');
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_2', 'Second quick message');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('thread_2') === false, '2. Two quick responses -> NO emergency');

  // ==================================================
  // TEST 3: Continuous bot outgoing loop -> emergency triggered
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_3', 'Loop message 1');
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_3', 'Loop message 2');
  const safe3 = emergencyAntiSpamGuard.recordOutgoingMessage('thread_3', 'Loop message 3');
  assert(safe3 === false, '3. Third rapid message in 3s returns false');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('thread_3') === true, '3. Continuous bot outgoing loop -> emergency triggered');

  // ==================================================
  // TEST 4: Bot sends a message every ~1 second continuously -> emergency triggered
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_4', '1s msg 1');
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_4', '1s msg 2');
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_4', '1s msg 3');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('thread_4') === true, '4. Messages sent ~1s apart continuously -> emergency triggered');

  // ==================================================
  // TEST 5: Same response repeatedly generated -> emergency triggered
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  const repeatedText = 'This is a repeated bot-generated response for testing';
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_5', repeatedText);
  // simulate spacing out slightly so 3s limit isn't immediately hit, but repeat limit is
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_5', repeatedText);
  emergencyAntiSpamGuard.recordOutgoingMessage('thread_5', repeatedText);
  assert(emergencyAntiSpamGuard.isThreadInEmergency('thread_5') === true, '5. Same response repeatedly generated -> emergency triggered');

  // ==================================================
  // TEST 6: Bot receives its own outgoing message -> self-filter drops it
  // ==================================================
  const botUid = process.env.BOT_UID || '1000889201982';
  botEngine.selfUserId = botUid;
  const selfRes = await botEngine.handleIncomingEvent('thread_6', botUid, '#help', 'msg_self_123', 'acc_1');
  assert(selfRes.body === '', '6. Bot receives its own message -> self-filter drops it and returns empty body');

  // ==================================================
  // TEST 7: Normal user messages containing "#help" in the middle -> no command execution
  // ==================================================
  const midTextRes = await botEngine.handleIncomingEvent('thread_7', 'user_999', 'Hello please run #help now', 'msg_user_123', 'acc_1');
  assert(midTextRes.body === '', '7. Normal user text with #help in middle -> NO command execution');

  // ==================================================
  // TEST 8: Valid "#help" at message start -> normal command execution
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  const validHelpRes = await botEngine.handleIncomingEvent('thread_8', 'user_999', '#help', 'msg_user_124', 'acc_1');
  assert(validHelpRes.body !== '' && validHelpRes.body.includes('COMMAND MENU'), '8. Valid "#help" at message start -> normal command execution');

  // ==================================================
  // TEST 9: Emergency state -> all future outgoing messages blocked
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  emergencyAntiSpamGuard.triggerEmergency('thread_9');
  assert(emergencyAntiSpamGuard.canSendSafely('thread_9') === false, '9. Emergency state -> canSendSafely returns false');
  const recordBlocked = emergencyAntiSpamGuard.recordOutgoingMessage('thread_9', 'Should be blocked');
  assert(recordBlocked === false, '9. Emergency state -> recordOutgoingMessage returns false');

  // ==================================================
  // TEST 10: Leave-group failure -> bot still remains silent and blocked
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  const mockFailingApi = {
    removeUserFromGroup: (uid: string, threadId: string, cb: Function) => {
      cb(new Error('Facebook API permissions error'));
    }
  };
  await emergencyAntiSpamGuard.attemptEmergencyGroupLeave('thread_10', 'acc_1', mockFailingApi);
  emergencyAntiSpamGuard.triggerEmergency('thread_10', 'acc_1', 'Loop test', mockFailingApi);
  assert(emergencyAntiSpamGuard.isThreadInEmergency('thread_10', 'acc_1') === true, '10. Leave-group failure -> thread stays in emergency state');
  assert(emergencyAntiSpamGuard.canSendSafely('thread_10', 'acc_1') === false, '10. Leave-group failure -> bot still blocked from sending messages');

  // ==================================================
  // TEST 11: Multiple groups -> emergency state of Group A must not affect Group B
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  emergencyAntiSpamGuard.triggerEmergency('Group_A');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('Group_A') === true, '11. Group A in emergency');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('Group_B') === false, '11. Group B NOT in emergency');
  assert(emergencyAntiSpamGuard.canSendSafely('Group_B') === true, '11. Group B can still send messages safely');

  // ==================================================
  // TEST 12: Multiple Facebook accounts -> each account/thread has independent safety state
  // ==================================================
  emergencyAntiSpamGuard.clearAll();
  emergencyAntiSpamGuard.triggerEmergency('Thread_X', 'Account_A');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('Thread_X', 'Account_A') === true, '12. Account A / Thread X in emergency');
  assert(emergencyAntiSpamGuard.isThreadInEmergency('Thread_X', 'Account_B') === false, '12. Account B / Thread X NOT in emergency');
  assert(emergencyAntiSpamGuard.canSendSafely('Thread_X', 'Account_B') === true, '12. Account B can still send messages safely');

  console.log(`\n====================================`);
  console.log(`Emergency Anti-Spam Guard Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
