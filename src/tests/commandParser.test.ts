import { parseCommand, isSelfEvent, recordBotMessageId, isBotMessageId } from '../utils/commandParser';
import { botEngine } from '../core/botEngine';
import { multiAccountManager } from '../adapters/messenger/MultiAccountManager';

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

async function runCommandParserTests() {
  console.log('\n🧪 Running Command Parser & Self-Event Filter Tests...\n');

  // ==================================================
  // 1. STRICT COMMAND DETECTION TESTS (MUST PASS)
  // ==================================================
  const p1 = parseCommand('#help', '#');
  assert(p1.isCommand === true && p1.commandName === 'help' && p1.args.length === 0, '"#help" -> command');

  const p2 = parseCommand('#help test', '#');
  assert(p2.isCommand === true && p2.commandName === 'help' && p2.args[0] === 'test', '"#help test" -> command');

  const p3 = parseCommand('   #help', '#');
  assert(p3.isCommand === true && p3.commandName === 'help', '"   #help" -> command with leading spaces');

  const p4 = parseCommand('#info', '#');
  assert(p4.isCommand === true && p4.commandName === 'info', '"#info" -> command');

  // ==================================================
  // 2. INVALID COMMAND PLACEMENTS (MUST NOT TRIGGER)
  // ==================================================
  const np1 = parseCommand('hello #help', '#');
  assert(np1.isCommand === false, '"hello #help" -> NOT command');

  const np2 = parseCommand('Please use #help', '#');
  assert(np2.isCommand === false, '"Please use #help" -> NOT command');

  const np3 = parseCommand('Prefix: #help', '#');
  assert(np3.isCommand === false, '"Prefix: #help" -> NOT command');

  const np4 = parseCommand('Bot: #help', '#');
  assert(np4.isCommand === false, '"Bot: #help" -> NOT command');

  const np5 = parseCommand('my command is #info', '#');
  assert(np5.isCommand === false, '"my command is #info" -> NOT command');

  const np6 = parseCommand('# help', '#');
  assert(np6.isCommand === false, '"# help" (space after prefix) -> NOT command');

  const np7 = parseCommand('hello #info test', '#');
  assert(np7.isCommand === false, '"hello #info test" -> NOT command');

  // ==================================================
  // 3. EDGE CASES & SPECIAL PREFIXES
  // ==================================================
  assert(parseCommand('', '#').isCommand === false, 'Empty message -> NOT command');
  assert(parseCommand(null as any, '#').isCommand === false, 'Null body -> NOT command');
  assert(parseCommand(undefined as any, '#').isCommand === false, 'Undefined body -> NOT command');

  // Regex special character prefixes
  assert(parseCommand('$help', '$').isCommand === true, 'Prefix "$" works');
  assert(parseCommand('?help', '?').isCommand === true, 'Prefix "?" works');
  assert(parseCommand('+help', '+').isCommand === true, 'Prefix "+" works');
  assert(parseCommand('*help', '*').isCommand === true, 'Prefix "*" works');
  assert(parseCommand('🤖help', '🤖').isCommand === true, 'Prefix "🤖" works');
  assert(parseCommand('hello $help', '$').isCommand === false, 'Subtext "hello $help" -> NOT command');

  // Command with multiple arguments
  const pArgs = parseCommand('#ai hello world 123', '#');
  assert(pArgs.isCommand === true && pArgs.commandName === 'ai' && pArgs.args.length === 3 && pArgs.rawArgs === 'hello world 123', 'Command with multiple args parsed correctly');

  // ==================================================
  // 4. SELF-EVENT FILTERING & MULTI-ACCOUNT TESTS
  // ==================================================
  const botUidA = '1000889201982';
  const botUidB = '1000999999999';
  const userUid = '1000123456789';

  // Account A checks
  assert(isSelfEvent({ senderID: botUidA }, botUidA) === true, 'Account A drops event sent by Account A UID');
  assert(isSelfEvent({ senderID: userUid }, botUidA) === false, 'Account A allows event sent by normal user UID');

  // Account B checks
  assert(isSelfEvent({ senderID: botUidB }, botUidB) === true, 'Account B drops event sent by Account B UID');
  assert(isSelfEvent({ senderID: botUidA }, botUidB) === false, 'Account B allows event sent by Account A UID');

  // Explicit isSelf flag
  assert(isSelfEvent({ isSelf: true, senderID: userUid }, botUidA) === true, 'Explicit isSelf=true is dropped');

  // Outgoing message ID cache
  const testMsgId = `bot_out_${Date.now()}`;
  recordBotMessageId(testMsgId);
  assert(isBotMessageId(testMsgId) === true, 'Outgoing message ID stored in cache');
  assert(isSelfEvent({ messageID: testMsgId, senderID: userUid }, botUidA) === true, 'Event matching outgoing message ID is dropped');

  // ==================================================
  // 5. DETERMINISTIC FAIL-CLOSED UNIT TESTS (7 INVARIANTS)
  // ==================================================
  // Case 1: Normal text -> no command
  const c1 = parseCommand('hello everyone', '#');
  assert(c1.isCommand === false, '1. Normal text ("hello everyone") -> NO command');

  // Case 2: "hello #help" -> no command
  const c2 = parseCommand('hello #help', '#');
  assert(c2.isCommand === false, '2. "hello #help" -> NO command');

  // Case 3: "Prefix: #help" -> no command
  const c3 = parseCommand('Prefix: #help', '#');
  assert(c3.isCommand === false, '3. "Prefix: #help" -> NO command');

  // Case 4: "#help" -> help command
  const c4 = parseCommand('#help', '#');
  assert(c4.isCommand === true && c4.commandName === 'help', '4. "#help" -> help command');

  // Case 5: Bot's own UID -> event dropped immediately
  const selfRes = await botEngine.handleIncomingEvent('thread_test', botUidA, '#help', `msg_${Date.now()}`, 'acc_default');
  assert(selfRes.body === '', "5. Bot's own UID -> event dropped immediately (empty body response)");

  // Case 6: Bot-generated welcome text -> no command / no response
  const welcomeText = `স্বাগতম! এই মেসেঞ্জার গ্রুপে আপনাকে স্বাগতম। Prefix: # Use #help`;
  const welcomeRes = await botEngine.handleIncomingEvent('thread_test', userUid, welcomeText, `msg_${Date.now()}`, 'acc_default');
  assert(welcomeRes.body === '', '6. Bot-generated welcome text -> NO command / NO response');

  // Case 7: No-command event -> zero command executions
  const initialExecCount = botEngine.getStats().totalCommandsExecuted;
  await botEngine.handleIncomingEvent('thread_test', userUid, 'hello world, how are you?', `msg_${Date.now()}`, 'acc_default');
  const finalExecCount = botEngine.getStats().totalCommandsExecuted;
  assert(initialExecCount === finalExecCount, '7. No-command event -> ZERO command executions');

  console.log(`\n====================================`);
  console.log(`Command Parser Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runCommandParserTests();
