import fs from 'fs';
import path from 'path';
import { sqliteAutoHealingGuard } from '../core/SqliteAutoHealingGuard';
import { loadFCAModule } from '../adapters/messenger/fca/loadFCAModule';

async function runSqliteGuardTest() {
  console.log('🧪 Running SQLite Auto-Healing Guard Unit Tests...\n');

  const fcaDir = path.join(process.cwd(), 'Fca_Database');
  if (!fs.existsSync(fcaDir)) {
    fs.mkdirSync(fcaDir, { recursive: true });
  }

  const testDbPath = path.join(fcaDir, 'database.sqlite');

  // 1. Simulate corrupted SQLite file
  fs.writeFileSync(testDbPath, 'CORRUPT_MALFORMED_HEADER_BYTES_' + Math.random(), 'utf-8');
  console.log('1. Created intentional corrupt SQLite database file at:', testDbPath);

  // 2. Run auto-healing guard
  await sqliteAutoHealingGuard.ensureCleanSqliteDatabases();

  // 3. Verify corrupt file was moved/deleted
  const existsNow = fs.existsSync(testDbPath);
  console.log('2. Corrupt file exists after auto-healing scan:', existsNow);
  if (existsNow) {
    throw new Error('Expected corrupt database file to be removed or backed up by auto-healing guard!');
  }
  console.log('✅ [PASS] Corrupt SQLite database file successfully detected and healed!');

  // 4. Test loading FCA module with fresh state
  const fcaMod = await loadFCAModule('@dongdev/fca-unofficial');
  if (typeof fcaMod !== 'function' && typeof fcaMod !== 'object') {
    throw new Error('Expected FCA module to load cleanly');
  }
  console.log('✅ [PASS] FCA module loaded without any SQLITE_CORRUPT error!');

  console.log('\n====================================');
  console.log('SQLite Auto-Healing Guard Tests: ALL PASSED');
  console.log('====================================\n');
  process.exit(0);
}

runSqliteGuardTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
