import api from './api';

export const progressService = {
  getProgress: async () => {
    const res = await api.get('/progress');
    return res.data;
  },
  getExerciseProgress: async (exerciseId) => {
    const res = await api.get(`/progress/exercises/${exerciseId}`);
    return res.data;
  },
};
