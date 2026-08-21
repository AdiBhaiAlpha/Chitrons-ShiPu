import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { goatBotLoader } from '../core/goatBotLoader';
import { botEngine } from '../core/botEngine';
import { emergencyAntiSpamGuard } from '../core/EmergencyAntiSpamGuard';

async function runGoatBotLoaderTests() {
  console.log('🧪 Running GoatBot Loader & Compatibility Tests...');

  emergencyAntiSpamGuard.resetThreadState('thread_goatbot_test');

  // Test 1: Directory scan
  const commandsDir = fs.existsSync('/commands') ? '/commands' : path.join(process.cwd(), 'commands');
  const loaded = goatBotLoader.scanDirectoryAndLoad(commandsDir);
  assert(loaded.length > 0, 'Directory scanner should load commands');
  console.log('✅ [PASS] GoatBot Directory Scanner & File Loader');

  // Test 2: CommonJS Evaluation
  const code = `
    module.exports = {
      config: { name: "testgoat", role: 0 },
      onStart: async function({ message }) {
        return message.reply("GoatBot CommonJS test succeeded!");
      }
    };
  `;
  const { type, summary } = goatBotLoader.loadCommandFromCode(code, 'testgoat.js');
  assert.strictEqual(type, 'GOATBOT_COMMONJS');
  assert.strictEqual(summary.name, 'testgoat');
  console.log('✅ [PASS] GoatBot CommonJS Evaluation & Context Injection');

  // Test 3: End-to-end execution of #rank in BotEngine
  await botEngine.reloadPluginsFromDatabase();
  const res = await botEngine.handleIncomingEvent(
    'thread_goatbot_test',
    '10001',
    '#rank',
    'msg_goat_1'
  );

  assert(res.body.includes('Rank') || res.body.includes('GoatBot') || res.body.includes('User'), `Unexpected output: ${res.body}`);
  console.log('✅ [PASS] End-to-End GoatBot #rank Command Execution');

  console.log('====================================');
  console.log('GoatBot Loader Test Summary: All Passed');
  console.log('====================================');
  process.exit(0);
}

runGoatBotLoaderTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
