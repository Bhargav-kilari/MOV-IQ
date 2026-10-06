import api from './api';

export const workoutService = {
  getWorkouts: async () => {
    const res = await api.get('/workouts');
    return res.data;
  },
  getWorkoutById: async (id) => {
    const res = await api.get(`/workouts/${id}`);
    return res.data;
  },
  createWorkout: async (data) => {
    const res = await api.post('/workouts', data);
    return res.data;
  },
  updateWorkout: async (id, data) => {
    const res = await api.put(`/workouts/${id}`, data);
    return res.data;
  },
  completeWorkout: async (id, data) => {
    const res = await api.post(`/workouts/${id}/complete`, data);
    return res.data;
  },
};
