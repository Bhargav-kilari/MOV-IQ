import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../server/app.js';
import { query } from '../server/config/db.js';

const PORT = 5057;

async function runAITests() {
  console.log('🤖 Running MOV-IQ AI Assistance Integration Test Suite...\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
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
    // 1. AI Health Check
    console.log('1️⃣ Checking /api/ai/health (Python Inference Engine)...');
    const health = await request('/ai/health');
    console.log('Response:', health.data);
    if (!health.data.online || !health.data.model_loaded) {
      throw new Error(`AI Health check failed: ${JSON.stringify(health.data)}`);
    }
    console.log('✅ AI Service Health is ONLINE with checkpoint:', health.data.checkpoint);

    // 2. AI Model Metadata
    console.log('\n2️⃣ Checking /api/ai/models...');
    const models = await request('/ai/models');
    if (!models.data.active_model) {
      throw new Error('Active model metadata missing');
    }
    const exCount = models.data.active_model.exercise_classes.length;
    console.log(`✅ Active Model: ${models.data.active_model.architecture}`);
    console.log(`✅ Supported Exercises (${exCount}): ${models.data.active_model.exercise_classes.join(', ')}`);

    // 3. Supported Exercises with DB Mapping
    console.log('\n3️⃣ Checking /api/ai/supported-exercises...');
    const supp = await request('/ai/supported-exercises');
    if (!supp.data.success || supp.data.count !== 12) {
      throw new Error(`Expected 12 supported exercises, got: ${supp.data.count}`);
    }
    console.log(`✅ Loaded ${supp.data.count} AI-supported exercises mapped to PostgreSQL library.`);
    const sampleEx = supp.data.data[0];
    console.log(`   Sample: ${sampleEx.display_name} -> DB Record: "${sampleEx.db_exercise?.name}" (ID: ${sampleEx.db_exercise?.id})`);

    // 4. Multi-Task Pose Inference
    console.log('\n4️⃣ Testing /api/ai/predict with 60-frame sample...');
    const sampleReqPath = path.join(process.cwd(), 'Mov-IQ', 'ai_service', 'sample_request.json');
    const sampleReq = JSON.parse(fs.readFileSync(sampleReqPath, 'utf8'));

    const pred = await request('/ai/predict', {
      method: 'POST',
      body: {
        landmarks: sampleReq.landmarks,
        fps: 30.0,
        exercise_hint: 'squat',
      },
    });

    if (pred.status !== 200 || !pred.data.exercise || !pred.data.form) {
      throw new Error(`Prediction failed: ${JSON.stringify(pred)}`);
    }
    console.log(`✅ Model Predicted Exercise: ${pred.data.exercise.prediction} (${(pred.data.exercise.confidence * 100).toFixed(1)}% confidence)`);
    console.log(`✅ Model Predicted Form: ${pred.data.form.prediction} (${(pred.data.form.confidence * 100).toFixed(1)}% confidence)`);
    console.log(`✅ Latency: ${pred.data.inference_time_ms} ms`);

    // 5. Test Saving Session (authenticated user)
    console.log('\n5️⃣ Testing Authentication & Saving AI Session to PostgreSQL...');
    // Create/login test user
    const testEmail = `ai_tester_${Date.now()}@moviq.com`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'AI Test Athlete',
        email: testEmail,
        password: 'Password123!',
      },
    });
    const token = regRes.data.data.token;
    const userId = regRes.data.data.user.id;

    // Save AI session
    const saveRes = await request('/ai/save-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        exercise_id: sampleEx.db_exercise?.id,
        reps: 10,
        correct_reps: 8,
        incorrect_reps: 2,
        form_score: 80,
        mistakes: ['Insufficient depth — 2 reps'],
        feedback: 'Overall good stability and control. Maintain depth on final reps.',
        model_confidence: 85,
        detected_exercise: 'squat',
        metrics: { range_of_motion: 85, consistency: 80, tempo: 90 },
      },
    });

    if (saveRes.status !== 201 || !saveRes.data.data.id) {
      throw new Error(`Saving AI session failed: ${JSON.stringify(saveRes)}`);
    }
    console.log(`✅ AI Session saved into future_ai_analysis table! Record ID: ${saveRes.data.data.id}`);

    // 6. Test Fetching AI History
    console.log('\n6️⃣ Testing /api/ai/history...');
    const histRes = await request('/ai/history', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (histRes.status !== 200 || histRes.data.count < 1) {
      throw new Error(`History fetch failed: ${JSON.stringify(histRes)}`);
    }
    console.log(`✅ User AI History verified: found ${histRes.data.count} session(s).`);
    console.log(`   Exercise: ${histRes.data.data[0].exercise_name}, Score: ${histRes.data.data[0].form_score}`);

    // Clean up test user
    await query('DELETE FROM users WHERE id = $1', [userId]);

    console.log('\n🎉 ALL AI ASSISTANCE INTEGRATION TESTS PASSED SUCCESSFULLY (6/6)!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runAITests();
