import api from './api';

export const authService = {
  register: async (data) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};
