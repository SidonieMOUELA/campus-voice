export const API_URL = 'http://192.168.34.135:8000';

export const ENDPOINTS = {
  login: `${API_URL}/auth/login`,
  signalements: `${API_URL}/signalements`,
  like: (id: string) => `${API_URL}/signalements/${id}/like`,
};