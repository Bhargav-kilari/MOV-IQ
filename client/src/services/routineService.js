import api from './api';

export const routineService = {
  getRoutines: async () => {
    const res = await api.get('/routines');
    return res.data;
  },
  getRoutineById: async (id) => {
    const res = await api.get(`/routines/${id}`);
    return res.data;
  },
  createRoutine: async (data) => {
    const res = await api.post('/routines', data);
    return res.data;
  },
  updateRoutine: async (id, data) => {
    const res = await api.put(`/routines/${id}`, data);
    return res.data;
  },
  deleteRoutine: async (id) => {
    const res = await api.delete(`/routines/${id}`);
    return res.data;
  },
};
