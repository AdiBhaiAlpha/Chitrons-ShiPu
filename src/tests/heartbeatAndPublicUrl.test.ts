import { heartbeatService } from '../services/heartbeatService';

async function testHeartbeatAndPublicUrl() {
  console.log('🧪 Running Heartbeat & Public URL Detection Unit Tests...\n');

  // Test 1: Initial state before env
  const initialDiagnostics = heartbeatService.getDiagnostics();
  console.log('1. Initial diagnostics publicUrl:', initialDiagnostics.publicUrl);
  if (initialDiagnostics.publicUrl !== 'not_configured' && !initialDiagnostics.publicUrl.startsWith('http')) {
    throw new Error(`Expected valid publicUrl or 'not_configured', got ${initialDiagnostics.publicUrl}`);
  }
  console.log('✅ [PASS] 1. Initial diagnostics checked');

  // Test 2: Validating public URLs
  const valid1 = heartbeatService.isValidPublicUrl('https://ais-dev-3ewg7jqeepx7aumehzwehc-405046189593.asia-east1.run.app');
  const valid2 = heartbeatService.isValidPublicUrl('http://localhost:3000');
  const valid3 = heartbeatService.isValidPublicUrl('http://127.0.0.1:3000');
  const valid4 = heartbeatService.isValidPublicUrl('https://my-custom-domain.com');

  if (!valid1) throw new Error('Expected Cloud Run domain to be valid public URL');
  if (valid2) throw new Error('Expected localhost to be invalid public URL');
  if (valid3) throw new Error('Expected 127.0.0.1 to be invalid public URL');
  if (!valid4) throw new Error('Expected custom domain to be valid public URL');
  console.log('✅ [PASS] 2. Public URL validation rules verified (localhost rejected, real domains accepted)');

  // Test 3: Candidate URL proposal from client origin
  const proposed = heartbeatService.proposeCandidateUrl('https://ais-dev-3ewg7jqeepx7aumehzwehc-405046189593.asia-east1.run.app', 'test origin');
  if (!proposed) throw new Error('Expected proposeCandidateUrl to return true');

  const diagAfterProp = heartbeatService.getDiagnostics();
  if (diagAfterProp.publicUrl !== 'https://ais-dev-3ewg7jqeepx7aumehzwehc-405046189593.asia-east1.run.app') {
    throw new Error(`Expected proposed public URL, got ${diagAfterProp.publicUrl}`);
  }
  if (diagAfterProp.healthUrl !== 'https://ais-dev-3ewg7jqeepx7aumehzwehc-405046189593.asia-east1.run.app/health') {
    throw new Error(`Expected proposed health URL, got ${diagAfterProp.healthUrl}`);
  }
  console.log('✅ [PASS] 3. Proposing candidate public URL automatically sets Deployment & Health Check URLs');

  // Test 4: Manual setting of custom public URL
  const setResult = await heartbeatService.setPublicUrlManually('https://custom-bot.example.com');
  if (!setResult.success) throw new Error(`Expected setPublicUrlManually to succeed, got ${setResult.message}`);

  const diagAfterManual = heartbeatService.getDiagnostics();
  if (diagAfterManual.publicUrl !== 'https://custom-bot.example.com') {
    throw new Error(`Expected manual public URL, got ${diagAfterManual.publicUrl}`);
  }
  if (diagAfterManual.healthUrl !== 'https://custom-bot.example.com/health') {
    throw new Error(`Expected manual health URL, got ${diagAfterManual.healthUrl}`);
  }
  console.log('✅ [PASS] 4. Manual PUBLIC_URL setting persists and updates health check target');

  // Test 5: Rejection of invalid manual input (localhost)
  const invalidSet = await heartbeatService.setPublicUrlManually('http://localhost:3000');
  if (invalidSet.success) throw new Error('Expected setting localhost to fail');
  console.log('✅ [PASS] 5. Manual configuration rejects localhost as public URL');

  console.log('\n====================================');
  console.log('Heartbeat & Public URL Tests: ALL PASSED');
  console.log('====================================\n');
  process.exit(0);
}

testHeartbeatAndPublicUrl().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
