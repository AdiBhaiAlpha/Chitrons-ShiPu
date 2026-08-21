import { botEngine, routeIncomingMessage } from '../core/botEngine';
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

async function runRoutingRegressionTests() {
  console.log('\n🧪 Running Centralized Routing Gate & Command Execution Regression Tests...\n');

  const threadID = 'thread_regression_101';
  const userUID = '1000999888777';
  const botUID = '1000889201982';
  const prefix = '#';

  // ==================================================
  // 1. ROUTING GATE DETERMINISM TESTS
  // ==================================================
  const nonCommandPhrases = [
    'Hi',
    'Hello',
    'good morning',
    'How are you?',
    'Prefix: #help',
    'hello #help',
    'Please use #help',
    'কেমন আছো',
    'আসসালামু আলাইকুম'
  ];

  for (const phrase of nonCommandPhrases) {
    const route = routeIncomingMessage(
      { senderID: userUID, body: phrase, threadID },
      { botUid: botUID },
      prefix
    );
    assert(route === 'NORMAL_CHAT', `Route for "${phrase}" -> NORMAL_CHAT`);
  }

  const validCommands = [
    { text: '#help', expectedCmd: 'help' },
    { text: '#info', expectedCmd: 'info' },
    { text: '#uptime', expectedCmd: 'uptime' }
  ];

  for (const cmdObj of validCommands) {
    const route = routeIncomingMessage(
      { senderID: userUID, body: cmdObj.text, threadID },
      { botUid: botUID },
      prefix
    );
    assert(route === 'COMMAND', `Route for "${cmdObj.text}" -> COMMAND`);
  }

  // Self event route
  const selfRoute = routeIncomingMessage(
    { senderID: botUID, body: '#help', threadID },
    { botUid: botUID },
    prefix
  );
  assert(selfRoute === 'IGNORED', 'Bot self-event route -> IGNORED');

  // ==================================================
  // 2. COMMAND EXECUTION COUNT REGRESSION TESTS
  // ==================================================
  console.log('\n--- Testing Command Execution Counts ---\n');

  // Test Non-Commands produce ZERO command executions
  for (const phrase of nonCommandPhrases) {
    const initialCmds = botEngine.getStats().totalCommandsExecuted;
    const res = await botEngine.handleIncomingEvent(threadID, userUID, phrase, `msg_${Date.now()}`);
    const finalCmds = botEngine.getStats().totalCommandsExecuted;

    const diff = finalCmds - initialCmds;
    assert(diff === 0, `Phrase "${phrase}" resulted in EXACTLY 0 command executions (Actual: ${diff})`);
  }

  // Test Valid Commands produce EXACTLY 1 command execution each
  let cmdIdx = 0;
  for (const cmdObj of validCommands) {
    cmdIdx++;
    const testThreadID = `${threadID}_cmd_${cmdIdx}`;
    const initialCmds = botEngine.getStats().totalCommandsExecuted;
    const res = await botEngine.handleIncomingEvent(testThreadID, userUID, cmdObj.text, `msg_${Date.now()}`);
    const finalCmds = botEngine.getStats().totalCommandsExecuted;

    const diff = finalCmds - initialCmds;
    assert(diff === 1, `Command "${cmdObj.text}" resulted in EXACTLY 1 command execution (Actual: ${diff})`);
    assert(Boolean(res.body && res.body.trim().length > 0), `Command "${cmdObj.text}" returned non-empty response body (Got: "${res.body}")`);
  }

  console.log(`\n====================================`);
  console.log(`Routing Regression Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runRoutingRegressionTests();
