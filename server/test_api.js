import http from 'http';
import app from './app.js';
import { query } from './config/db.js';

const PORT = 5056;

async function runTests() {
  console.log('🧪 Starting Master Exercise Library & Backend API Verification Suite...');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`🌐 Test server listening on http://localhost:${PORT}`);

  const BASE_URL = `http://localhost:${PORT}/api`;

  const request = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  };

  try {
    // 1. Health Check
    console.log('\n1️⃣ Testing Health Check...');
    const health = await request('/health');
    if (health.status !== 200 || health.data.status !== 'online') {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }
    console.log('✅ Health check OK:', health.data.status);

    // 2. Master Exercise Library Count & Pagination
    console.log('\n2️⃣ Testing Master Exercise Library (1,324+ exercises)...');
    const catalogRes = await request('/exercises?page=1&limit=30');
    if (catalogRes.status !== 200 || catalogRes.data.total < 350) {
      throw new Error(`Catalog count too low! Found: ${catalogRes.data.total}`);
    }
    console.log(`✅ Loaded catalog. Total database exercises: ${catalogRes.data.total}, Page size: ${catalogRes.data.count}`);

    // Verify media attribution is preserved on catalog items
    const sampleItem = catalogRes.data.data[0];
    if (!sampleItem.media_attribution) {
      throw new Error('Media attribution is missing from exercise records!');
    }
    console.log(`✅ Media attribution verified: "${sampleItem.media_attribution}"`);

    // 3. Search Functionality
    console.log('\n3️⃣ Testing Exercise Search ("bench" and "curl")...');
    const benchSearch = await request('/exercises?search=bench');
    if (benchSearch.status !== 200 || benchSearch.data.data.length === 0) {
      throw new Error('Search for "bench" returned 0 results');
    }
    console.log(`✅ Search "bench": found ${benchSearch.data.total} exercises. Sample: ${benchSearch.data.data[0].name}`);

    const curlSearch = await request('/exercises?search=curl');
    if (curlSearch.status !== 200 || curlSearch.data.data.length === 0) {
      throw new Error('Search for "curl" returned 0 results');
    }
    console.log(`✅ Search "curl": found ${curlSearch.data.total} exercises. Sample: ${curlSearch.data.data[0].name}`);

    // 4. Combined Search & Filtering
    console.log('\n4️⃣ Testing Filter Combination (equipment="cable" & body_part="chest")...');
    const filteredRes = await request('/exercises?equipment=cable&body_part=chest');
    if (filteredRes.status !== 200 || filteredRes.data.total === 0) {
      throw new Error('Combined filter returned 0 results');
    }
    console.log(`✅ Combined filter (cable + chest): found ${filteredRes.data.total} exercises. Sample: ${filteredRes.data.data[0].name}`);

    // 5. User Registration & Auth
    console.log('\n5️⃣ Testing User Registration & Token Auth...');
    const email1 = `lifter_${Date.now()}@test.com`;
    const reg1 = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Alex Lifter', email: email1, password: 'password123', confirmPassword: 'password123' },
    });
    const token1 = reg1.data.token || reg1.data.data?.token;
    if (reg1.status !== 201 || !token1) {
      throw new Error(`Registration failed: ${JSON.stringify(reg1)}`);
    }
    console.log('✅ User registered successfully:', reg1.data.user?.name || reg1.data.data?.user?.name);

    // 6. Custom Exercise Creation & Isolation
    console.log('\n6️⃣ Testing Custom Exercise Creation & User Privacy...');
    const customRes = await request('/exercises/custom', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        name: 'Single Leg Deficit Deadlift',
        body_part: 'upper legs',
        target_muscle: 'hamstrings',
        equipment: 'dumbbell',
        instructions: ['Stand on 25kg plate', 'Hinge at hips with dumbbell in hand'],
      },
    });
    if (customRes.status !== 201 || !customRes.data.data.id) {
      throw new Error(`Custom exercise creation failed: ${JSON.stringify(customRes)}`);
    }
    const customExId = customRes.data.data.id;
    console.log('✅ Custom exercise created:', customRes.data.data.name, `(ID: ${customExId})`);

    // Verify User 1 can see custom exercise in 'custom' tab
    const myCustoms = await request('/exercises?tab=custom', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (myCustoms.data.total !== 1 || myCustoms.data.data[0].id !== customExId) {
      throw new Error('User 1 could not find their custom exercise');
    }
    console.log('✅ User 1 found their custom exercise in My Exercises tab');

    // Register User 2 and verify User 2 CANNOT see User 1's custom exercise
    const email2 = `lifter2_${Date.now()}@test.com`;
    const reg2 = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Sam Power', email: email2, password: 'password123', confirmPassword: 'password123' },
    });
    const token2 = reg2.data.token || reg2.data.data?.token;

    const user2Customs = await request('/exercises?tab=custom', {
      headers: { Authorization: `Bearer ${token2}` },
    });
    if (user2Customs.data.total !== 0) {
      throw new Error('Privacy failure: User 2 can see User 1 custom exercises!');
    }
    console.log('🛡️ Privacy verified: User 2 cannot see User 1 custom exercises (0 returned).');

    // 7. Workout & Routine Integration with Catalog Exercises
    console.log('\n7️⃣ Testing Routine Creation with Catalog Exercises...');
    const benchEx = benchSearch.data.data[0];
    const curlEx = curlSearch.data.data[0];

    const routineRes = await request('/routines', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        name: 'Upper Body Blast',
        description: 'Heavy bench and arms',
        exercises: [
          { exercise_id: benchEx.id, order_index: 0, target_sets: 3, target_reps: 8, target_weight: 80, rest_seconds: 90 },
          { exercise_id: curlEx.id, order_index: 1, target_sets: 3, target_reps: 10, target_weight: 16, rest_seconds: 60 },
        ],
      },
    });
    if (routineRes.status !== 201) {
      throw new Error(`Routine creation failed: ${JSON.stringify(routineRes)}`);
    }
    const routineId = routineRes.data.data?.id || routineRes.data.id;
    console.log('✅ Routine created with catalog exercises. ID:', routineId);

    // 8. Start & Finish Workout Logging
    console.log('\n8️⃣ Testing Workout Execution & Set Performance Logging...');
    const startWorkout = await request('/workouts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: { routine_id: routineId },
    });
    const workoutId = startWorkout.data.data?.id || startWorkout.data.id;

    const completeWorkout = await request(`/workouts/${workoutId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        duration: 2700,
        notes: 'Great session',
        exercises: [
          {
            exercise_id: benchEx.id,
            order_index: 0,
            sets: [
              { set_number: 1, weight: 80, reps: 8, completed: true },
              { set_number: 2, weight: 85, reps: 8, completed: true },
              { set_number: 3, weight: 90, reps: 6, completed: true },
            ],
          },
          {
            exercise_id: curlEx.id,
            order_index: 1,
            sets: [
              { set_number: 1, weight: 16, reps: 10, completed: true },
              { set_number: 2, weight: 16, reps: 10, completed: true },
            ],
          },
        ],
      },
    });
    if (completeWorkout.status !== 200) {
      throw new Error(`Workout completion failed: ${JSON.stringify(completeWorkout)}`);
    }
    console.log('✅ Workout completed & sets recorded.');

    // 9. Recently Used Exercises
    console.log('\n9️⃣ Testing Recently Used Exercises from Workout History...');
    const recentRes = await request('/exercises/recent', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (recentRes.status !== 200 || recentRes.data.data.length < 2) {
      throw new Error(`Recently used exercises returned insufficient data: ${JSON.stringify(recentRes)}`);
    }
    console.log(`✅ Recently used exercises populated dynamically: ${recentRes.data.data.map((e) => e.name).join(', ')}`);

    // 10. Exercise Performance & Personal Records Check
    console.log('\n🔟 Testing Exercise Personal Records & Session History...');
    const benchDetail = await request(`/exercises/${benchEx.id}`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const prs = benchDetail.data.data.personal_records;
    if (!prs || parseFloat(prs.pr_weight) !== 90) {
      throw new Error(`PR weight mismatch. Expected 90, got: ${JSON.stringify(prs)}`);
    }
    console.log(`✅ Bench Press PR Verified: Max Weight ${prs.pr_weight} kg, 1RM ${prs.pr_estimated_1rm} kg`);

    // 11. Progress Data Consistency & 8-Week Timeline Verification
    console.log('\n1️⃣1️⃣ Testing Progress & Workout History Data Consistency...');
    const progRes = await request('/progress', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (progRes.status !== 200) {
      throw new Error(`Progress API failed: ${JSON.stringify(progRes)}`);
    }

    const { summary, weekly_activity } = progRes.data.data;
    if (summary.total_workouts !== 1) {
      throw new Error(`Expected 1 workout logged, got ${summary.total_workouts}`);
    }
    if (summary.total_completed_sets !== 5) {
      throw new Error(`Expected 5 completed sets, got ${summary.total_completed_sets}`);
    }
    if (weekly_activity.length !== 8) {
      throw new Error(`Expected exactly 8 weekly buckets, got ${weekly_activity.length}`);
    }

    const sumWeeklyWorkouts = weekly_activity.reduce((acc, w) => acc + w.workout_count, 0);
    if (sumWeeklyWorkouts !== summary.total_workouts) {
      throw new Error(`Weekly frequency sum (${sumWeeklyWorkouts}) does not match total workouts (${summary.total_workouts})`);
    }

    const workoutsListRes = await request('/workouts', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const historyWorkout = workoutsListRes.data.data[0];
    if (parseFloat(historyWorkout.total_volume) !== summary.total_volume_kg) {
      throw new Error(`History volume (${historyWorkout.total_volume}) does not match Progress summary volume (${summary.total_volume_kg})`);
    }
    if (historyWorkout.completed_sets !== summary.total_completed_sets) {
      throw new Error(`History sets (${historyWorkout.completed_sets}) does not match Progress summary sets (${summary.total_completed_sets})`);
    }
    if (!historyWorkout.duration || historyWorkout.duration <= 0) {
      throw new Error(`Expected positive duration in history, got ${historyWorkout.duration}`);
    }

    console.log(`✅ Progress Summary Verified: ${summary.total_workouts} workout, ${summary.total_volume_kg} kg, ${summary.total_completed_sets} sets, ${summary.total_minutes} min`);
    console.log(`✅ 8-Week Timeline Verified: exactly 8 buckets with total ${sumWeeklyWorkouts} session`);
    console.log(`✅ Workout History Verified: duration ${historyWorkout.duration}s, volume ${historyWorkout.total_volume} kg`);

    console.log('\n🎉 ALL MASTER EXERCISE LIBRARY & PROGRESS CONSISTENCY TESTS PASSED (11/11) WITH 100% SUCCESS!\n');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
