import api from './api';

export const aiService = {
  // Check AI inference service health and readiness
  getHealth: async () => {
    const res = await api.get('/ai/health');
    return res.data;
  },

  // Get active model architecture and metadata
  getModels: async () => {
    const res = await api.get('/ai/models');
    return res.data;
  },

  // Get 12 core AI supported exercises mapped to DB records
  getSupportedExercises: async () => {
    const res = await api.get('/ai/supported-exercises');
    return res.data;
  },

  // Run pose inference on landmark sequence [T, 33, 3]
  predictPose: async (landmarks, fps = 30.0, exerciseHint = null) => {
    const res = await api.post('/ai/predict', {
      landmarks,
      fps,
      exercise_hint: exerciseHint,
    });
    return res.data;
  },

  // Save session assessment into future_ai_analysis
  saveSession: async (sessionData) => {
    const res = await api.post('/ai/save-session', sessionData);
    return res.data;
  },

  // Get user's AI session history
  getHistory: async () => {
    const res = await api.get('/ai/history');
    return res.data;
  },
};

export default aiService;
