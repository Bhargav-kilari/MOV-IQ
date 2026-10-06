import api from './api';

export const exerciseService = {
  getExercises: async (params = {}) => {
    const res = await api.get('/exercises', { params });
    return res.data;
  },
  getExerciseFilters: async () => {
    const res = await api.get('/exercises/filters');
    return res.data;
  },
  getRecentExercises: async () => {
    const res = await api.get('/exercises/recent');
    return res.data;
  },
  getExerciseById: async (id) => {
    const res = await api.get(`/exercises/${id}`);
    return res.data;
  },
  getExerciseHistory: async (id) => {
    const res = await api.get(`/exercises/${id}/history`);
    return res.data;
  },
  createCustomExercise: async (data) => {
    const res = await api.post('/exercises/custom', data);
    return res.data;
  },
  updateCustomExercise: async (id, data) => {
    const res = await api.put(`/exercises/custom/${id}`, data);
    return res.data;
  },
  deleteCustomExercise: async (id) => {
    const res = await api.delete(`/exercises/custom/${id}`);
    return res.data;
  },
};
