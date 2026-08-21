/**
 * Comprehensive Unit Test Suite for ShiPu AI - #sms Testing Command & Simulation Engine
 */

import { SmsValidator, SmsSimulationService, smsSimulationService } from '../services/smsSimulationService';

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

async function runSmsTestSuite() {
  console.log('\n🧪 Running SMS Command & Gateway Simulator Tests...\n');

  // =========================================================================
  // 1. PHONE NUMBER NORMALIZATION TESTS
  // =========================================================================
  console.log('--- 1. Phone Normalization ---');

  // Standard 11-digit local format: 01316655254
  const n1 = SmsValidator.normalizePhoneNumber('01316655254');
  assert(n1 === '+8801316655254', '01316655254 normalization -> +8801316655254');

  // International format with plus: +8801316655254
  const n2 = SmsValidator.normalizePhoneNumber('+8801316655254');
  assert(n2 === '+8801316655254', '+8801316655254 normalization -> +8801316655254');

  // International format without plus: 8801316655254
  const n3 = SmsValidator.normalizePhoneNumber('8801316655254');
  assert(n3 === '+8801316655254', '8801316655254 normalization -> +8801316655254');

  // Formats with spaces, hyphens, and parentheses
  const n4 = SmsValidator.normalizePhoneNumber('01316-655254');
  assert(n4 === '+8801316655254', 'Hyphenated "01316-655254" normalization -> +8801316655254');

  const n5 = SmsValidator.normalizePhoneNumber('+88 01316 655 254');
  assert(n5 === '+8801316655254', 'Spaced "+88 01316 655 254" normalization -> +8801316655254');

  const n6 = SmsValidator.normalizePhoneNumber('(01316) 655254');
  assert(n6 === '+8801316655254', 'Parenthesized "(01316) 655254" normalization -> +8801316655254');

  // Other valid Bangladesh operator codes: 017, 018, 019, 015, 016, 014
  assert(SmsValidator.normalizePhoneNumber('01712345678') === '+8801712345678', 'GP 017 prefix normalizes correctly');
  assert(SmsValidator.normalizePhoneNumber('01812345678') === '+8801812345678', 'Robi 018 prefix normalizes correctly');
  assert(SmsValidator.normalizePhoneNumber('01912345678') === '+8801912345678', 'BL 019 prefix normalizes correctly');
  assert(SmsValidator.normalizePhoneNumber('01512345678') === '+8801512345678', 'Teletalk 015 prefix normalizes correctly');
  assert(SmsValidator.normalizePhoneNumber('01612345678') === '+8801612345678', 'Airtel 016 prefix normalizes correctly');

  // =========================================================================
  // 2. INVALID PHONE REJECTION TESTS
  // =========================================================================
  console.log('\n--- 2. Invalid Number Rejection ---');

  assert(SmsValidator.normalizePhoneNumber('abc') === null, 'Alphabetic "abc" rejection');
  assert(SmsValidator.normalizePhoneNumber('01212345678') === null, 'Invalid prefix 012 rejection (non-BD mobile)');
  assert(SmsValidator.normalizePhoneNumber('0131665525') === null, 'Too short (10 digits) rejection');
  assert(SmsValidator.normalizePhoneNumber('013166552540') === null, 'Too long (12 digits) rejection');
  assert(SmsValidator.normalizePhoneNumber('+14155552671') === null, 'US country code (+1) rejection');
  assert(SmsValidator.normalizePhoneNumber('') === null, 'Empty string rejection');
  assert(SmsValidator.normalizePhoneNumber('   ') === null, 'Whitespace only rejection');

  // =========================================================================
  // 3. PHONE NUMBER PRIVACY MASKING TESTS
  // =========================================================================
  console.log('\n--- 3. Privacy Masking ---');

  const masked = SmsValidator.maskPhoneNumber('01316655254');
  assert(masked === '+880131*****254', 'Phone masking "+880131*****254" hides middle digits');

  const maskedWithPlus = SmsValidator.maskPhoneNumber('+8801316655254');
  assert(maskedWithPlus === '+880131*****254', 'Masking +8801316655254 produces +880131*****254');

  // =========================================================================
  // 4. ROUNDS VALIDATION TESTS
  // =========================================================================
  console.log('\n--- 4. Rounds Validation ---');

  // Missing rounds
  const rMissing = SmsValidator.validateRounds(undefined);
  assert(!rMissing.success && rMissing.code === 'MISSING_ROUNDS', 'Missing rounds rejected');

  // Non-integer string
  const rAbc = SmsValidator.validateRounds('abc');
  assert(!rAbc.success && rAbc.code === 'NON_INTEGER_ROUNDS', 'Non-integer "abc" rejected');

  // Decimal number
  const rDecimal = SmsValidator.validateRounds('10.5');
  assert(!rDecimal.success && rDecimal.code === 'NON_INTEGER_ROUNDS', 'Decimal "10.5" rejected');

  // 0 rounds (out of bounds)
  const rZero = SmsValidator.validateRounds('0');
  assert(!rZero.success && rZero.code === 'ROUNDS_OUT_OF_BOUNDS', '0 rounds rejected (must be >= 1)');

  // Negative rounds
  const rNeg = SmsValidator.validateRounds('-5');
  assert(!rNeg.success && rNeg.code === 'ROUNDS_OUT_OF_BOUNDS', 'Negative "-5" rounds rejected');

  // 1 round acceptance (minimum boundary)
  const rMin = SmsValidator.validateRounds('1');
  assert(rMin.success && rMin.value === 1, '1 round acceptance (min boundary)');

  // 50 rounds acceptance (middle value)
  const rMid = SmsValidator.validateRounds('50');
  assert(rMid.success && rMid.value === 50, '50 rounds acceptance');

  // 100 rounds acceptance (maximum boundary)
  const rMax = SmsValidator.validateRounds('100');
  assert(rMax.success && rMax.value === 100, '100 rounds acceptance (max boundary)');

  // 101 rounds rejection (exceeds maximum)
  const rOver = SmsValidator.validateRounds('101');
  assert(!rOver.success && rOver.code === 'ROUNDS_EXCEEDS_MAX', '101 rounds rejection (exceeds max 100)');

  // =========================================================================
  // 5. COMMAND ARGUMENTS COMPREHENSIVE VALIDATION
  // =========================================================================
  console.log('\n--- 5. Command Args Parsing ---');

  // #sms (no args) -> USAGE
  const cNoArgs = SmsValidator.validateCommandArgs([]);
  assert(!cNoArgs.success && cNoArgs.code === 'MISSING_ARGS', '#sms with no args triggers usage');

  // #sms abc 10 -> invalid phone
  const cInvalidPhone = SmsValidator.validateCommandArgs(['abc', '10']);
  assert(!cInvalidPhone.success && cInvalidPhone.code === 'INVALID_PHONE', '#sms abc 10 returns invalid phone error');

  // #sms 01316655254 -> missing rounds
  const cMissingRounds = SmsValidator.validateCommandArgs(['01316655254']);
  assert(!cMissingRounds.success && cMissingRounds.code === 'MISSING_ROUNDS', '#sms 01316655254 returns missing rounds error');

  // #sms 01316655254 abc -> non-integer rounds
  const cNonInt = SmsValidator.validateCommandArgs(['01316655254', 'abc']);
  assert(!cNonInt.success && cNonInt.code === 'NON_INTEGER_ROUNDS', '#sms 01316655254 abc returns non-integer error');

  // #sms 01316655254 0 -> out of bounds
  const cZero = SmsValidator.validateCommandArgs(['01316655254', '0']);
  assert(!cZero.success && cZero.code === 'ROUNDS_OUT_OF_BOUNDS', '#sms 01316655254 0 returns out of bounds error');

  // #sms 01316655254 101 -> max 100 rounds
  const cMax = SmsValidator.validateCommandArgs(['01316655254', '101']);
  assert(!cMax.success && cMax.code === 'ROUNDS_EXCEEDS_MAX', '#sms 01316655254 101 returns max limit error');

  // #sms +8801316655254 50 -> valid simulation
  const cValid = SmsValidator.validateCommandArgs(['+8801316655254', '50']);
  assert(
    cValid.success &&
    cValid.value?.normalizedPhone === '+8801316655254' &&
    cValid.value?.rounds === 50 &&
    cValid.value?.maskedPhone === '+880131*****254',
    '#sms +8801316655254 50 parsed successfully into normalized payload'
  );

  // =========================================================================
  // 6. SIMULATION SERVICE & EXECUTION TEST
  // =========================================================================
  console.log('\n--- 6. Simulation Service Execution ---');

  const testUserId = 'test_user_' + Date.now();
  const job = await smsSimulationService.createAndRunSimulation(
    testUserId,
    'thread_sms_test',
    '+8801316655254',
    5
  );

  assert(job.status === 'COMPLETED', 'Simulation job completed successfully');
  assert(job.requestedRounds === 5, 'Requested rounds match (5)');
  assert(job.completedRounds + job.failedRounds === 5, 'All 5 rounds were executed');
  assert(job.roundLogs.length === 5, '5 individual round logs recorded');
  assert((job.totalDurationMs || 0) > 0, 'Total execution time calculated');
  assert(job.apiKeyRedacted.includes('***'), 'API key is properly redacted in job state');

  const summary = smsSimulationService.formatJobSummary(job);
  assert(summary.includes(job.jobId), 'Summary contains Job ID');
  assert(summary.includes('+880131*****254'), 'Summary displays masked phone number');
  assert(summary.includes('Delivered Rounds:'), 'Summary displays delivered count');

  // =========================================================================
  // 7. RATE LIMITING & COOLDOWN TESTS
  // =========================================================================
  console.log('\n--- 7. Rate Limiting & Cooldown ---');

  // User just finished a job; immediate subsequent request must be rate limited by cooldown
  const rateCheck = smsSimulationService.checkRateLimit(testUserId);
  assert(rateCheck.allowed === false && (rateCheck.reason || '').includes('Cooldown Active'), 'Immediate subsequent job blocked by Cooldown');

  // Different user should be allowed
  const otherUserCheck = smsSimulationService.checkRateLimit('other_user_' + Date.now());
  assert(otherUserCheck.allowed === true, 'Different user is allowed to start simulation');

  // =========================================================================
  // 8. SENSITIVE DATA & API KEY REDACTION TESTS
  // =========================================================================
  console.log('\n--- 8. API Key Redaction ---');

  const rawLog = 'Calling endpoint: https://sms-sender-1.onrender.com/?phone=+8801316655254&rounds=5&key=SuSHiLx2024SMS';
  const redactedLog = smsSimulationService.redactApiKey(rawLog);
  assert(!redactedLog.includes('SuSHiLx2024SMS') && redactedLog.includes('SuS***SMS'), 'Secret API Key "SuSHiLx2024SMS" is safely redacted');

  console.log(`\n======================================================`);
  console.log(`SMS Testing Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmsTestSuite().catch((err) => {
  console.error('Fatal error during SMS tests:', err);
  process.exit(1);
});
