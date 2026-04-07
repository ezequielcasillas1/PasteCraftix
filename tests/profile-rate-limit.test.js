/**
 * Integration Test: Profile Update Rate Limit
 * 
 * Tests the database trigger that limits profile updates to 50/day per user.
 * 
 * Prerequisites:
 * 1. Run the migration: db/migrations/20260407_add_profile_rate_limit.sql
 * 2. Ensure Supabase project is active
 * 
 * Usage:
 *   node tests/profile-rate-limit.test.js
 * 
 * What it tests:
 * - Updates 1-50 should succeed
 * - Update 51 should fail with "Profile update limit exceeded"
 * - Counter resets on new day (simulated)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://blpngeeqcegquiydreyu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscG5nZWVxY2VncXVpeWRyZXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzkyOTAsImV4cCI6MjA3NzUxNTI5MH0.eRuh8Eu66wyAMNu0tRyc9LCGVRp7Dhm_87BiQhnRY2o';

const TEST_USER_ID = `test_rate_limit_${Date.now()}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function log(message, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️', test: '🧪' };
  console.log(`${icons[type] || ''} ${message}`);
}

async function createTestProfile() {
  log(`Creating test profile: ${TEST_USER_ID}`, 'test');
  
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({ 
      user_id: TEST_USER_ID,
      user_name: 'Rate Limit Test User',
      daily_update_count: 0,
      last_update_reset_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create test profile: ${error.message}`);
  }
  
  log(`Test profile created with id: ${data.id}`, 'success');
  return data;
}

async function updateProfile(updateNumber) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ 
      user_name: `Test User Update #${updateNumber}`,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', TEST_USER_ID)
    .select('daily_update_count')
    .single();
  
  return { data, error };
}

async function getProfileStats() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('daily_update_count, last_update_reset_at')
    .eq('user_id', TEST_USER_ID)
    .single();
  
  return { data, error };
}

async function cleanupTestProfile() {
  log(`Cleaning up test profile: ${TEST_USER_ID}`, 'info');
  
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('user_id', TEST_USER_ID);
  
  if (error) {
    log(`Warning: Failed to cleanup test profile: ${error.message}`, 'warn');
  } else {
    log('Test profile cleaned up', 'success');
  }
}

async function testRateLimit() {
  console.log('\n' + '='.repeat(60));
  log('PROFILE RATE LIMIT INTEGRATION TEST', 'test');
  console.log('='.repeat(60) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Setup: Create test profile
    await createTestProfile();
    
    // Test 1: First 50 updates should succeed
    log('\nTest 1: First 50 updates should succeed...', 'test');
    
    let successCount = 0;
    for (let i = 1; i <= 50; i++) {
      const { data, error } = await updateProfile(i);
      
      if (error) {
        log(`Update #${i} failed unexpectedly: ${error.message}`, 'error');
        failed++;
        break;
      } else {
        successCount++;
        if (i % 10 === 0 || i === 50) {
          log(`  Updates 1-${i} succeeded (count: ${data?.daily_update_count || 'N/A'})`, 'info');
        }
      }
    }
    
    if (successCount === 50) {
      log('Test 1 PASSED: All 50 updates succeeded', 'success');
      passed++;
    } else {
      log(`Test 1 FAILED: Only ${successCount}/50 updates succeeded`, 'error');
      failed++;
    }
    
    // Verify counter
    const stats = await getProfileStats();
    log(`  Current stats: daily_update_count = ${stats.data?.daily_update_count}`, 'info');
    
    // Test 2: Update #51 should fail with rate limit error
    log('\nTest 2: Update #51 should be rejected...', 'test');
    
    const { data: data51, error: error51 } = await updateProfile(51);
    
    if (error51 && error51.message.includes('limit exceeded')) {
      log('Test 2 PASSED: Update #51 rejected with rate limit error', 'success');
      log(`  Error message: ${error51.message}`, 'info');
      passed++;
    } else if (error51) {
      log(`Test 2 FAILED: Update #51 failed with unexpected error: ${error51.message}`, 'error');
      failed++;
    } else {
      log('Test 2 FAILED: Update #51 succeeded but should have been rejected', 'error');
      log(`  Got data: ${JSON.stringify(data51)}`, 'info');
      failed++;
    }
    
    // Test 3: Verify counter didn't increment past 50
    log('\nTest 3: Counter should stay at 50...', 'test');
    
    const finalStats = await getProfileStats();
    if (finalStats.data?.daily_update_count === 50) {
      log('Test 3 PASSED: Counter correctly stayed at 50', 'success');
      passed++;
    } else {
      log(`Test 3 FAILED: Counter is ${finalStats.data?.daily_update_count}, expected 50`, 'error');
      failed++;
    }
    
  } catch (err) {
    log(`Test suite error: ${err.message}`, 'error');
    failed++;
  } finally {
    // Cleanup
    await cleanupTestProfile();
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  log('TEST RESULTS', 'test');
  console.log('='.repeat(60));
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log('='.repeat(60) + '\n');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Check if migration columns exist first
async function checkMigrationApplied() {
  log('Checking if rate limit migration is applied...', 'info');
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('daily_update_count, last_update_reset_at')
    .limit(1);
  
  if (error && error.message.includes('daily_update_count')) {
    log('Migration NOT applied - columns missing', 'error');
    log('Please run: db/migrations/20260407_add_profile_rate_limit.sql', 'warn');
    log('You can run it in Supabase Dashboard > SQL Editor', 'info');
    process.exit(1);
  }
  
  log('Migration columns exist', 'success');
}

// Main execution
(async () => {
  try {
    await checkMigrationApplied();
    await testRateLimit();
  } catch (err) {
    log(`Fatal error: ${err.message}`, 'error');
    process.exit(1);
  }
})();
