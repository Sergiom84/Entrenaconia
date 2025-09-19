/**
 * Test Script for Routine System Fixes
 * Tests the following critical issues:
 * 1. Plan status handling (draft vs active)
 * 2. SQL GROUP BY fix in progress-data endpoint
 *
 * Run this test with: node test-routine-fixes.js
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3003/api';
const TEST_USER_ID = 18;
const TEST_METHODOLOGY_PLAN_ID = 18;

// Test user token (replace with actual token)
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE';

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testPlanStatus() {
  console.log('\n🔍 TEST 1: Checking Plan Status Logic');
  console.log('=====================================');

  try {
    // Test 1: Check plan status endpoint
    const statusResponse = await axios.get(
      `${API_BASE_URL}/routines/plan-status/${TEST_METHODOLOGY_PLAN_ID}`,
      { headers }
    );

    console.log('✅ Plan Status Check:');
    console.log('  - Status:', statusResponse.data.status);
    console.log('  - Is Confirmed:', statusResponse.data.isConfirmed);
    console.log('  - Confirmed At:', statusResponse.data.confirmedAt);

    // Test 2: Get active plan
    const activePlanResponse = await axios.get(
      `${API_BASE_URL}/routines/active-plan`,
      { headers }
    );

    if (activePlanResponse.data.hasActivePlan) {
      console.log('✅ Active Plan Found:');
      console.log('  - Plan ID:', activePlanResponse.data.activePlan.methodology_plan_id);
      console.log('  - Status:', activePlanResponse.data.activePlan.status);
      console.log('  - Type:', activePlanResponse.data.activePlan.methodology_type);
    } else {
      console.log('⚠️ No active plan found');
      console.log('  - May need to activate plan first');
    }

    return true;
  } catch (error) {
    console.error('❌ Plan Status Test Failed:');
    console.error('  - Error:', error.response?.data || error.message);
    return false;
  }
}

async function testProgressData() {
  console.log('\n🔍 TEST 2: Testing Progress Data (GROUP BY Fix)');
  console.log('===============================================');

  try {
    const progressResponse = await axios.get(
      `${API_BASE_URL}/routines/progress-data/${TEST_METHODOLOGY_PLAN_ID}`,
      { headers }
    );

    console.log('✅ Progress Data Retrieved Successfully:');
    console.log('  - Total Sessions:', progressResponse.data.total_stats.total_sessions_started);
    console.log('  - Completed Sessions:', progressResponse.data.total_stats.total_sessions_completed);
    console.log('  - Weekly Progress Count:', progressResponse.data.weekly_progress.length);
    console.log('  - Recent Activity Count:', progressResponse.data.recent_activity.length);

    // Check if weekly progress has proper structure
    if (progressResponse.data.weekly_progress.length > 0) {
      const week = progressResponse.data.weekly_progress[0];
      console.log('  - First Week Data:');
      console.log('    • Week Number:', week.week_number);
      console.log('    • Sessions Completed:', week.sessions_completed);
      console.log('    • Time Spent:', week.time_spent_seconds, 'seconds');
    }

    return true;
  } catch (error) {
    console.error('❌ Progress Data Test Failed:');
    console.error('  - Error:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('  - SQL Error:', error.response.data.details);
    }
    return false;
  }
}

async function testSessionCreation() {
  console.log('\n🔍 TEST 3: Testing Session Creation');
  console.log('====================================');

  try {
    const sessionData = {
      methodology_plan_id: TEST_METHODOLOGY_PLAN_ID,
      week_number: 1,
      day_name: 'Lunes'
    };

    const sessionResponse = await axios.post(
      `${API_BASE_URL}/routines/start-methodology-session`,
      sessionData,
      { headers }
    );

    console.log('✅ Session Creation Test:');
    console.log('  - Session ID:', sessionResponse.data.sessionId);
    console.log('  - Success:', sessionResponse.data.success);
    console.log('  - Message:', sessionResponse.data.message || 'Session started');

    return true;
  } catch (error) {
    if (error.response?.status === 400) {
      const errorMsg = error.response.data.error;

      if (errorMsg.includes('Plan no disponible - Estado: draft')) {
        console.log('⚠️ Plan needs activation:');
        console.log('  - Current Status: draft');
        console.log('  - Action Required: Activate plan through confirm-and-activate endpoint');
        return false;
      } else if (errorMsg.includes('ya existe una sesión')) {
        console.log('⚠️ Session already exists');
        console.log('  - This is expected if a session is already in progress');
        return true;
      }
    }

    console.error('❌ Session Creation Test Failed:');
    console.error('  - Error:', error.response?.data || error.message);
    return false;
  }
}

async function activatePlan() {
  console.log('\n🔧 ATTEMPTING TO ACTIVATE PLAN');
  console.log('================================');

  try {
    const activationResponse = await axios.post(
      `${API_BASE_URL}/routines/confirm-and-activate`,
      { methodology_plan_id: TEST_METHODOLOGY_PLAN_ID },
      { headers }
    );

    console.log('✅ Plan Activated Successfully:');
    console.log('  - Plan ID:', activationResponse.data.data.methodology_plan_id);
    console.log('  - Status:', activationResponse.data.data.status);
    console.log('  - Ready for Training:', activationResponse.data.data.ready_for_training);

    return true;
  } catch (error) {
    console.error('❌ Plan Activation Failed:');
    console.error('  - Error:', error.response?.data || error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 STARTING ROUTINE SYSTEM TESTS');
  console.log('=================================');
  console.log(`Testing with User ID: ${TEST_USER_ID}`);
  console.log(`Testing with Plan ID: ${TEST_METHODOLOGY_PLAN_ID}`);

  const results = {
    planStatus: false,
    progressData: false,
    sessionCreation: false,
    planActivation: false
  };

  // Test 1: Plan Status
  results.planStatus = await testPlanStatus();

  // Test 2: Progress Data (GROUP BY fix)
  results.progressData = await testProgressData();

  // Test 3: Session Creation
  results.sessionCreation = await testSessionCreation();

  // If session creation fails due to draft status, try to activate
  if (!results.sessionCreation) {
    console.log('\n📌 Plan appears to be in draft status. Attempting activation...');
    results.planActivation = await activatePlan();

    if (results.planActivation) {
      console.log('\n📌 Retrying session creation after activation...');
      results.sessionCreation = await testSessionCreation();
    }
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`✅ Passed: ${Object.values(results).filter(r => r).length}`);
  console.log(`❌ Failed: ${Object.values(results).filter(r => !r).length}`);
  console.log('\nDetailed Results:');
  console.log('  - Plan Status Check:', results.planStatus ? '✅' : '❌');
  console.log('  - Progress Data (GROUP BY):', results.progressData ? '✅' : '❌');
  console.log('  - Session Creation:', results.sessionCreation ? '✅' : '❌');
  if (results.planActivation !== false) {
    console.log('  - Plan Activation:', results.planActivation ? '✅' : '❌');
  }

  console.log('\n🏁 TESTS COMPLETED');
}

// Check if we can import axios
try {
  require('axios');
} catch (e) {
  console.log('⚠️ axios not found. Installing...');
  require('child_process').execSync('npm install axios', { stdio: 'inherit' });
}

// Run the tests
runAllTests().catch(console.error);